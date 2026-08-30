import uuid
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    AuditEvent,
    CollectionCase,
    MunicipalAccount,
    Payment,
)


def create_payment(
    db: Session,
    *,
    account_id: UUID,
    amount: Decimal,
    payment_date,
    external_reference: str | None,
    actor: str,
):
    account = db.get(
        MunicipalAccount,
        account_id,
    )

    if not account:
        raise ValueError(
            "Municipal account not found."
        )

    if amount <= 0:
        raise ValueError(
            "Payment amount must be greater than zero."
        )

    if external_reference:
        existing = db.scalar(
            select(Payment).where(
                Payment.external_reference
                == external_reference
            )
        )

        if existing:
            raise ValueError(
                "A payment with this external reference "
                "already exists."
            )

    now = datetime.now(timezone.utc)

    payment = Payment(
        id=uuid.uuid4(),
        tenant_id=account.tenant_id,
        account_id=account.id,
        amount=amount,
        payment_date=payment_date,
        external_reference=external_reference,
        reconciliation_status="PENDING",
        posted_at=None,
        created_at=now,
    )

    db.add(payment)

    audit_event = AuditEvent(
        id=uuid.uuid4(),
        tenant_id=account.tenant_id,
        actor=actor,
        event_type="PAYMENT_CREATED",
        entity_type="Payment",
        entity_id=payment.id,
        payload={
            "account_id": str(account.id),
            "amount": str(amount),
            "payment_date": str(payment_date),
            "external_reference": external_reference,
            "reconciliation_status": "PENDING",
        },
        created_at=now,
    )

    db.add(audit_event)

    db.commit()
    db.refresh(payment)

    return payment


def reconcile_payment(
    db: Session,
    *,
    payment_id: UUID,
    actor: str,
):
    payment = db.get(
        Payment,
        payment_id,
    )

    if not payment:
        raise ValueError(
            "Payment not found."
        )

    if payment.reconciliation_status == "RECONCILED":
        raise ValueError(
            "Payment has already been reconciled."
        )

    if payment.reconciliation_status == "REJECTED":
        raise ValueError(
            "A rejected payment cannot be reconciled."
        )

    account = db.get(
        MunicipalAccount,
        payment.account_id,
    )

    if not account:
        raise ValueError(
            "Municipal account not found."
        )

    now = datetime.now(timezone.utc)

    previous_balance = account.balance
    previous_arrears = account.arrears

    # Apply payment to account.
    account.balance = max(
        Decimal("0.00"),
        account.balance - payment.amount,
    )

    account.arrears = max(
        Decimal("0.00"),
        account.arrears - payment.amount,
    )

    account.last_payment_date = payment.payment_date
    account.last_payment_amount = payment.amount

    payment.reconciliation_status = "RECONCILED"
    payment.posted_at = now

    # Find an active collection case for the account.
    case = db.scalar(
        select(CollectionCase)
        .where(
            CollectionCase.account_id
            == account.id,
            CollectionCase.status.notin_(
                ["CLOSED", "PAID"]
            ),
        )
        .order_by(
            CollectionCase.opened_at.desc()
        )
    )

    previous_case_status = None

    if case:
        previous_case_status = case.status

        if account.arrears <= 0:
            case.status = "PAID"
        else:
            case.status = "PAYING"

    audit_event = AuditEvent(
        id=uuid.uuid4(),
        tenant_id=payment.tenant_id,
        actor=actor,
        event_type="PAYMENT_RECONCILED",
        entity_type="Payment",
        entity_id=payment.id,
        payload={
            "account_id": str(account.id),
            "amount": str(payment.amount),
            "previous_balance": str(
                previous_balance
            ),
            "new_balance": str(
                account.balance
            ),
            "previous_arrears": str(
                previous_arrears
            ),
            "new_arrears": str(
                account.arrears
            ),
            "case_id": (
                str(case.id)
                if case
                else None
            ),
            "previous_case_status": (
                previous_case_status
            ),
            "new_case_status": (
                case.status
                if case
                else None
            ),
        },
        created_at=now,
    )

    db.add(audit_event)

    db.commit()
    db.refresh(payment)

    return payment
