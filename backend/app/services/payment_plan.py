import uuid
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from app.models import (
    AuditEvent,
    CollectionCase,
    PaymentPlan,
)


ALLOWED_FREQUENCIES = {
    "WEEKLY",
    "FORTNIGHTLY",
    "MONTHLY",
}


def create_payment_plan(
    db: Session,
    *,
    case_id: UUID,
    deposit_amount: Decimal,
    installment_amount: Decimal,
    frequency: str,
    number_of_installments: int,
    start_date,
    actor: str,
):
    case = db.get(
        CollectionCase,
        case_id,
    )

    if not case:
        raise ValueError(
            "Collection case not found."
        )

    if case.status in {
        "CLOSED",
        "PAID",
    }:
        raise ValueError(
            "Cannot create a payment plan "
            "for a closed or paid case."
        )

    if deposit_amount < 0:
        raise ValueError(
            "Deposit amount cannot be negative."
        )

    if installment_amount <= 0:
        raise ValueError(
            "Installment amount must be greater than zero."
        )

    if number_of_installments <= 0:
        raise ValueError(
            "Number of installments must be greater than zero."
        )

    frequency = frequency.upper()

    if frequency not in ALLOWED_FREQUENCIES:
        raise ValueError(
            "Frequency must be WEEKLY, "
            "FORTNIGHTLY or MONTHLY."
        )

    now = datetime.now(timezone.utc)

    plan = PaymentPlan(
        id=uuid.uuid4(),
        case_id=case.id,
        deposit_amount=deposit_amount,
        installment_amount=installment_amount,
        frequency=frequency,
        number_of_installments=number_of_installments,
        status="ACTIVE",
        start_date=start_date,
    )

    db.add(plan)

    previous_status = case.status

    case.status = "ARRANGEMENT"

    audit_event = AuditEvent(
        id=uuid.uuid4(),
        tenant_id=case.tenant_id,
        actor=actor,
        event_type="PAYMENT_PLAN_CREATED",
        entity_type="CollectionCase",
        entity_id=case.id,
        payload={
            "payment_plan_id": str(plan.id),
            "deposit_amount": str(
                deposit_amount
            ),
            "installment_amount": str(
                installment_amount
            ),
            "frequency": frequency,
            "number_of_installments": (
                number_of_installments
            ),
            "start_date": str(start_date),
            "previous_case_status": previous_status,
            "new_case_status": case.status,
        },
        created_at=now,
    )

    db.add(audit_event)

    db.commit()
    db.refresh(plan)

    return plan
