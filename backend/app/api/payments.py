from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.payment import (
    PaymentCreate,
    PaymentReconcile,
)
from app.services.payment import (
    create_payment,
    reconcile_payment,
)


router = APIRouter(
    prefix="/payments",
    tags=["Payments"],
)


@router.post("")
def create_payment_endpoint(
    request: PaymentCreate,
    db: Session = Depends(get_db),
):
    try:
        from app.models import MunicipalAccount
        from sqlalchemy import select
        
        target_account_id = None
        if request.account_id:
            try:
                target_account_id = UUID(request.account_id)
            except ValueError:
                pass
        
        if not target_account_id and request.account_number:
            query = select(MunicipalAccount).where(MunicipalAccount.account_number == request.account_number)
            if request.tenant_id and request.tenant_id.upper() != "GLOBAL":
                try:
                    query = query.where(MunicipalAccount.tenant_id == UUID(request.tenant_id))
                except ValueError:
                    pass
            acc_match = db.execute(query).scalars().first()
            if acc_match:
                target_account_id = acc_match.id

        if not target_account_id:
            raise HTTPException(
                status_code=400,
                detail="Could not identify account. Please provide a valid account_id or account_number.",
            )

        payment = create_payment(
            db=db,
            account_id=target_account_id,
            amount=request.amount,
            payment_date=request.payment_date,
            external_reference=(
                request.external_reference
            ),
            actor=request.actor,
        )

        # Automatically reconcile payment against pending promises / ledger to update balances immediately
        try:
            reconcile_payment(
                db=db,
                payment_id=payment.id,
                actor=request.actor,
            )
            db.refresh(payment)
        except Exception:
            pass

        return {
            "success": True,
            "payment": {
                "id": str(payment.id),
                "account_id": (
                    str(payment.account_id)
                ),
                "amount": payment.amount,
                "payment_date": (
                    payment.payment_date
                ),
                "external_reference": (
                    payment.external_reference
                ),
                "reconciliation_status": (
                    payment.reconciliation_status
                ),
                "created_at": payment.created_at,
            },
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc


@router.post(
    "/{payment_id}/reconcile"
)
def reconcile_payment_endpoint(
    payment_id: UUID,
    request: PaymentReconcile,
    db: Session = Depends(get_db),
):
    try:
        payment = reconcile_payment(
            db=db,
            payment_id=payment_id,
            actor=request.actor,
        )

        return {
            "success": True,
            "payment": {
                "id": str(payment.id),
                "account_id": (
                    str(payment.account_id)
                ),
                "amount": payment.amount,
                "payment_date": (
                    payment.payment_date
                ),
                "reconciliation_status": (
                    payment.reconciliation_status
                ),
                "posted_at": payment.posted_at,
            },
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc
