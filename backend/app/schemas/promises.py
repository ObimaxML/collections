from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class PromiseCreate(BaseModel):
    amount: Decimal = Field(gt=0)
    due_date: date
    actor: str | None = None
    notes: str | None = None


class PromiseResponse(BaseModel):
    id: UUID
    case_id: UUID
    amount: Decimal
    due_date: date
    status: str
    created_at: datetime

    model_config = {
        "from_attributes": True,
    }


class PromiseStatusUpdate(BaseModel):
    actor: str | None = None
    notes: str | None = None
