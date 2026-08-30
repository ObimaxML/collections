from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field


class PaymentPlanCreate(BaseModel):
    deposit_amount: Decimal = Field(
        ge=0,
    )

    installment_amount: Decimal = Field(
        gt=0,
    )

    frequency: str = Field(
        min_length=1,
        max_length=30,
    )

    number_of_installments: int = Field(
        gt=0,
    )

    start_date: date

    actor: str = Field(
        min_length=1,
        max_length=150,
    )
