from datetime import date
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class LedgerTransactionImport(BaseModel):
    account_id: UUID

    transaction_type: str = Field(
        min_length=1,
        max_length=50,
    )

    transaction_date: date

    amount: Decimal = Field(
        gt=0,
    )

    reference: str | None = Field(
        default=None,
        max_length=255,
    )

    description: str | None = None

    source_type: str = Field(
        min_length=1,
        max_length=100,
    )

    source_id: UUID

    created_by: str = Field(
        default="municipal-import",
        max_length=150,
    )


class LedgerTransactionImportResponse(BaseModel):
    success: bool
    created: bool
    transaction_id: UUID | None = None
    message: str
