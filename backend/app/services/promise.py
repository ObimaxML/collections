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
    Promise,
)


VALID_STATUSES = {
    "PENDING",
    "KEPT",
    "BROKEN",
    "CANCELLED",
}


def create_promise(
    db: Session,
    *,
    case_id: UUID,
    amount: Decimal,
    due_date,
    collector: str,
    notes: str | None = None,
):
    case = db.get(
        CollectionCase,
        case_id,
    )

    if not case:
        raise ValueError(
            "Collection case not found."
        )

    if case.status in ["PAID", "CLOSED"]:
        raise ValueError(
            "Cannot create a promise for a "
            "paid or closed case."
        )

    if amount <= 0:
        raise ValueError(
            "Promise amount must be greater than zero."
        )

    if due_date < datetime.now().date():
        raise ValueError(
            "Promise due date cannot be in the past."
        )

    account = db.get(
        MunicipalAccount,
        case.account_id,
    )

    if not account:
        raise ValueError(
            "Municipal account not found."
        )

    if amount > account.arrears:
        raise ValueError(
            "Promise amount cannot exceed "
            "the account arrears."
        )

    existing = db.scalar(
        select(Promise)
        .where(
            Promise.case_id == case_id,
            Promise.status == "PENDING",
        )
    )

    if existing:
        raise ValueError(
            "This case already has a pending promise."
        )

    now = datetime.now(timezone.utc)

    promise = Promise(
        id=uuid.uuid4(),
        case_id=case.id,
        amount=amount,
        due_date=due_date,
        status="PENDING",
        created_at=now,
    )

    db.add(promise)

    case.status = "PROMISE_TO_PAY"

    audit_event = AuditEvent(
        id=uuid.uuid4(),
        tenant_id=case.tenant_id,
        actor=collector,
        event_type="PROMISE_CREATED",
        entity_type="Promise",
        entity_id=promise.id,
        payload={
            "case_id": str(case.id),
            "amount": str(amount),
            "due_date": str(due_date),
            "collector": collector,
            "notes": notes,
        },
        created_at=now,
    )

    db.add(audit_event)

    db.commit()
    db.refresh(promise)

    return promise


def update_promise_status(
    db: Session,
    *,
    promise_id: UUID,
    status: str,
    actor: str,
):
    status = status.upper()

    if status not in VALID_STATUSES:
        raise ValueError(
            f"Invalid promise status: {status}"
        )

    promise = db.get(
        Promise,
        promise_id,
    )

    if not promise:
        raise ValueError(
            "Promise not found."
        )

    if promise.status in [
        "KEPT",
        "BROKEN",
        "CANCELLED",
    ]:
        raise ValueError(
            "This promise has already been finalized."
        )

    case = db.get(
        CollectionCase,
        promise.case_id,
    )

    if not case:
        raise ValueError(
            "Collection case not found."
        )

    promise.status = status

    if status == "KEPT":
        case.status = "PAYING"

    elif status == "BROKEN":
        case.status = "BROKEN_PROMISE"

    elif status == "CANCELLED":
        case.status = "ENGAGED"

    now = datetime.now(timezone.utc)

    audit_event = AuditEvent(
        id=uuid.uuid4(),
        tenant_id=case.tenant_id,
        actor=actor,
        event_type="PROMISE_STATUS_UPDATED",
        entity_type="Promise",
        entity_id=promise.id,
        payload={
            "case_id": str(case.id),
            "old_status": "PENDING",
            "new_status": status,
        },
        created_at=now,
    )

    db.add(audit_event)

    db.commit()
    db.refresh(promise)

    return promise


def get_case_promises(
    db: Session,
    *,
    case_id: UUID,
):
    query = (
        select(Promise)
        .where(
            Promise.case_id == case_id
        )
        .order_by(
            Promise.created_at.desc()
        )
    )

    return list(
        db.scalars(query).all()
    )
