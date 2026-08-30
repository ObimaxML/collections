from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.payment_plan import (
    PaymentPlanCreate,
)
from app.services.payment_plan import (
    create_payment_plan,
)


router = APIRouter(
    prefix="/cases",
    tags=["Payment Plans"],
)


@router.post(
    "/{case_id}/payment-plans"
)
def create_case_payment_plan(
    case_id: UUID,
    request: PaymentPlanCreate,
    db: Session = Depends(get_db),
):
    try:
        plan = create_payment_plan(
            db=db,
            case_id=case_id,
            deposit_amount=request.deposit_amount,
            installment_amount=(
                request.installment_amount
            ),
            frequency=request.frequency,
            number_of_installments=(
                request.number_of_installments
            ),
            start_date=request.start_date,
            actor=request.actor,
        )

        return {
            "success": True,
            "payment_plan": {
                "id": str(plan.id),
                "case_id": str(plan.case_id),
                "deposit_amount": (
                    plan.deposit_amount
                ),
                "installment_amount": (
                    plan.installment_amount
                ),
                "frequency": plan.frequency,
                "number_of_installments": (
                    plan.number_of_installments
                ),
                "status": plan.status,
                "start_date": plan.start_date,
            },
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc
