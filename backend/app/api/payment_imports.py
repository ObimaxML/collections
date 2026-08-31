import io
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.db.session import get_db
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


@router.post("/import/preview")
async def preview_payment_import(
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

    mapping, missing = validate_mapping(
        list(df.columns)
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
        "preview": preview,
    }


@router.post("/import")
async def import_payments(
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
            detail=f"Could not read file: {exc}",
        ) from exc

    df = normalise_columns(df)

    mapping, missing = validate_mapping(list(df.columns))

    if missing:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Missing required columns.",
                "missing_columns": sorted(missing),
                "required_columns": sorted(
                    REQUIRED_COLUMNS
                ),
            },
        )

    # ---------------------------------------------------------
    # Counters
    # ---------------------------------------------------------
    total_rows = len(df)
    imported = 0
    duplicates = 0
    rejected = 0

    errors = []
    imported_payment_ids = []

    # Cache for tenant lookups (id, code, or name)
    from app.models import Tenant
    from sqlalchemy import select
    all_tenants = db.scalars(select(Tenant)).all()
    tenant_lookup = {}
    for t in all_tenants:
        tenant_lookup[str(t.id).lower()] = str(t.id)
        if t.code:
            tenant_lookup[str(t.code).lower()] = str(t.id)
        if t.name:
            tenant_lookup[str(t.name).lower()] = str(t.id)

    # ---------------------------------------------------------
    # Process rows
    # ---------------------------------------------------------
    for index, row in df.iterrows():

        row_number = index + 2

        try:
            raw_tenant = str(row[mapping["tenant_id"]]).strip()
            account_number = str(row[mapping["account_number"]]).strip()
            external_reference = str(row[mapping["external_reference"]]).strip()
            raw_amount = row[mapping["amount"]]
            raw_date = row[mapping["payment_date"]]

            # -------------------------------------------------
            # Validate required values & resolve tenant
            # -------------------------------------------------
            if not raw_tenant:
                raise ValueError("tenant_id / tenant_code is required.")

            resolved_tenant_id = tenant_lookup.get(raw_tenant.lower(), raw_tenant)

            if not account_number:
                raise ValueError(
                    "account_number is required."
                )

            if not external_reference:
                raise ValueError(
                    "external_reference is required."
                )

            # -------------------------------------------------
            # Amount
            # -------------------------------------------------
            try:
                clean_amt = str(raw_amount).replace("R", "").replace("$", "").replace(",", "").strip()
                amount = Decimal(clean_amt)
            except (
                InvalidOperation,
                ValueError,
            ) as exc:
                raise ValueError(
                    "Invalid payment amount."
                ) from exc

            # -------------------------------------------------
            # Payment date
            # -------------------------------------------------
            parsed_date = pd.to_datetime(
                raw_date,
                errors="coerce",
            )

            if pd.isna(parsed_date):
                raise ValueError(
                    "Invalid payment date."
                )

            payment_date = parsed_date.date()

            # -------------------------------------------------
            # Savepoint & Record Payment
            # -------------------------------------------------
            savepoint = db.begin_nested()

            try:
                payment = record_payment(
                    db,
                    tenant_id=resolved_tenant_id,
                    account_number=account_number,
                    amount=amount,
                    payment_date=payment_date,
                    external_reference=external_reference,
                    actor="payment_import",
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
                        "external_reference": external_reference,
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
    # Commit all valid payments
    # ---------------------------------------------------------
    db.commit()

    return {
        "filename": file.filename,
        "total_rows": total_rows,
        "imported": imported,
        "duplicates": duplicates,
        "rejected": rejected,
        "payment_ids": imported_payment_ids,
        "errors": errors,
    }
