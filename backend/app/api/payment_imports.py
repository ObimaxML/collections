import io
import json
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

import pandas as pd
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import (
    MunicipalAccount,
    Payment,
)
from app.services.imports import (
    build_column_mapping as service_build_column_mapping,
    build_mapping_details,
    resolve_tenant,
)
from app.services.payment_service import (
    PaymentAccountNotFoundError,
    PaymentDuplicateError,
    PaymentValidationError,
    record_payment,
)


router = APIRouter(
    prefix="/payments",
    tags=["Payment Imports"],
)


REQUIRED_COLUMNS = {
    "tenant_id",
    "account_number",
    "amount",
    "payment_date",
    "external_reference",
}


COLUMN_ALIASES = {
    "tenant_id": [
        "tenant_id",
        "tenant",
        "tenant_code",
        "municipality_id",
        "municipality",
        "municipality_code",
    ],
    "account_number": [
        "account_number",
        "account_no",
        "account_num",
        "acc_no",
        "acc_number",
        "municipal_account",
        "municipal_account_number",
        "account",
    ],
    "amount": [
        "amount",
        "payment_amount",
        "payment_value",
        "value",
        "paid_amount",
        "amount_paid",
        "total_paid",
    ],
    "payment_date": [
        "payment_date",
        "date",
        "transaction_date",
        "payment_dt",
        "date_paid",
        "paid_date",
        "tx_date",
    ],
    "external_reference": [
        "external_reference",
        "reference",
        "payment_reference",
        "receipt_number",
        "receipt_no",
        "transaction_reference",
        "ref_no",
        "ref",
    ],
}


def normalise_columns(df: pd.DataFrame) -> pd.DataFrame:
    df.columns = [
        str(column)
        .strip()
        .lower()
        .replace("-", "_")
        .replace("/", "_")
        .replace(" ", "_")
        for column in df.columns
    ]

    return df


def build_column_mapping(
    columns: list[str],
) -> dict[str, str]:
    normalised = {
        str(column)
        .strip()
        .lower()
        .replace("-", "_")
        .replace("/", "_")
        .replace(" ", "_"): column
        for column in columns
    }

    mapping = {}

    for target, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            alias_normalised = (
                str(alias)
                .strip()
                .lower()
                .replace("-", "_")
                .replace("/", "_")
                .replace(" ", "_")
            )

            if alias_normalised in normalised:
                mapping[target] = normalised[
                    alias_normalised
                ]
                break

    return mapping


def validate_mapping(
    columns: list[str],
) -> tuple[dict[str, str], list[str]]:
    mapping = build_column_mapping(columns)

    missing = [
        column
        for column in REQUIRED_COLUMNS
        if column not in mapping
    ]

    return mapping, missing


def get_mapped_value(
    row,
    mapping,
    target,
):
    source_column = mapping.get(target)

    if not source_column:
        return None

    value = row.get(source_column)

    if pd.isna(value):
        return None

    if isinstance(value, str):
        value = value.strip()

    return value


@router.post("/import/mapping")
async def payment_import_mapping(
    file: UploadFile = File(...),
):
    content = await file.read()

    filename = (
        file.filename or ""
    ).lower()

    try:
        if filename.endswith(".csv"):
            df = pd.read_csv(
                io.BytesIO(content)
            )

        elif filename.endswith(".xlsx"):
            df = pd.read_excel(
                io.BytesIO(content)
            )

        else:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Only CSV and XLSX files "
                    "are supported."
                ),
            )

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Could not read file: {exc}",
        ) from exc

    df = normalise_columns(df)

    columns = list(df.columns)

    mapping = build_column_mapping(
        columns
    )

    mapping_details = build_mapping_details(
        columns
    )

    unmapped_columns = [
        column
        for column in columns
        if column not in mapping.values()
    ]

    return {
        "filename": file.filename,
        "rows": len(df),
        "columns": columns,
        "suggested_mapping": mapping,
        "mapping_details": mapping_details,
        "unmapped_columns": unmapped_columns,
        "available_targets": [
            "tenant_id",
            "account_number",
            "amount",
            "payment_date",
            "external_reference",
        ],
    }


@router.post("/import/preview")
async def preview_payment_import(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    content = await file.read()

    filename = (
        file.filename or ""
    ).lower()

    try:
        if filename.endswith(".csv"):
            df = pd.read_csv(
                io.BytesIO(content)
            )

        elif filename.endswith(".xlsx"):
            df = pd.read_excel(
                io.BytesIO(content)
            )

        else:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Only CSV and XLSX files "
                    "are supported."
                ),
            )

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Could not read file: {exc}",
        ) from exc

    df = normalise_columns(df)

    mapping, missing = validate_mapping(
        list(df.columns)
    )

    tenant_results = []
    tenant_column = mapping.get("tenant_id")

    if tenant_column and tenant_column in df.columns:
        values = (
            df[tenant_column]
            .dropna()
            .astype(str)
            .str.strip()
            .unique()
            .tolist()
        )

        for value in values[:20]:
            tenant = resolve_tenant(
                db,
                value,
            )

            tenant_results.append(
                {
                    "source_value": value,
                    "resolved": tenant is not None,
                    "tenant_id": (
                        str(tenant.id)
                        if tenant
                        else None
                    ),
                    "tenant_code": (
                        tenant.code
                        if tenant
                        else None
                    ),
                    "tenant_name": (
                        tenant.name
                        if tenant
                        else None
                    ),
                }
            )

    preview = (
        df.head(10)
        .fillna("")
        .to_dict(
            orient="records"
        )
    )

    return {
        "filename": file.filename,
        "rows": len(df),
        "columns": list(df.columns),
        "mapping": mapping,
        "missing_columns": missing,
        "ready_for_import": not missing,
        "tenant_resolution": tenant_results,
        "preview": preview,
    }


def validate_payment_import(
    df: pd.DataFrame,
    db: Session,
    mapping: dict[str, str],
) -> dict:
    """
    Validate a payment import without writing
    anything to the database.
    """

    required_targets = {
        "tenant_id",
        "account_number",
        "amount",
        "payment_date",
        "external_reference",
    }

    missing_mapping = [
        target
        for target in required_targets
        if target not in mapping
    ]

    if missing_mapping:
        return {
            "ready_for_import": False,
            "total_rows": len(df),
            "valid_rows": 0,
            "invalid_rows": len(df),
            "missing_mapping": missing_mapping,
            "error_count": 0,
            "errors": [],
            "summary": {
                "unknown_tenants": 0,
                "unknown_accounts": 0,
                "invalid_amounts": 0,
                "invalid_dates": 0,
                "missing_references": 0,
                "duplicate_references_in_file": 0,
                "duplicate_references_in_database": 0,
            },
        }

    errors = []

    unknown_tenants = 0
    unknown_accounts = 0
    invalid_amounts = 0
    invalid_dates = 0
    missing_references = 0
    duplicate_references_in_file = 0
    duplicate_references_in_database = 0

    valid_rows = 0

    seen_references = set()

    # Cache tenant lookups
    tenant_cache = {}

    # Cache account lookups
    account_cache = {}

    for index, row in df.iterrows():

        row_number = index + 2

        row_errors = []

        # -----------------------------------------------------
        # Tenant
        # -----------------------------------------------------

        tenant_value = get_mapped_value(
            row,
            mapping,
            "tenant_id",
        )

        tenant_key = (
            str(tenant_value).strip()
            if tenant_value is not None
            else ""
        )

        tenant = None

        if tenant_key:

            if tenant_key not in tenant_cache:
                tenant_cache[tenant_key] = (
                    resolve_tenant(
                        db,
                        tenant_key,
                    )
                )

            tenant = tenant_cache[
                tenant_key
            ]

        if tenant is None:
            unknown_tenants += 1

            row_errors.append(
                {
                    "field": "tenant_id",
                    "message": (
                        f"Tenant not found: "
                        f"{tenant_value}"
                    ),
                }
            )

        # -----------------------------------------------------
        # Account
        # -----------------------------------------------------

        account_value = get_mapped_value(
            row,
            mapping,
            "account_number",
        )

        account_number = (
            str(account_value).strip()
            if account_value is not None
            else ""
        )

        if not account_number:
            unknown_accounts += 1

            row_errors.append(
                {
                    "field": "account_number",
                    "message": (
                        "Account number is required."
                    ),
                }
            )

        # -----------------------------------------------------
        # Account existence
        # -----------------------------------------------------

        if tenant is not None and account_number:

            account_key = (
                str(tenant.id),
                account_number,
            )

            if account_key not in account_cache:

                account_cache[account_key] = db.scalar(
                    select(MunicipalAccount).where(
                        MunicipalAccount.tenant_id
                        == tenant.id,
                        MunicipalAccount.account_number
                        == account_number,
                    )
                )

            account = account_cache[
                account_key
            ]

            if account is None:
                unknown_accounts += 1

                row_errors.append(
                    {
                        "field": "account_number",
                        "message": (
                            f"Account not found: "
                            f"{account_number}"
                        ),
                    }
                )

        # -----------------------------------------------------
        # Amount
        # -----------------------------------------------------

        amount_value = get_mapped_value(
            row,
            mapping,
            "amount",
        )

        try:
            if amount_value is None:
                raise ValueError()

            amount = Decimal(
                str(amount_value)
                .replace("R", "")
                .replace("r", "")
                .replace(",", "")
                .strip()
            )

            if amount <= Decimal("0.00"):
                raise ValueError()

        except (
            InvalidOperation,
            ValueError,
            AttributeError,
        ):

            invalid_amounts += 1

            row_errors.append(
                {
                    "field": "amount",
                    "message": (
                        "Invalid payment amount."
                    ),
                }
            )

        # -----------------------------------------------------
        # Payment date
        # -----------------------------------------------------

        payment_date_value = get_mapped_value(
            row,
            mapping,
            "payment_date",
        )

        parsed_date = pd.to_datetime(
            payment_date_value,
            errors="coerce",
        )

        if pd.isna(parsed_date):

            invalid_dates += 1

            row_errors.append(
                {
                    "field": "payment_date",
                    "message": (
                        "Invalid payment date."
                    ),
                }
            )

        # -----------------------------------------------------
        # External reference
        # -----------------------------------------------------

        reference_value = get_mapped_value(
            row,
            mapping,
            "external_reference",
        )

        external_reference = (
            str(reference_value).strip()
            if reference_value is not None
            else ""
        )

        if not external_reference:

            missing_references += 1

            row_errors.append(
                {
                    "field": "external_reference",
                    "message": (
                        "External reference "
                        "is required."
                    ),
                }
            )

        # -----------------------------------------------------
        # Duplicate references within file
        # -----------------------------------------------------

        if external_reference:

            if external_reference in seen_references:

                duplicate_references_in_file += 1

                row_errors.append(
                    {
                        "field": "external_reference",
                        "message": (
                            "Duplicate reference "
                            "within import file."
                        ),
                    }
                )

            else:
                seen_references.add(
                    external_reference
                )

        # -----------------------------------------------------
        # Duplicate references within database
        # -----------------------------------------------------

        if (
            tenant is not None
            and external_reference
        ):

            existing_payment = db.scalar(
                select(Payment).where(
                    Payment.tenant_id == tenant.id,
                    Payment.external_reference
                    == external_reference,
                )
            )

            if existing_payment:

                duplicate_references_in_database += 1

                row_errors.append(
                    {
                        "field": "external_reference",
                        "message": (
                            "Payment reference already "
                            "exists in the database."
                        ),
                    }
                )

        # -----------------------------------------------------
        # Row result
        # -----------------------------------------------------

        if row_errors:

            errors.append(
                {
                    "row": row_number,
                    "status": "INVALID",
                    "errors": row_errors,
                }
            )

        else:
            valid_rows += 1

    invalid_rows = (
        len(df) - valid_rows
    )

    return {
        "ready_for_import": (
            invalid_rows == 0
            and not missing_mapping
        ),
        "total_rows": len(df),
        "valid_rows": valid_rows,
        "invalid_rows": invalid_rows,
        "missing_mapping": missing_mapping,
        "error_count": len(errors),
        "summary": {
            "unknown_tenants": (
                unknown_tenants
            ),
            "unknown_accounts": (
                unknown_accounts
            ),
            "invalid_amounts": (
                invalid_amounts
            ),
            "invalid_dates": (
                invalid_dates
            ),
            "missing_references": (
                missing_references
            ),
            "duplicate_references_in_file": (
                duplicate_references_in_file
            ),
            "duplicate_references_in_database": (
                duplicate_references_in_database
            ),
        },
        "errors": errors[:100],
    }


@router.post("/import/validate")
async def validate_payment_import_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    content = await file.read()

    filename = (
        file.filename or ""
    ).lower()

    # ---------------------------------------------------------
    # Read file
    # ---------------------------------------------------------

    try:

        if filename.endswith(".csv"):

            df = pd.read_csv(
                io.BytesIO(content)
            )

        elif filename.endswith(".xlsx"):

            df = pd.read_excel(
                io.BytesIO(content)
            )

        else:

            raise HTTPException(
                status_code=400,
                detail=(
                    "Only CSV and XLSX files "
                    "are supported."
                ),
            )

    except HTTPException:
        raise

    except Exception as exc:

        raise HTTPException(
            status_code=400,
            detail=(
                f"Could not read file: {exc}"
            ),
        ) from exc

    # ---------------------------------------------------------
    # Normalise columns
    # ---------------------------------------------------------

    df = normalise_columns(df)

    # ---------------------------------------------------------
    # Automatic mapping
    # ---------------------------------------------------------

    mapping = build_column_mapping(
        list(df.columns)
    )

    # ---------------------------------------------------------
    # Validate
    # ---------------------------------------------------------

    validation = validate_payment_import(
        df=df,
        db=db,
        mapping=mapping,
    )

    return {
        "filename": file.filename,
        "mapping": mapping,
        **validation,
    }


from app.schemas.payment_import import (
    PaymentImportApproval,
)


@router.post("/import/commit")
async def commit_payment_import(
    file: UploadFile = File(...),
    approved: bool = Form(...),
    approved_by: str = Form(...),
    confirmation: str = Form(...),
    db: Session = Depends(get_db),
):
    # ---------------------------------------------------------
    # Approval gate
    # ---------------------------------------------------------

    if not approved:
        raise HTTPException(
            status_code=400,
            detail=(
                "Import was not approved."
            ),
        )

    if not approved_by.strip():
        raise HTTPException(
            status_code=400,
            detail=(
                "approved_by is required."
            ),
        )

    if confirmation.strip().upper() != "IMPORT":
        raise HTTPException(
            status_code=400,
            detail=(
                "Import confirmation is required. "
                "Enter IMPORT to continue."
            ),
        )

    # ---------------------------------------------------------
    # Read file
    # ---------------------------------------------------------

    content = await file.read()

    filename = (
        file.filename or ""
    ).lower()

    try:

        if filename.endswith(".csv"):

            df = pd.read_csv(
                io.BytesIO(content)
            )

        elif filename.endswith(".xlsx"):

            df = pd.read_excel(
                io.BytesIO(content)
            )

        else:

            raise HTTPException(
                status_code=400,
                detail=(
                    "Only CSV and XLSX files "
                    "are supported."
                ),
            )

    except HTTPException:
        raise

    except Exception as exc:

        raise HTTPException(
            status_code=400,
            detail=(
                f"Could not read file: {exc}"
            ),
        ) from exc

    # ---------------------------------------------------------
    # Normalise
    # ---------------------------------------------------------

    df = normalise_columns(df)

    # ---------------------------------------------------------
    # Build mapping
    # ---------------------------------------------------------

    mapping = build_column_mapping(
        list(df.columns)
    )

    # ---------------------------------------------------------
    # HARD VALIDATION GATE
    # ---------------------------------------------------------

    validation = validate_payment_import(
        df=df,
        db=db,
        mapping=mapping,
    )

    if not validation["ready_for_import"]:

        raise HTTPException(
            status_code=409,
            detail={
                "message": (
                    "Import blocked because "
                    "pre-flight validation failed."
                ),
                "validation": validation,
            },
        )

    # ---------------------------------------------------------
    # Only now may records be posted
    # ---------------------------------------------------------

    imported = 0
    duplicates = 0
    rejected = 0

    errors = []
    imported_payment_ids = []

    # ---------------------------------------------------------
    # Process validated rows
    # ---------------------------------------------------------

    for index, row in df.iterrows():

        row_number = index + 2

        try:

            tenant_value = get_mapped_value(
                row,
                mapping,
                "tenant_id",
            )

            tenant = resolve_tenant(
                db,
                tenant_value,
            )

            if tenant is None:
                raise ValueError(
                    f"Tenant not found: "
                    f"{tenant_value}"
                )

            tenant_id = str(
                tenant.id
            )

            # -------------------------------------------------
            # Account
            # -------------------------------------------------

            account_number = get_mapped_value(
                row,
                mapping,
                "account_number",
            )

            account_number = str(
                account_number
            ).strip()

            # -------------------------------------------------
            # Amount
            # -------------------------------------------------

            amount_value = get_mapped_value(
                row,
                mapping,
                "amount",
            )

            amount = Decimal(
                str(amount_value)
                .replace("R", "")
                .replace("r", "")
                .replace(",", "")
                .strip()
            )

            # -------------------------------------------------
            # Date
            # -------------------------------------------------

            payment_date_value = (
                get_mapped_value(
                    row,
                    mapping,
                    "payment_date",
                )
            )

            parsed_date = pd.to_datetime(
                payment_date_value,
                errors="coerce",
            )

            payment_date = (
                parsed_date.date()
            )

            # -------------------------------------------------
            # Reference
            # -------------------------------------------------

            external_reference = (
                get_mapped_value(
                    row,
                    mapping,
                    "external_reference",
                )
            )

            external_reference = str(
                external_reference
            ).strip()

            # -------------------------------------------------
            # Savepoint
            # -------------------------------------------------

            savepoint = db.begin_nested()

            try:

                payment = record_payment(
                    db,
                    tenant_id=tenant_id,
                    account_number=account_number,
                    amount=amount,
                    payment_date=payment_date,
                    external_reference=(
                        external_reference
                    ),
                    actor=approved_by.strip(),
                )

                savepoint.commit()

                imported += 1

                imported_payment_ids.append(
                    str(payment.id)
                )

            except PaymentDuplicateError as exc:

                savepoint.rollback()

                duplicates += 1

                errors.append(
                    {
                        "row": row_number,
                        "status": "DUPLICATE",
                        "external_reference": (
                            external_reference
                        ),
                        "message": str(exc),
                    }
                )

            except (
                PaymentValidationError,
                PaymentAccountNotFoundError,
            ) as exc:

                savepoint.rollback()

                rejected += 1

                errors.append(
                    {
                        "row": row_number,
                        "status": "REJECTED",
                        "message": str(exc),
                    }
                )

            except Exception as exc:

                savepoint.rollback()

                rejected += 1

                errors.append(
                    {
                        "row": row_number,
                        "status": "REJECTED",
                        "message": str(exc),
                    }
                )

        except Exception as exc:

            rejected += 1

            errors.append(
                {
                    "row": row_number,
                    "status": "REJECTED",
                    "message": str(exc),
                }
            )

    # ---------------------------------------------------------
    # Commit successful import
    # ---------------------------------------------------------

    db.commit()

    return {
        "success": True,
        "approved": True,
        "approved_by": approved_by.strip(),
        "filename": file.filename,
        "total_rows": len(df),
        "imported": imported,
        "duplicates": duplicates,
        "rejected": rejected,
        "errors": errors[:100],
        "error_count": len(errors),
        "imported_payment_ids": (
            imported_payment_ids
        ),
    }


@router.post("/import")
async def import_payments(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    raise HTTPException(
        status_code=410,
        detail={
            "message": (
                "Direct payment import is disabled. "
                "Use /payments/import/validate "
                "followed by /payments/import/commit."
            ),
            "workflow": [
                "/payments/import/preview",
                "/payments/import/mapping",
                "/payments/import/validate",
                "/payments/import/commit",
            ],
        },
    )
