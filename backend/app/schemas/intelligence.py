from decimal import Decimal
from pydantic import BaseModel


class CollectionAssessmentRequest(BaseModel):
    arrears: Decimal
    days_in_arrears: int
    account_status: str
    broken_promises: int = 0
    payment_count: int = 0


class CollectionAssessmentResponse(BaseModel):
    score: int
    priority: int
    priority_label: str
    strategy_code: str
    reasons: list[str]
