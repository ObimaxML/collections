import uuid
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Tenant,
    Customer,
    Property,
    MunicipalAccount,
    AuditEvent,
)

REQUIRED_COLUMNS = {
    "account_number",
}

COLUMN_ALIASES = {
    "account_number": [
        "account_number",
        "account number",
        "account #",
        "account_#",
        "account_no",
        "account no",
        "accountno",
        "municipal_account",
        "municipal account",
        "acc_no",
        "acc no",
        "account",
    ],
    "account_status": [
        "account_status",
        "account status",
        "status",
    ],
    "balance": [
        "balance",
        "account_balance",
        "account balance",
        "total_balance",
        "total balance",
    ],
    "arrears": [
        "90 days plus",
        "90_days_plus",
        "90+ days",
        "90+ days plus",
        "arrears",
        "arrears_amount",
        "arrears amount",
        "overdue_amount",
    ],
    "days_in_arrears": [
        "days_in_arrears",
        "days in arrears",
        "arrears_days",
        "arrears days",
    ],
    "first_name": [
        "first_name",
        "first name",
        "firstname",
        "customer_first_name",
        "name",
        "customer_name",
        "account_holder",
    ],
    "last_name": [
        "last_name",
        "last name",
        "lastname",
        "customer_last_name",
        "surname",
    ],
    "id_number": [
        "id_number",
        "id number",
        "id_no",
        "id no",
        "identity_number",
        "identity number",
        "id",
    ],
    "company_registration": [
        "company_registration",
        "company registration",
        "registration_number",
        "registration number",
        "reg_no",
        "reg no",
    ],
    "mobile": [
        "cellular phone",
        "cellular_phone",
        "cell phone",
        "cell_phone",
        "cellular",
        "cell",
        "mobile",
        "mobile_number",
        "mobile number",
        "telephone 1",
        "telephone_1",
        "telephone 2",
        "telephone_2",
        "telephone",
        "phone",
        "phone_number",
    ],
    "email": [
        "e_mail",
        "e-mail",
        "email",
        "email_address",
        "email address",
    ],
    "property_reference": [
        "property_reference",
        "property reference",
        "property_ref",
        "property ref",
        "erf",
        "stand",
    ],
    "address": [
        "physical_address",
        "physical address",
        "address",
        "property_address",
        "property address",
        "street_address",
        "suburb",
    ],
    "last_payment_date": [
        "last_payment_date",
        "last payment date",
        "payment_date",
    ],
    "last_payment_amount": [
        "last_payment_amount",
        "last payment amount",
        "payment_amount",
    ],
}


def normalise_column(value):
    return (
        str(value)
        .strip()
        .lower()
        .replace("-", "_")
        .replace("/", "_")
    )


def clean_value(value):
    if value is None:
        return None
    if isinstance(value, float):
        if value != value:
            return None
        if value.is_integer():
            value = str(int(value))
        else:
            value = str(value)
    elif isinstance(value, int):
        value = str(value)
    else:
        value = str(value).strip()
    
    if not value or value.lower() in {
        "nan",
        "none",
        "null",
        "nat",
    }:
        return None
    return value


def format_mobile_number(value):
    val = clean_value(value)
    if not val:
        return None
    # Remove all spaces, dashes, parentheses
    clean_digits = "".join(c for c in val if c.isdigit())
    if not clean_digits:
        return val
    # South African standard: 9 digits without leading 0 -> prepend 0 (e.g. 841112233 -> 0841112233)
    if len(clean_digits) == 9 and clean_digits.startswith(("6", "7", "8", "9")):
        return f"0{clean_digits}"
    # International +27 format (e.g. 27841112233 -> 0841112233)
    if len(clean_digits) == 11 and clean_digits.startswith("27"):
        return f"0{clean_digits[2:]}"
    if len(clean_digits) == 10 and clean_digits.startswith("0"):
        return clean_digits
    return val


def parse_decimal(value, default=Decimal("0.00")):
    value = clean_value(value)
    if value is None:
        return default
    value = (
        value.replace("R", "")
        .replace("r", "")
        .replace(",", "")
        .strip()
    )
    try:
        return Decimal(value)
    except (InvalidOperation, ValueError):
        raise ValueError(
            f"Invalid monetary value: {value}"
        )


def parse_integer(value, default=0):
    value = clean_value(value)
    if value is None:
        return default
    try:
        return int(float(value))
    except (ValueError, TypeError):
        raise ValueError(
            f"Invalid integer value: {value}"
        )


def parse_date(value):
    value = clean_value(value)
    if value is None:
        return None
    if hasattr(value, "date"):
        try:
            return value.date()
        except Exception:
            pass

    formats = [
        "%Y-%m-%d",
        "%d/%m/%Y",
        "%d-%m-%Y",
        "%Y/%m/%d",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(
                value,
                fmt,
            ).date()
        except ValueError:
            continue
    raise ValueError(
        f"Invalid date value: {value}"
    )


def build_column_mapping(columns):
    normalised = {
        normalise_column(column): column
        for column in columns
    }
    mapping = {}
    for target, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            alias_normalised = normalise_column(alias)
            if alias_normalised in normalised:
                mapping[target] = normalised[
                    alias_normalised
                ]
                break
    return mapping


def validate_columns(columns):
    mapping = build_column_mapping(columns)
    missing = []
    for required in REQUIRED_COLUMNS:
        if required not in mapping:
            missing.append(required)
    return mapping, missing


def row_value(row, mapping, field):
    source_column = mapping.get(field)
    if not source_column:
        return None
    return clean_value(
        row.get(source_column)
    )


def find_customer(
    db: Session,
    tenant_id,
    id_number=None,
    company_registration=None,
    mobile=None,
):
    if id_number:
        customer = db.execute(
            select(Customer)
            .where(
                Customer.tenant_id == tenant_id,
                Customer.id_number == id_number,
            )
        ).scalar_one_or_none()
        if customer:
            return customer
    if company_registration:
        customer = db.execute(
            select(Customer)
            .where(
                Customer.tenant_id == tenant_id,
                Customer.company_registration == company_registration,
            )
        ).scalar_one_or_none()
        if customer:
            return customer
    if mobile:
        customer = db.execute(
            select(Customer)
            .where(
                Customer.tenant_id == tenant_id,
                Customer.mobile == mobile,
            )
        ).scalar_one_or_none()
        if customer:
            return customer
    return None


def find_property(
    db: Session,
    tenant_id,
    property_reference=None,
):
    if not property_reference:
        return None
    return db.execute(
        select(Property)
        .where(
            Property.tenant_id == tenant_id,
            Property.property_reference == property_reference,
        )
    ).scalar_one_or_none()


def import_accounts(
    db: Session,
    tenant_id,
    rows,
    actor="import",
    custom_mapping=None,
):
    tenant = db.execute(
        select(Tenant)
        .where(Tenant.id == tenant_id)
    ).scalar_one_or_none()
    if not tenant:
        raise ValueError(
            "Tenant not found."
        )

    if not rows:
        return {
            "status": "completed",
            "total_rows": 0,
            "created": 0,
            "updated": 0,
            "skipped": 0,
            "errors": [],
        }

    columns = list(rows[0].keys())
    auto_mapping, missing = validate_columns(
        columns
    )
    
    # Merge custom mapping overrides if provided
    mapping = dict(auto_mapping)
    if custom_mapping and isinstance(custom_mapping, dict):
        for k, v in custom_mapping.items():
            if v and v in columns:
                mapping[k] = v

    if "account_number" not in mapping or not mapping["account_number"]:
        raise ValueError(
            "Missing required column: account_number"
        )

    # Calculate mapped source columns so we can capture unmapped extras
    mapped_source_columns = set(mapping.values())

    created = 0
    updated = 0
    skipped = 0
    errors = []
    seen_accounts = set()

    for index, row in enumerate(
        rows,
        start=2,
    ):
        try:
            account_number = row_value(
                row,
                mapping,
                "account_number",
            )
            if not account_number:
                raise ValueError(
                    "account_number is required."
                )

            duplicate_key = (
                account_number.lower()
            )
            if duplicate_key in seen_accounts:
                skipped += 1
                errors.append(
                    {
                        "row": index,
                        "account_number": account_number,
                        "error": "Duplicate account within import file.",
                    }
                )
                continue
            seen_accounts.add(
                duplicate_key
            )

            account = db.execute(
                select(MunicipalAccount)
                .where(
                    MunicipalAccount.tenant_id == tenant_id,
                    MunicipalAccount.account_number == account_number,
                )
            ).scalar_one_or_none()

            first_name = row_value(
                row,
                mapping,
                "first_name",
            )
            last_name = row_value(
                row,
                mapping,
                "last_name",
            )

            # Smart name splitting if only single full name column exists
            if first_name and not last_name:
                cleaned_name = first_name.strip()
                # If name looks like a company or trust, store it under company registration / first name
                if any(kw in cleaned_name.upper() for kw in ["(PTY)", "LTD", "TRUST", "ASSOC", "CC", "CHURCH", "MUNICIPALITY", "HOLDINGS"]):
                    first_name = cleaned_name
                    last_name = ""
                else:
                    parts = cleaned_name.split(None, 1)
                    if len(parts) == 2:
                        first_name, last_name = parts[0], parts[1]
                    else:
                        first_name = parts[0]
                        last_name = ""

            id_number = row_value(
                row,
                mapping,
                "id_number",
            )
            company_registration = row_value(
                row,
                mapping,
                "company_registration",
            )
            mobile = format_mobile_number(
                row_value(
                    row,
                    mapping,
                    "mobile",
                )
            )
            # If mobile is empty, check alternate phone columns in raw row
            if not mobile:
                for alt_phone in ["Cellular Phone", "Telephone 1", "Telephone 2", "Phone", "Mobile"]:
                    if alt_phone in row and row[alt_phone]:
                        cand = format_mobile_number(row[alt_phone])
                        if cand:
                            mobile = cand
                            break

            email = row_value(
                row,
                mapping,
                "email",
            )
            if email and ";" in str(email):
                email = str(email).split(";")[0].strip()

            customer = find_customer(
                db,
                tenant_id,
                id_number=id_number,
                company_registration=company_registration,
                mobile=mobile,
            )

            if customer is None and any(
                [
                    first_name,
                    last_name,
                    id_number,
                    company_registration,
                    mobile,
                    email,
                ]
            ):
                customer = Customer(
                    id=uuid.uuid4(),
                    tenant_id=tenant_id,
                    first_name=first_name,
                    last_name=last_name,
                    id_number=id_number,
                    company_registration=company_registration,
                    mobile=mobile,
                    email=email,
                    created_at=datetime.now(
                        timezone.utc
                    ),
                )
                db.add(customer)
                db.flush()
            elif customer:
                changed = False
                fields = {
                    "first_name": first_name,
                    "last_name": last_name,
                    "id_number": id_number,
                    "company_registration": company_registration,
                    "mobile": mobile,
                    "email": email,
                }
                for field, value in fields.items():
                    if value is not None:
                        current = getattr(
                            customer,
                            field,
                        )
                        if current != value:
                            setattr(
                                customer,
                                field,
                                value,
                            )
                            changed = True
                if changed:
                    db.flush()

            property_reference = row_value(
                row,
                mapping,
                "property_reference",
            )
            address = row_value(
                row,
                mapping,
                "address",
            )

            # Check if SUBURB is present to build complete physical municipal address
            suburb = clean_value(row.get("SUBURB") or row.get("suburb"))
            if suburb and suburb != "-" and address:
                if suburb.lower() not in address.lower():
                    address = f"{address}, {suburb}"
            elif suburb and suburb != "-" and not address:
                address = suburb

            property_obj = find_property(
                db,
                tenant_id,
                property_reference,
            )

            if (
                property_obj is None
                and (property_reference or address)
            ):
                property_obj = Property(
                    id=uuid.uuid4(),
                    tenant_id=tenant_id,
                    property_reference=property_reference,
                    address=address,
                )
                db.add(property_obj)
                db.flush()
            elif property_obj:
                if (
                    address
                    and property_obj.address != address
                ):
                    property_obj.address = address
                    db.flush()

            account_status = (
                row_value(
                    row,
                    mapping,
                    "account_status",
                )
                or "ACTIVE"
            )
            balance = parse_decimal(
                row_value(
                    row,
                    mapping,
                    "balance",
                )
            )
            arrears = parse_decimal(
                row_value(
                    row,
                    mapping,
                    "arrears",
                ),
                default=balance,
            )
            # If arrears was parsed as 0 but balance > 0, set arrears to balance
            if arrears == Decimal("0.00") and balance > Decimal("0.00"):
                arrears = balance

            days_in_arrears = parse_integer(
                row_value(
                    row,
                    mapping,
                    "days_in_arrears",
                ),
                default=90 if arrears > Decimal("0.00") else 0,
            )
            last_payment_date = parse_date(
                row_value(
                    row,
                    mapping,
                    "last_payment_date",
                )
            )
            last_payment_amount = parse_decimal(
                row_value(
                    row,
                    mapping,
                    "last_payment_amount",
                )
            )

            # Extract unmapped extra columns into a metadata dictionary
            extra_metadata = {}
            for col, val in row.items():
                if col not in mapped_source_columns and val is not None and str(val).strip() != "":
                    extra_metadata[col] = clean_value(val)

            if customer and extra_metadata:
                existing_meta = dict(customer.metadata_ or {})
                existing_meta.update(extra_metadata)
                customer.metadata_ = existing_meta

            if account is None:
                account = MunicipalAccount(
                    id=uuid.uuid4(),
                    tenant_id=tenant_id,
                    customer_id=(
                        customer.id
                        if customer
                        else None
                    ),
                    property_id=(
                        property_obj.id
                        if property_obj
                        else None
                    ),
                    account_number=account_number,
                    account_status=account_status,
                    balance=balance,
                    arrears=arrears,
                    days_in_arrears=days_in_arrears,
                    last_payment_date=last_payment_date,
                    last_payment_amount=last_payment_amount,
                    metadata_=extra_metadata,
                )
                db.add(account)
                created += 1
            else:
                account.customer_id = (
                    customer.id
                    if customer
                    else account.customer_id
                )
                account.property_id = (
                    property_obj.id
                    if property_obj
                    else account.property_id
                )
                account.account_status = account_status
                account.balance = balance
                account.arrears = arrears
                account.days_in_arrears = days_in_arrears
                account.last_payment_date = last_payment_date
                account.last_payment_amount = last_payment_amount
                if extra_metadata:
                    existing_meta = dict(account.metadata_ or {})
                    existing_meta.update(extra_metadata)
                    account.metadata_ = existing_meta
                updated += 1

            db.flush()

        except Exception as exc:
            errors.append(
                {
                    "row": index,
                    "account_number": row.get(
                        mapping.get("account_number")
                    ),
                    "error": str(exc),
                }
            )
            skipped += 1

    db.commit()

    db.add(
        AuditEvent(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            actor=actor,
            event_type="ACCOUNT_IMPORT",
            entity_type="municipal_account",
            entity_id=None,
            payload={
                "total_rows": len(rows),
                "created": created,
                "updated": updated,
                "skipped": skipped,
                "errors": len(errors),
            },
            created_at=datetime.now(
                timezone.utc
            ),
        )
    )
    db.commit()

    return {
        "status": "completed",
        "total_rows": len(rows),
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "errors": errors,
    }
