from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.payment_reconciliation import (
    reconcile_payment,
)


router = APIRouter(
    prefix="/payments",
    tags=["Payment Reconciliation"],
)


@router.post(
    "/{payment_id}/reconcile"
)
def reconcile_payment_endpoint(
    payment_id: UUID,
    actor: str = "system",
    db: Session = Depends(get_db),
):
    try:
        result = reconcile_payment(
            db=db,
            payment_id=payment_id,
            actor=actor,
        )

        promise = result["matched_promise"]

        return {
            "success": True,
            "payment": {
                "id": str(
                    result["payment"].id
                ),
                "amount": result["payment"].amount,
                "reconciliation_status": (
                    result[
                        "payment"
                    ].reconciliation_status
                ),
            },
            "promise": (
                {
                    "id": str(promise.id),
                    "amount": promise.amount,
                    "due_date": promise.due_date,
                    "status": promise.status,
                }
                if promise
                else None
            ),
            "result": result["result"],
            "remaining_payment": (
                result["remaining_payment"]
            ),
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc
