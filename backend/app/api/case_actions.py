from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.case_actions import (
    CaseTransitionRequest,
)
from app.services.case_actions import (
    transition_case,
)


router = APIRouter(
    prefix="/cases",
    tags=["Collection Case Actions"],
)


@router.post(
    "/{case_id}/transition"
)
def transition_case_status(
    case_id: UUID,
    request: CaseTransitionRequest,
    db: Session = Depends(get_db),
):
    try:
        case = transition_case(
            db=db,
            case_id=case_id,
            new_status=request.new_status,
            actor=request.actor,
            reason=request.reason,
        )

        return {
            "success": True,
            "case_id": case.id,
            "status": case.status,
            "closed_at": case.closed_at,
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc
