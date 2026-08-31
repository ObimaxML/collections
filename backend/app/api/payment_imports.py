import io
import json
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

import pandas as pd
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.db.session import get_db
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


async def process_payment_import(
    file: UploadFile,
    db: Session,
    mapping_override: dict[str, str] | None = None,
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

    # ---------------------------------------------------------
    # Build or use supplied mapping
    # ---------------------------------------------------------
    automatic_mapping = build_column_mapping(
        list(df.columns)
    )

    mapping = automatic_mapping.copy()

    if mapping_override:
        for target, source in mapping_override.items():
            if source in df.columns:
                mapping[target] = source

    required_targets = {
        "tenant_id",
        "account_number",
        "amount",
        "payment_date",
        "external_reference",
    }

    missing = [
        target
        for target in required_targets
        if target not in mapping
    ]

    if missing:
        raise HTTPException(
            status_code=400,
            detail={
                "message": (
                    "Required payment fields "
                    "could not be mapped."
                ),
                "missing_fields": missing,
                "mapping": mapping,
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

    # ---------------------------------------------------------
    # Process rows
    # ---------------------------------------------------------
    for index, row in df.iterrows():

        row_number = index + 2

        try:
            tenant_value = get_mapped_value(
                row,
                mapping,
                "tenant_id",
            )

            account_number = get_mapped_value(
                row,
                mapping,
                "account_number",
            )

            amount_value = get_mapped_value(
                row,
                mapping,
                "amount",
            )

            payment_date_value = get_mapped_value(
                row,
                mapping,
                "payment_date",
            )

            external_reference = get_mapped_value(
                row,
                mapping,
                "external_reference",
            )

            # -------------------------------------------------
            # Tenant
            # -------------------------------------------------
            tenant = resolve_tenant(
                db,
                tenant_value,
            )

            if tenant is None:
                raise ValueError(
                    f"Tenant not found: "
                    f"{tenant_value}"
                )

            tenant_id = str(tenant.id)

            # -------------------------------------------------
            # Account
            # -------------------------------------------------
            if not account_number:
                raise ValueError(
                    "account_number is required."
                )

            account_number = str(
                account_number
            ).strip()

            # -------------------------------------------------
            # Reference
            # -------------------------------------------------
            if not external_reference:
                raise ValueError(
                    "external_reference is required."
                )

            external_reference = str(
                external_reference
            ).strip()

            # -------------------------------------------------
            # Amount
            # -------------------------------------------------
            try:
                amount = Decimal(
                    str(amount_value)
                    .replace("R", "")
                    .replace("r", "")
                    .replace(",", "")
                    .strip()
                )
            except (
                InvalidOperation,
                ValueError,
                AttributeError,
            ) as exc:
                raise ValueError(
                    "Invalid payment amount."
                ) from exc

            if amount <= Decimal("0.00"):
                raise ValueError(
                    "Payment amount must be "
                    "greater than zero."
                )

            # -------------------------------------------------
            # Payment date
            # -------------------------------------------------
            parsed_date = pd.to_datetime(
                payment_date_value,
                errors="coerce",
            )

            if pd.isna(parsed_date):
                raise ValueError(
                    "Invalid payment date."
                )

            payment_date = (
                parsed_date.date()
            )

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

    db.commit()

    return {
        "success": True,
        "filename": file.filename,
        "mapping": mapping,
        "total_rows": total_rows,
        "imported": imported,
        "duplicates": duplicates,
        "rejected": rejected,
        "errors": errors,
        "imported_payment_ids": (
            imported_payment_ids
        ),
    }


@router.post("/import")
async def import_payments(
    file: UploadFile = File(...),
    mapping: str | None = Form(None),
    db: Session = Depends(get_db),
):
    mapping_override = None

    if mapping:
        try:
            mapping_override = json.loads(
                mapping
            )
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Invalid mapping JSON."
                ),
            ) from exc

    return await process_payment_import(
        file=file,
        db=db,
        mapping_override=mapping_override,
    )
