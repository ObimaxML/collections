import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    AuditEvent,
    ImportBatch,
    ImportRow,
    MunicipalAccount,
)
from app.schemas.ledger_import import (
    LedgerTransactionImport,
)
from app.services.ledger_import import (
    import_ledger_transaction,
)


ALLOWED_TYPES = {
    "CHARGE",
    "PAYMENT",
    "CREDIT",
    "DEBIT",
    "ADJUSTMENT_CREDIT",
    "ADJUSTMENT_DEBIT",
}


def create_import_batch(
    db: Session,
    *,
    tenant_id: UUID,
    file_name: str,
    source_type: str,
    created_by: str,
    rows: list[dict],
):
    now = datetime.now(timezone.utc)

    batch = ImportBatch(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        file_name=file_name,
        source_type=source_type,
        status="VALIDATING",
        total_rows=len(rows),
        valid_rows=0,
        invalid_rows=0,
        imported_rows=0,
        created_by=created_by,
        created_at=now,
    )

    db.add(batch)

    for index, row in enumerate(rows, start=1):
        raw_date = row.get("transaction_date")
        if isinstance(raw_date, str):
            parsed_date = date.fromisoformat(raw_date)
        else:
            parsed_date = raw_date

        raw_amount = row.get("amount")
        if raw_amount is not None and not isinstance(raw_amount, Decimal):
            parsed_amount = Decimal(str(raw_amount))
        else:
            parsed_amount = raw_amount

        raw_source_id = row.get("source_id")
        if isinstance(raw_source_id, str):
            parsed_source_id = UUID(raw_source_id)
        else:
            parsed_source_id = raw_source_id

        import_row = ImportRow(
            id=uuid.uuid4(),
            batch_id=batch.id,
            tenant_id=tenant_id,
            row_number=index,
            account_number=row.get("account_number"),
            transaction_type=row.get("transaction_type"),
            transaction_date=parsed_date,
            amount=parsed_amount,
            reference=row.get("reference"),
            description=row.get("description"),
            source_type=row.get("source_type", source_type),
            source_id=parsed_source_id,
            status="PENDING",
            created_at=now,
        )

        db.add(import_row)

    db.commit()

    return batch


def validate_import_batch(
    db: Session,
    *,
    batch_id: UUID,
):
    batch = db.scalar(
        select(ImportBatch)
        .where(
            ImportBatch.id == batch_id
        )
    )

    if batch is None:
        raise ValueError(
            "Import batch not found."
        )

    rows = list(
        db.scalars(
            select(ImportRow)
            .where(
                ImportRow.batch_id == batch_id
            )
            .order_by(
                ImportRow.row_number
            )
        ).all()
    )

    valid = 0
    invalid = 0

    for row in rows:
        errors = []

        if not row.account_number:
            errors.append(
                "account_number is required"
            )

        if not row.transaction_type:
            errors.append(
                "transaction_type is required"
            )
        elif (
            row.transaction_type.upper()
            not in ALLOWED_TYPES
        ):
            errors.append(
                "unsupported transaction_type"
            )

        if row.transaction_date is None:
            errors.append(
                "transaction_date is required"
            )

        if (
            row.amount is None
            or row.amount <= Decimal("0.00")
        ):
            errors.append(
                "amount must be greater than zero"
            )

        if not row.source_id:
            errors.append(
                "source_id is required"
            )

        if errors:
            row.status = "INVALID"
            row.validation_error = "; ".join(
                errors
            )
            invalid += 1
        else:
            row.status = "VALID"
            row.validation_error = None
            valid += 1

    batch.valid_rows = valid
    batch.invalid_rows = invalid
    batch.status = (
        "VALIDATED"
        if invalid == 0
        else "VALIDATION_ERRORS"
    )

    db.commit()

    return {
        "batch_id": batch.id,
        "total_rows": len(rows),
        "valid_rows": valid,
        "invalid_rows": invalid,
        "status": batch.status,
    }


def resolve_account(
    db: Session,
    *,
    tenant_id: UUID,
    account_number: str,
):
    return db.scalar(
        select(MunicipalAccount)
        .where(
            MunicipalAccount.tenant_id
            == tenant_id,
            MunicipalAccount.account_number
            == account_number,
        )
        .limit(1)
    )


def import_validated_batch(
    db: Session,
    *,
    batch_id: UUID,
):
    batch = db.scalar(
        select(ImportBatch)
        .where(
            ImportBatch.id == batch_id
        )
    )

    if batch is None:
        raise ValueError(
            "Import batch not found."
        )

    if batch.status != "VALIDATED":
        raise ValueError(
            "Batch must be fully validated "
            "before import."
        )

    rows = list(
        db.scalars(
            select(ImportRow)
            .where(
                ImportRow.batch_id == batch_id,
                ImportRow.status == "VALID",
            )
            .order_by(
                ImportRow.row_number
            )
        ).all()
    )

    batch.status = "IMPORTING"

    imported = 0

    for row in rows:
        account = resolve_account(
            db=db,
            tenant_id=batch.tenant_id,
            account_number=row.account_number,
        )

        if account is None:
            row.status = "INVALID"
            row.validation_error = (
                "Municipal account not found."
            )
            batch.invalid_rows += 1
            continue

        payload = LedgerTransactionImport(
            account_id=account.id,
            transaction_type=row.transaction_type,
            transaction_date=row.transaction_date,
            amount=row.amount,
            reference=row.reference,
            description=row.description,
            source_type=row.source_type,
            source_id=row.source_id,
            created_by=batch.created_by
            or "batch-import",
        )

        result = import_ledger_transaction(
            db=db,
            tenant_id=batch.tenant_id,
            payload=payload,
        )

        row.financial_transaction_id = (
            result["transaction_id"]
        )

        row.status = (
            "IMPORTED"
            if result["created"]
            else "DUPLICATE"
        )

        imported += 1

    batch.imported_rows = imported
    batch.status = "COMPLETED"
    batch.completed_at = (
        datetime.now(timezone.utc)
    )

    db.commit()

    return {
        "batch_id": batch.id,
        "imported_rows": imported,
        "status": batch.status,
    }
