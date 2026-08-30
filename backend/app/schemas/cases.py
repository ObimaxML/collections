from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class CaseCreateRequest(BaseModel):
    tenant_id: UUID
    account_id: UUID
    priority: int = Field(
        default=3,
        ge=1,
        le=5,
    )
    strategy_code: str | None = None
    assigned_to: str | None = None
    actor: str = "system"


class CaseAssignRequest(BaseModel):
    assigned_to: str
    actor: str = "system"


class CaseStatusRequest(BaseModel):
    status: str
    actor: str = "system"


class CasePriorityRequest(BaseModel):
    priority: int = Field(
        ge=1,
        le=5,
    )
    actor: str = "system"


class CaseResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    account_id: UUID
    status: str
    priority: int
    strategy_code: str | None
    assigned_to: str | None
    opened_at: datetime
    closed_at: datetime | None

    model_config = {
        "from_attributes": True
    }
