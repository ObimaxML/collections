from fastapi import APIRouter

from app.schemas.intelligence import (
    CollectionAssessmentRequest,
    CollectionAssessmentResponse,
)
from app.services.collection_intelligence import (
    assess_collection_case,
)


router = APIRouter(
    prefix="/intelligence",
    tags=["Collection Intelligence"],
)


@router.post(
    "/assess",
    response_model=CollectionAssessmentResponse,
)
def assess_case(
    request: CollectionAssessmentRequest,
):
    assessment = assess_collection_case(
        arrears=request.arrears,
        days_in_arrears=request.days_in_arrears,
        account_status=request.account_status,
        broken_promises=request.broken_promises,
        payment_count=request.payment_count,
    )

    return CollectionAssessmentResponse(
        score=assessment.score,
        priority=assessment.priority,
        priority_label=assessment.priority_label,
        strategy_code=assessment.strategy_code,
        reasons=assessment.reasons,
    )
