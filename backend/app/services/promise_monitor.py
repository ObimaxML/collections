from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Promise


def get_promise_monitoring_status(
    promise: Promise,
    today: date | None = None,
) -> dict:
    """
    Determine the operational status of an active promise.

    This function does not modify the database.
    """

    if today is None:
        today = date.today()

    days_until_due = (
        promise.due_date - today
    ).days

    if promise.status != "ACTIVE":
        return {
            "status": promise.status,
            "days_until_due": days_until_due,
            "action_required": False,
            "reason": "Promise is no longer active.",
        }

    if days_until_due < 0:
        return {
            "status": "OVERDUE",
            "days_until_due": days_until_due,
            "action_required": True,
            "reason": "Promise due date has passed.",
        }

    if days_until_due == 0:
        return {
            "status": "DUE_TODAY",
            "days_until_due": 0,
            "action_required": True,
            "reason": "Promise is due today.",
        }

    if days_until_due <= 3:
        return {
            "status": "DUE_SOON",
            "days_until_due": days_until_due,
            "action_required": True,
            "reason": "Promise is due within three days.",
        }

    return {
        "status": "UPCOMING",
        "days_until_due": days_until_due,
        "action_required": False,
        "reason": "Promise is not yet due.",
    }


def find_promises_requiring_attention(
    db: Session,
    today: date | None = None,
) -> list[tuple[Promise, dict]]:

    if today is None:
        today = date.today()

    statement = (
        select(Promise)
        .where(Promise.status == "ACTIVE")
        .order_by(Promise.due_date.asc())
    )

    promises = list(db.scalars(statement))

    results = []

    for promise in promises:
        monitoring = get_promise_monitoring_status(
            promise,
            today,
        )

        if monitoring["action_required"]:
            results.append(
                (
                    promise,
                    monitoring,
                )
            )

    return results
