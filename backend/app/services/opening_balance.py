import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    AuditEvent,
    FinancialTransaction,
    MunicipalAccount,
)


def backfill_opening_balances(
    db: Session,
    *,
    actor: str = "opening-balance-backfill",
):
    accounts = list(
        db.scalars(
            select(MunicipalAccount)
            .order_by(
                MunicipalAccount.account_number
            )
        ).all()
    )

    created = 0
    skipped = 0
    zero_balance = 0

    for account in accounts:

        # Never create an opening balance twice.
        existing = db.scalar(
            select(FinancialTransaction.id)
            .where(
                FinancialTransaction.account_id
                == account.id,
                FinancialTransaction.transaction_type
                == "OPENING_BALANCE",
            )
            .limit(1)
        )

        if existing is not None:
            skipped += 1
            continue

        balance = (
            account.balance
            if account.balance is not None
            else Decimal("0.00")
        )

        if balance == Decimal("0.00"):
            zero_balance += 1

        transaction = FinancialTransaction(
            id=uuid.uuid4(),
            tenant_id=account.tenant_id,
            account_id=account.id,
            transaction_type="OPENING_BALANCE",
            transaction_date=datetime.now(
                timezone.utc
            ).date(),
            amount=abs(balance),
            reference=(
                f"OPENING-{account.account_number}"
            ),
            description=(
                "Opening balance imported from "
                "municipal account at onboarding"
            ),
            source_type="MunicipalAccount",
            source_id=account.id,
            created_at=datetime.now(timezone.utc),
            created_by=actor,
        )

        db.add(transaction)

        audit = AuditEvent(
            id=uuid.uuid4(),
            tenant_id=account.tenant_id,
            actor=actor,
            event_type="OPENING_BALANCE_CREATED",
            entity_type="MunicipalAccount",
            entity_id=account.id,
            payload={
                "account_number": (
                    account.account_number
                ),
                "opening_balance": str(balance),
                "ledger_amount": str(
                    abs(balance)
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
        "total_accounts": len(accounts),
        "created": created,
        "skipped": skipped,
        "zero_balance": zero_balance,
    }
