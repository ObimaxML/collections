import uuid
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from app.models import AuditEvent, CollectionCase


ALLOWED_TRANSITIONS = {
    "NEW": {
        "VALIDATED",
        "DISPUTED",
    },
    "VALIDATED": {
        "CONTACT_ATTEMPTED",
        "DISPUTED",
    },
    "CONTACT_ATTEMPTED": {
        "ENGAGED",
        "PROMISE_TO_PAY",
        "ARRANGEMENT",
        "ESCALATED",
        "DISPUTED",
    },
    "ENGAGED": {
        "PROMISE_TO_PAY",
        "ARRANGEMENT",
        "ESCALATED",
        "DISPUTED",
    },
    "PROMISE_TO_PAY": {
        "PAYING",
        "BROKEN_PROMISE",
        "ESCALATED",
        "DISPUTED",
    },
    "ARRANGEMENT": {
        "PAYING",
        "BROKEN_PROMISE",
        "ESCALATED",
        "DISPUTED",
    },
    "PAYING": {
        "PAID",
        "BROKEN_PROMISE",
        "ESCALATED",
    },
    "BROKEN_PROMISE": {
        "CONTACT_ATTEMPTED",
        "ENGAGED",
        "PROMISE_TO_PAY",
        "ARRANGEMENT",
        "ESCALATED",
        "DISPUTED",
    },
    "ESCALATED": {
        "ENGAGED",
        "PROMISE_TO_PAY",
        "ARRANGEMENT",
        "DISPUTED",
        "PAID",
        "CLOSED",
    },
    "DISPUTED": {
        "VALIDATED",
        "ENGAGED",
        "ESCALATED",
        "CLOSED",
    },
    "PAID": {
        "CLOSED",
    },
    "CLOSED": set(),
}


def transition_case(
    db: Session,
    case_id: UUID,
    new_status: str,
    actor: str,
    reason: str | None = None,
):
    case = db.get(
        CollectionCase,
        case_id,
    )

    if not case:
        raise ValueError(
            "Collection case not found."
        )

    current_status = case.status

    if current_status == new_status:
        raise ValueError(
            f"Case is already in status '{new_status}'."
        )

    allowed = ALLOWED_TRANSITIONS.get(
        current_status,
        set(),
    )

    if new_status not in allowed:
        raise ValueError(
            f"Invalid case transition: "
            f"{current_status} -> {new_status}."
        )

    now = datetime.now(timezone.utc)

    case.status = new_status

    if new_status == "CLOSED":
        case.closed_at = now

    elif current_status == "CLOSED":
        raise ValueError(
            "A closed case cannot be reopened."
        )

    audit_event = AuditEvent(
        id=uuid.uuid4(),
        tenant_id=case.tenant_id,
        actor=actor,
        event_type="CASE_STATUS_CHANGED",
        entity_type="CollectionCase",
        entity_id=case.id,
        payload={
            "case_id": str(case.id),
            "previous_status": current_status,
            "new_status": new_status,
            "reason": reason,
        },
        created_at=now,
    )

    db.add(audit_event)
    db.commit()
    db.refresh(case)

    return case
