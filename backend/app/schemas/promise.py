from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field


class PromiseCreate(BaseModel):
    amount: Decimal = Field(
        gt=0,
        max_digits=14,
        decimal_places=2,
    )

    due_date: date

    collector: str = Field(
        min_length=1,
        max_length=150,
    )

    notes: str | None = None


class PromiseStatusUpdate(BaseModel):
    status: str = Field(
        min_length=1,
        max_length=50,
    )

    actor: str = Field(
        min_length=1,
        max_length=150,
    )
