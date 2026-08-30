from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.promise import (
    PromiseCreate,
    PromiseStatusUpdate,
)
from app.services.promise import (
    create_promise,
    get_case_promises,
    update_promise_status,
)


router = APIRouter(
    prefix="/cases",
    tags=["Promises"],
)


@router.post(
    "/{case_id}/promises"
)
def create_case_promise(
    case_id: UUID,
    request: PromiseCreate,
    db: Session = Depends(get_db),
):
    try:
        promise = create_promise(
            db=db,
            case_id=case_id,
            amount=request.amount,
            due_date=request.due_date,
            collector=request.collector,
            notes=request.notes,
        )

        return {
            "success": True,
            "promise": {
                "id": str(promise.id),
                "case_id": str(promise.case_id),
                "amount": promise.amount,
                "due_date": promise.due_date,
                "status": promise.status,
                "created_at": promise.created_at,
            },
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc


@router.get(
    "/{case_id}/promises"
)
def list_case_promises(
    case_id: UUID,
    db: Session = Depends(get_db),
):
    promises = get_case_promises(
        db=db,
        case_id=case_id,
    )

    return {
        "success": True,
        "case_id": str(case_id),
        "count": len(promises),
        "promises": [
            {
                "id": str(promise.id),
                "amount": promise.amount,
                "due_date": promise.due_date,
                "status": promise.status,
                "created_at": promise.created_at,
            }
            for promise in promises
        ],
    }


@router.patch(
    "/{case_id}/promises/{promise_id}"
)
def update_case_promise(
    case_id: UUID,
    promise_id: UUID,
    request: PromiseStatusUpdate,
    db: Session = Depends(get_db),
):
    try:
        promise = update_promise_status(
            db=db,
            promise_id=promise_id,
            status=request.status,
            actor=request.actor,
        )

        if promise.case_id != case_id:
            raise HTTPException(
                status_code=400,
                detail="Promise does not belong to this case.",
            )

        return {
            "success": True,
            "promise": {
                "id": str(promise.id),
                "case_id": str(promise.case_id),
                "amount": promise.amount,
                "due_date": promise.due_date,
                "status": promise.status,
            },
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc
