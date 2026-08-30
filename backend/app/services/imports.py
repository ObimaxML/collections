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
        "account_no",
        "account no",
        "municipal_account",
        "municipal account",
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
    ],
    "arrears": [
        "arrears",
        "arrears_amount",
        "arrears amount",
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
    ],
    "last_name": [
        "last_name",
        "last name",
        "lastname",
        "customer_last_name",
    ],
    "id_number": [
        "id_number",
        "id number",
        "id_no",
        "id no",
        "identity_number",
    ],
    "company_registration": [
        "company_registration",
        "company registration",
        "registration_number",
        "registration number",
    ],
    "mobile": [
        "mobile",
        "mobile_number",
        "mobile number",
        "phone",
        "phone_number",
    ],
    "email": [
        "email",
        "email_address",
        "email address",
    ],
    "property_reference": [
        "property_reference",
        "property reference",
        "property_ref",
        "property ref",
    ],
    "address": [
        "address",
        "property_address",
        "property address",
        "street_address",
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
    value = str(value).strip()
    if not value or value.lower() in {
        "nan",
        "none",
        "null",
        "nat",
    }:
        return None
    return value


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
    mapping, missing = validate_columns(
        columns
    )
    if missing:
        raise ValueError(
            "Missing required columns: " + ", ".join(missing)
        )

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
            mobile = row_value(
                row,
                mapping,
                "mobile",
            )
            email = row_value(
                row,
                mapping,
                "email",
            )

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
                )
            )
            days_in_arrears = parse_integer(
                row_value(
                    row,
                    mapping,
                    "days_in_arrears",
                )
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
