from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Payment, Promise
from app.schemas.promise_monitoring import (
    PromiseMonitoringResponse,
)
from app.services.promise_monitor import (
    find_promises_requiring_attention,
)
from app.services.promise_escalation import (
    escalate_overdue_promise,
)
from app.services.payment_reconciliation import (
    reconcile_payment_against_promises,
)
from app.services.payment_allocation import (
    allocate_payment,
)


router = APIRouter(
    prefix="/promise-monitoring",
    tags=["Promise Monitoring"],
)


@router.get(
    "/attention",
    response_model=list[PromiseMonitoringResponse],
)
def promises_requiring_attention(
    db: Session = Depends(get_db),
):
    results = find_promises_requiring_attention(
        db,
        date.today(),
    )

    return [
        PromiseMonitoringResponse(
            promise_id=promise.id,
            case_id=promise.case_id,
            amount=promise.amount,
            due_date=promise.due_date,
            status=monitoring["status"],
            days_until_due=monitoring["days_until_due"],
            action_required=monitoring["action_required"],
            reason=monitoring["reason"],
        )
        for promise, monitoring in results
    ]


@router.post("/run")
def run_promise_monitoring(
    db: Session = Depends(get_db),
):
    active_promises = (
        db.query(Promise)
        .filter(
            Promise.status == "ACTIVE"
        )
        .all()
    )

    broken_count = 0

    for promise in active_promises:
        case = escalate_overdue_promise(
            db,
            promise,
            actor="system",
        )

        if case:
            broken_count += 1

    db.commit()

    return {
        "status": "completed",
        "promises_checked": len(active_promises),
        "promises_broken": broken_count,
    }


@router.post("/reconcile-payment/{payment_id}")
def reconcile_payment(
    payment_id: UUID,
    db: Session = Depends(get_db),
):
    payment = db.get(
        Payment,
        payment_id,
    )

    if not payment:
        raise HTTPException(
            status_code=404,
            detail="Payment not found.",
        )

    result = reconcile_payment_against_promises(
        db,
        payment,
    )

    db.commit()

    return result


@router.post("/allocate-payment/{payment_id}")
def allocate_payment_endpoint(
    payment_id: UUID,
    db: Session = Depends(get_db),
):
    payment = db.get(
        Payment,
        payment_id,
    )

    if not payment:
        raise HTTPException(
            status_code=404,
            detail="Payment not found.",
        )

    result = allocate_payment(
        db,
        payment,
    )

    db.commit()

    return result
