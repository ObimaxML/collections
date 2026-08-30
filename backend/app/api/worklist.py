from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.case_worklist import (
    get_case_worklist,
)


router = APIRouter(
    prefix="/worklist",
    tags=["Collection Worklist"],
)


@router.get("/cases")
def collection_worklist(
    status: str | None = Query(
        default=None
    ),
    assigned_to: str | None = Query(
        default=None
    ),
    limit: int = Query(
        default=100,
        ge=1,
        le=500,
    ),
    offset: int = Query(
        default=0,
        ge=0,
    ),
    db: Session = Depends(get_db),
):
    return {
        "items": get_case_worklist(
            db,
            status=status,
            assigned_to=assigned_to,
            limit=limit,
            offset=offset,
        ),
        "limit": limit,
        "offset": offset,
    }
