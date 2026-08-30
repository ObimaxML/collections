from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.collector import CaseAssignment
from app.services.collector import (
    assign_case,
    get_collector_cases,
    unassign_case,
)


router = APIRouter(
    prefix="/collectors",
    tags=["Collectors"],
)


@router.post(
    "/cases/{case_id}/assign"
)
def assign_collection_case(
    case_id: UUID,
    request: CaseAssignment,
    db: Session = Depends(get_db),
):
    try:
        case = assign_case(
            db=db,
            case_id=case_id,
            collector=request.collector,
            actor=request.actor,
        )

        return {
            "success": True,
            "case": {
                "id": str(case.id),
                "status": case.status,
                "priority": case.priority,
                "assigned_to": case.assigned_to,
            },
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc


@router.post(
    "/cases/{case_id}/unassign"
)
def unassign_collection_case(
    case_id: UUID,
    request: CaseAssignment,
    db: Session = Depends(get_db),
):
    try:
        case = unassign_case(
            db=db,
            case_id=case_id,
            actor=request.actor,
        )

        return {
            "success": True,
            "case": {
                "id": str(case.id),
                "status": case.status,
                "priority": case.priority,
                "assigned_to": case.assigned_to,
            },
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc


@router.get(
    "/{collector}/cases"
)
def collector_cases(
    collector: str,
    limit: int = Query(
        default=100,
        ge=1,
        le=500,
    ),
    db: Session = Depends(get_db),
):
    cases = get_collector_cases(
        db=db,
        collector=collector,
        limit=limit,
    )

    return {
        "success": True,
        "collector": collector,
        "count": len(cases),
        "cases": [
            {
                "id": str(case.id),
                "status": case.status,
                "priority": case.priority,
                "strategy_code": case.strategy_code,
                "assigned_to": case.assigned_to,
                "opened_at": case.opened_at,
            }
            for case in cases
        ],
    }
