import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    AuditEvent,
    FinancialTransaction,
    Payment,
)


def backfill_reconciled_payments(
    db: Session,
    *,
    actor: str = "ledger-backfill",
):
    payments = list(
        db.scalars(
            select(Payment)
            .where(
                Payment.reconciliation_status
                == "RECONCILED"
            )
            .order_by(Payment.created_at.asc())
        ).all()
    )

    created = 0
    skipped = 0

    for payment in payments:

        # Payments without an account cannot be posted
        # to an account ledger.
        if payment.account_id is None:
            skipped += 1
            continue

        existing = db.scalar(
            select(FinancialTransaction.id)
            .where(
                FinancialTransaction.source_type
                == "Payment",
                FinancialTransaction.source_id
                == payment.id,
            )
            .limit(1)
        )

        if existing is not None:
            skipped += 1
            continue

        transaction = FinancialTransaction(
            id=uuid.uuid4(),
            tenant_id=payment.tenant_id,
            account_id=payment.account_id,
            transaction_type="PAYMENT",
            transaction_date=payment.payment_date,
            amount=payment.amount,
            reference=payment.external_reference,
            description=(
                "Historical reconciled payment "
                "posted during ledger backfill"
            ),
            source_type="Payment",
            source_id=payment.id,
            created_at=datetime.now(timezone.utc),
            created_by=actor,
        )

        db.add(transaction)

        audit = AuditEvent(
            id=uuid.uuid4(),
            tenant_id=payment.tenant_id,
            actor=actor,
            event_type="PAYMENT_LEDGER_BACKFILLED",
            entity_type="Payment",
            entity_id=payment.id,
            payload={
                "payment_amount": str(
                    payment.amount
                ),
                "account_id": str(
                    payment.account_id
                ),
                "ledger_transaction_id": str(
                    transaction.id
                ),
            },
            created_at=datetime.now(timezone.utc),
        )

        db.add(audit)

        created += 1

    db.commit()

    return {
        "total_reconciled_payments": len(payments),
        "created": created,
        "skipped": skipped,
    }
