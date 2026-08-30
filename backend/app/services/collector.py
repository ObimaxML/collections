import uuid
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    AuditEvent,
    CollectionCase,
)


def assign_case(
    db: Session,
    *,
    case_id: UUID,
    collector: str,
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

    if case.status in ["PAID", "CLOSED"]:
        raise ValueError(
            "A closed or paid case cannot be assigned."
        )

    previous_collector = case.assigned_to

    case.assigned_to = collector

    now = datetime.now(timezone.utc)

    audit_event = AuditEvent(
        id=uuid.uuid4(),
        tenant_id=case.tenant_id,
        actor=actor,
        event_type="CASE_ASSIGNED",
        entity_type="CollectionCase",
        entity_id=case.id,
        payload={
            "collector": collector,
            "previous_collector": previous_collector,
        },
        created_at=now,
    )

    db.add(audit_event)

    db.commit()
    db.refresh(case)

    return case


def unassign_case(
    db: Session,
    *,
    case_id: UUID,
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

    previous_collector = case.assigned_to

    if not previous_collector:
        raise ValueError(
            "Case is not currently assigned."
        )

    case.assigned_to = None

    now = datetime.now(timezone.utc)

    audit_event = AuditEvent(
        id=uuid.uuid4(),
        tenant_id=case.tenant_id,
        actor=actor,
        event_type="CASE_UNASSIGNED",
        entity_type="CollectionCase",
        entity_id=case.id,
        payload={
            "previous_collector": previous_collector,
        },
        created_at=now,
    )

    db.add(audit_event)

    db.commit()
    db.refresh(case)

    return case


def get_collector_cases(
    db: Session,
    *,
    collector: str,
    limit: int = 100,
):
    query = (
        select(CollectionCase)
        .where(
            CollectionCase.assigned_to == collector,
            CollectionCase.status.notin_(
                ["PAID", "CLOSED"]
            ),
        )
        .order_by(
            CollectionCase.priority.desc(),
            CollectionCase.opened_at.asc(),
        )
        .limit(limit)
    )

    return list(db.scalars(query).all())
