from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.work_queue import (
    get_work_queue,
    refresh_case_priorities,
)


router = APIRouter(
    prefix="/work-queue",
    tags=["Work Queue"],
)


@router.get("")
def work_queue(
    tenant_id: UUID | None = Query(
        default=None
    ),
    limit: int = Query(
        default=100,
        ge=1,
        le=500,
    ),
    db: Session = Depends(get_db),
):
    return {
        "success": True,
        "count": len(
            get_work_queue(
                db=db,
                tenant_id=tenant_id,
                limit=limit,
            )
        ),
        "items": get_work_queue(
            db=db,
            tenant_id=tenant_id,
            limit=limit,
        ),
    }


@router.post("/refresh-priorities")
def refresh_priorities(
    tenant_id: UUID | None = Query(
        default=None
    ),
    db: Session = Depends(get_db),
):
    try:
        updated = refresh_case_priorities(
            db=db,
            tenant_id=tenant_id,
        )

        return {
            "success": True,
            "updated_cases": updated,
        }

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=str(exc),
        ) from exc
