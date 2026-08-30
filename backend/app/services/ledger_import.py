import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    AuditEvent,
    FinancialTransaction,
    MunicipalAccount,
)
from app.schemas.ledger_import import (
    LedgerTransactionImport,
)


ALLOWED_TRANSACTION_TYPES = {
    "CHARGE",
    "PAYMENT",
    "CREDIT",
    "DEBIT",
    "ADJUSTMENT_CREDIT",
    "ADJUSTMENT_DEBIT",
}


def import_ledger_transaction(
    db: Session,
    *,
    tenant_id: uuid.UUID,
    payload: LedgerTransactionImport,
):
    account = db.scalar(
        select(MunicipalAccount)
        .where(
            MunicipalAccount.id
            == payload.account_id,
            MunicipalAccount.tenant_id
            == tenant_id,
        )
    )

    if account is None:
        raise ValueError(
            "Municipal account not found for tenant."
        )

    transaction_type = (
        payload.transaction_type.upper()
    )

    if transaction_type not in (
        ALLOWED_TRANSACTION_TYPES
    ):
        raise ValueError(
            f"Unsupported transaction type: "
            f"{transaction_type}"
        )

    existing = db.scalar(
        select(FinancialTransaction)
        .where(
            FinancialTransaction.tenant_id
            == tenant_id,
            FinancialTransaction.source_type
            == payload.source_type,
            FinancialTransaction.source_id
            == payload.source_id,
        )
        .limit(1)
    )

    if existing is not None:
        return {
            "created": False,
            "transaction_id": existing.id,
            "message": (
                "Transaction already imported."
            ),
        }

    transaction = FinancialTransaction(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        account_id=account.id,
        transaction_type=transaction_type,
        transaction_date=payload.transaction_date,
        amount=payload.amount,
        reference=payload.reference,
        description=payload.description,
        source_type=payload.source_type,
        source_id=payload.source_id,
        created_at=datetime.now(timezone.utc),
        created_by=payload.created_by,
    )

    db.add(transaction)

    audit = AuditEvent(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        actor=payload.created_by,
        event_type="LEDGER_TRANSACTION_IMPORTED",
        entity_type="FinancialTransaction",
        entity_id=transaction.id,
        payload={
            "account_id": str(account.id),
            "transaction_type": transaction_type,
            "amount": str(payload.amount),
            "source_type": payload.source_type,
            "source_id": str(payload.source_id),
        },
        created_at=datetime.now(timezone.utc),
    )

    db.add(audit)

    db.commit()

    return {
        "created": True,
        "transaction_id": transaction.id,
        "message": "Transaction imported.",
    }
