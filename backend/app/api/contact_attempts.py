from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.contact_attempt import (
    ContactAttemptCreate,
)
from app.services.contact_attempt import (
    create_contact_attempt,
    get_case_activity,
)


router = APIRouter(
    prefix="/cases",
    tags=["Contact Activity"],
)


@router.post(
    "/{case_id}/contact-attempts"
)
def record_contact_attempt(
    case_id: UUID,
    request: ContactAttemptCreate,
    db: Session = Depends(get_db),
):
    try:
        from app.models import CollectionCase, User
        case = db.get(CollectionCase, case_id)
        if not case:
            raise HTTPException(status_code=404, detail="Collection case not found.")

        # Server-side hard compliance gating
        collector_str = request.collector or "Collector"
        collector_user = db.scalar(
            select(User).where((User.email == collector_str) | (User.full_name == collector_str))
        )
        if collector_user and collector_user.role == "COLLECTOR":
            from app.services.compliance import check_and_enforce_collector_action_allowed
            try:
                check_and_enforce_collector_action_allowed(
                    db=db,
                    user_id=collector_user.id,
                    tenant_id=case.tenant_id,
                    action_name="Log Contact Attempt",
                )
            except PermissionError as p_err:
                raise HTTPException(
                    status_code=403,
                    detail=str(p_err),
                )

        attempt = create_contact_attempt(
            db=db,
            case_id=case_id,
            collector=request.collector,
            channel=request.channel,
            outcome=request.outcome,
            notes=request.notes,
            next_action_date=(
                request.next_action_date
            ),
            contacted=request.contacted,
        )

        return {
            "success": True,
            "contact_attempt": {
                "id": str(attempt.id),
                "case_id": str(attempt.case_id),
                "collector": attempt.collector,
                "channel": attempt.channel,
                "outcome": attempt.outcome,
                "notes": attempt.notes,
                "next_action_date": (
                    attempt.next_action_date
                ),
                "contacted": attempt.contacted,
                "created_at": attempt.created_at,
            },
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc


@router.get(
    "/{case_id}/contact-attempts"
)
def case_contact_attempts(
    case_id: UUID,
    db: Session = Depends(get_db),
):
    attempts = get_case_activity(
        db=db,
        case_id=case_id,
    )

    return {
        "success": True,
        "case_id": str(case_id),
        "count": len(attempts),
        "contact_attempts": [
            {
                "id": str(attempt.id),
                "collector": attempt.collector,
                "channel": attempt.channel,
                "outcome": attempt.outcome,
                "notes": attempt.notes,
                "next_action_date": (
                    attempt.next_action_date
                ),
                "contacted": attempt.contacted,
                "created_at": attempt.created_at,
            }
            for attempt in attempts
        ],
    }
