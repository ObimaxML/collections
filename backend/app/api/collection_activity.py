from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.collection_activity import (
    CollectionActivityCreate,
)
from app.services.collection_activity import (
    create_collection_activity,
)


router = APIRouter(
    prefix="/cases",
    tags=["Collection Activities"],
)


@router.post(
    "/{case_id}/activities"
)
def create_activity(
    case_id: UUID,
    request: CollectionActivityCreate,
    db: Session = Depends(get_db),
):
    try:
        activity = create_collection_activity(
            db=db,
            case_id=case_id,
            actor=request.actor,
            channel=request.channel,
            outcome=request.outcome,
            successful=request.successful,
            notes=request.notes,
            next_action=request.next_action,
            next_action_date=request.next_action_date,
        )

        return {
            "success": True,
            "activity": {
                "id": activity.id,
                "case_id": activity.case_id,
                "actor": activity.actor,
                "channel": activity.channel,
                "outcome": activity.outcome,
                "successful": activity.successful,
                "notes": activity.notes,
                "next_action": activity.next_action,
                "next_action_date": (
                    activity.next_action_date
                ),
                "created_at": activity.created_at,
            },
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc
