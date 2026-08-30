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


def normalise_columns(df: pd.DataFrame) -> pd.DataFrame:
    df.columns = [
        str(column).strip().lower().replace(" ", "_")
        for column in df.columns
    ]

    return df


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

    missing = REQUIRED_COLUMNS - set(df.columns)

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

    preview = (
        df.head(10)
        .fillna("")
        .to_dict(orient="records")
    )

    return {
        "filename": file.filename,
        "rows": len(df),
        "columns": list(df.columns),
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

    missing = REQUIRED_COLUMNS - set(df.columns)

    if missing:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Missing required columns.",
                "missing_columns": sorted(missing),
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
            tenant_id = str(
                row["tenant_id"]
            ).strip()

            account_number = str(
                row["account_number"]
            ).strip()

            external_reference = str(
                row["external_reference"]
            ).strip()

            # -------------------------------------------------
            # Validate required values
            # -------------------------------------------------
            if not tenant_id:
                raise ValueError(
                    "tenant_id is required."
                )

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
                amount = Decimal(
                    str(row["amount"])
                )
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
                row["payment_date"],
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
                    tenant_id=tenant_id,
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
