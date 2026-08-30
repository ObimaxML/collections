from datetime import date
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class PromiseMonitoringResponse(BaseModel):
    promise_id: UUID
    case_id: UUID
    amount: Decimal
    due_date: date
    status: str
    days_until_due: int
    action_required: bool
    reason: str
