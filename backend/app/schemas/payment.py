from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field


class PaymentCreate(BaseModel):
    account_id: str | None = None
    account_number: str | None = None
    tenant_id: str | None = None

    amount: Decimal = Field(
        gt=0,
    )

    payment_date: date

    external_reference: str | None = Field(
        default=None,
        max_length=255,
    )

    actor: str = Field(
        default="collector",
        min_length=1,
        max_length=150,
    )


class PaymentReconcile(BaseModel):
    actor: str = Field(
        min_length=1,
        max_length=150,
    )
