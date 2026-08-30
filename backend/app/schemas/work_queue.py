from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class WorkQueueItem(BaseModel):
    case_id: UUID
    account_id: UUID
    account_number: str

    customer_id: UUID | None = None
    customer_name: str | None = None
    mobile: str | None = None

    property_id: UUID | None = None
    property_reference: str | None = None
    address: str | None = None

    balance: Decimal
    arrears: Decimal
    days_in_arrears: int

    status: str
    priority: int
    strategy_code: str | None = None
    assigned_to: str | None = None

    model_config = {
        "from_attributes": True
    }


class WorkQueueResponse(BaseModel):
    items: list[WorkQueueItem]
    total: int
    limit: int
    offset: int
