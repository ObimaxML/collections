from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import (
    CollectionCase,
    MunicipalAccount,
    Payment,
    Promise,
)
from app.services.collection_intelligence import (
    assess_collection_case,
)

router = APIRouter(
    prefix="/cases",
    tags=["Case Intelligence"],
)


@router.post("/{case_id}/assess")
def assess_existing_case(
    case_id: UUID,
    db: Session = Depends(get_db),
):
    case = db.get(CollectionCase, case_id)

    if not case:
        raise HTTPException(
            status_code=404,
            detail="Collection case not found",
        )

    account = db.get(
        MunicipalAccount,
        case.account_id,
    )

    if not account:
        raise HTTPException(
            status_code=404,
            detail="Municipal account not found",
        )

    payment_count = db.scalar(
        select(func.count(Payment.id)).where(
            Payment.account_id == account.id
        )
    ) or 0

    broken_promises = db.scalar(
        select(func.count(Promise.id)).where(
            Promise.case_id == case.id,
            Promise.status == "BROKEN",
        )
    ) or 0

    assessment = assess_collection_case(
        arrears=account.arrears,
        days_in_arrears=account.days_in_arrears,
        account_status=account.account_status,
        broken_promises=broken_promises,
        payment_count=payment_count,
    )

    # Update the case
    case.priority = assessment.priority
    case.strategy_code = assessment.strategy_code

    db.add(case)
    db.commit()
    db.refresh(case)

    return {
        "case_id": case.id,
        "account_id": account.id,
        "score": assessment.score,
        "priority": assessment.priority,
        "priority_label": assessment.priority_label,
        "strategy_code": assessment.strategy_code,
        "reasons": assessment.reasons,
        "payment_count": payment_count,
        "broken_promises": broken_promises,
    }
