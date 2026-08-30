import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import FinancialTransaction


def create_transaction(
    db: Session,
    *,
    tenant_id: UUID,
    account_id: UUID,
    transaction_type: str,
    amount: Decimal,
    transaction_date: date,
    reference: str | None = None,
    description: str | None = None,
    source_type: str | None = None,
    source_id: UUID | None = None,
    created_by: str = "system",
):
    if amount <= Decimal("0"):
        raise ValueError(
            "Transaction amount must be greater than zero."
        )

    transaction = FinancialTransaction(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        account_id=account_id,
        transaction_type=transaction_type,
        transaction_date=transaction_date,
        amount=amount,
        reference=reference,
        description=description,
        source_type=source_type,
        source_id=source_id,
        created_at=datetime.now(timezone.utc),
        created_by=created_by,
    )

    db.add(transaction)
    db.flush()

    return transaction


def get_account_transactions(
    db: Session,
    *,
    account_id: UUID,
):
    return list(
        db.scalars(
            select(FinancialTransaction)
            .where(
                FinancialTransaction.account_id
                == account_id
            )
            .order_by(
                FinancialTransaction.transaction_date.asc(),
                FinancialTransaction.created_at.asc(),
            )
        ).all()
    )


def get_account_ledger_balance(
    db: Session,
    *,
    account_id: UUID,
):
    transactions = get_account_transactions(
        db=db,
        account_id=account_id,
    )

    balance = Decimal("0.00")

    for transaction in transactions:

        if transaction.transaction_type in {
            "OPENING_BALANCE",
            "CHARGE",
            "DEBIT",
            "ADJUSTMENT_DEBIT",
        }:
            balance += transaction.amount

        elif transaction.transaction_type in {
            "PAYMENT",
            "CREDIT",
            "ADJUSTMENT_CREDIT",
        }:
            balance -= transaction.amount

    return balance


def transaction_exists_for_source(
    db: Session,
    *,
    source_type: str,
    source_id: UUID,
):
    return db.scalar(
        select(FinancialTransaction.id)
        .where(
            FinancialTransaction.source_type
            == source_type,
            FinancialTransaction.source_id
            == source_id,
        )
        .limit(1)
    ) is not None


def create_payment_transaction(
    db: Session,
    *,
    payment,
    created_by: str = "system",
):
    if transaction_exists_for_source(
        db=db,
        source_type="Payment",
        source_id=payment.id,
    ):
        return None

    return create_transaction(
        db=db,
        tenant_id=payment.tenant_id,
        account_id=payment.account_id,
        transaction_type="PAYMENT",
        amount=payment.amount,
        transaction_date=payment.payment_date,
        reference=payment.external_reference,
        description="Payment reconciled to municipal account",
        source_type="Payment",
        source_id=payment.id,
        created_by=created_by,
    )
