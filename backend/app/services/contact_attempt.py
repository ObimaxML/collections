import uuid
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    AuditEvent,
    CollectionCase,
    ContactAttempt,
)


def create_contact_attempt(
    db: Session,
    *,
    case_id: UUID,
    collector: str,
    channel: str,
    outcome: str,
    notes: str | None,
    next_action_date,
    contacted: bool,
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
            "Cannot record activity against "
            "a closed or paid case."
        )

    if case.assigned_to:
        if case.assigned_to != collector:
            raise ValueError(
                "Case is assigned to another collector."
            )

    now = datetime.now(timezone.utc)

    attempt = ContactAttempt(
        id=uuid.uuid4(),
        case_id=case.id,
        collector=collector,
        channel=channel.upper(),
        outcome=outcome.upper(),
        notes=notes,
        next_action_date=next_action_date,
        contacted=contacted,
        created_at=now,
    )

    db.add(attempt)

    # Move NEW cases into CONTACT_ATTEMPTED.
    if case.status == "NEW":
        case.status = "CONTACT_ATTEMPTED"

    if contacted:
        case.status = "ENGAGED"

    audit_event = AuditEvent(
        id=uuid.uuid4(),
        tenant_id=case.tenant_id,
        actor=collector,
        event_type="CONTACT_ATTEMPT_RECORDED",
        entity_type="ContactAttempt",
        entity_id=attempt.id,
        payload={
            "case_id": str(case.id),
            "collector": collector,
            "channel": channel.upper(),
            "outcome": outcome.upper(),
            "contacted": contacted,
            "next_action_date": (
                str(next_action_date)
                if next_action_date
                else None
            ),
        },
        created_at=now,
    )

    db.add(audit_event)

    db.commit()
    db.refresh(attempt)

    return attempt


def get_case_activity(
    db: Session,
    *,
    case_id: UUID,
):
    query = (
        select(ContactAttempt)
        .where(
            ContactAttempt.case_id == case_id
        )
        .order_by(
            ContactAttempt.created_at.desc()
        )
    )

    return list(
        db.scalars(query).all()
    )
