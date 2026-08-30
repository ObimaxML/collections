from datetime import date, datetime, timezone

from sqlalchemy.orm import Session

from app.models import (
    CaseActivity,
    CollectionCase,
    Promise,
)


def escalate_overdue_promise(
    db: Session,
    promise: Promise,
    actor: str = "system",
) -> CollectionCase | None:

    if promise.status != "ACTIVE":
        return None

    if promise.due_date >= date.today():
        return None

    case = db.get(
        CollectionCase,
        promise.case_id,
    )

    if not case:
        return None

    promise.status = "BROKEN"

    case.status = "BROKEN_PROMISE"

    activity = CaseActivity(
        case_id=case.id,
        tenant_id=case.tenant_id,
        activity_type="PROMISE_BROKEN",
        channel="SYSTEM",
        outcome="OVERDUE",
        notes=(
            "Promise automatically marked as broken "
            "because the due date passed without "
            "fulfilment."
        ),
        actor=actor,
        created_at=datetime.now(timezone.utc),
    )

    db.add(activity)

    return case
