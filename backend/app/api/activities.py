from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import CaseActivity, CollectionCase
from app.schemas.activities import (
    ActivityCreate,
    ActivityResponse,
)


router = APIRouter(
    prefix="/cases",
    tags=["Case Activities"],
)


@router.post(
    "/{case_id}/activities",
    response_model=ActivityResponse,
)
def create_activity(
    case_id: UUID,
    payload: ActivityCreate,
    db: Session = Depends(get_db),
):
    case = db.get(CollectionCase, case_id)

    if not case:
        raise HTTPException(
            status_code=404,
            detail="Collection case not found",
        )

    activity = CaseActivity(
        case_id=case.id,
        tenant_id=case.tenant_id,
        activity_type=payload.activity_type.upper(),
        channel=payload.channel,
        outcome=payload.outcome,
        notes=payload.notes,
        actor=payload.actor,
    )

    db.add(activity)
    db.commit()
    db.refresh(activity)

    return activity


@router.get(
    "/{case_id}/activities",
    response_model=list[ActivityResponse],
)
def list_activities(
    case_id: UUID,
    db: Session = Depends(get_db),
):
    case = db.get(CollectionCase, case_id)

    if not case:
        raise HTTPException(
            status_code=404,
            detail="Collection case not found",
        )

    statement = (
        select(CaseActivity)
        .where(
            CaseActivity.case_id == case_id
        )
        .order_by(
            CaseActivity.created_at.desc()
        )
    )

    return list(db.scalars(statement))
