import uuid
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from app.models import (
    AuditEvent,
    CollectionActivity,
    CollectionCase,
)


def create_collection_activity(
    db: Session,
    *,
    case_id: UUID,
    actor: str,
    channel: str,
    outcome: str,
    successful: bool,
    notes: str | None,
    next_action: str | None,
    next_action_date,
):
    case = db.get(
        CollectionCase,
        case_id,
    )

    if not case:
        raise ValueError(
            "Collection case not found."
        )

    if case.status == "CLOSED":
        raise ValueError(
            "Cannot add activity to a closed case."
        )

    now = datetime.now(timezone.utc)

    activity = CollectionActivity(
        id=uuid.uuid4(),
        tenant_id=case.tenant_id,
        case_id=case.id,
        actor=actor,
        channel=channel,
        outcome=outcome,
        successful=successful,
        notes=notes,
        next_action=next_action,
        next_action_date=next_action_date,
        created_at=now,
    )

    db.add(activity)

    audit_event = AuditEvent(
        id=uuid.uuid4(),
        tenant_id=case.tenant_id,
        actor=actor,
        event_type="COLLECTION_ACTIVITY_RECORDED",
        entity_type="CollectionCase",
        entity_id=case.id,
        payload={
            "activity_id": str(activity.id),
            "channel": channel,
            "outcome": outcome,
            "successful": successful,
            "notes": notes,
            "next_action": next_action,
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
    db.refresh(activity)

    return activity
