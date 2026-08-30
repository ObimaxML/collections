from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class ActivityCreate(BaseModel):
    activity_type: str
    channel: str | None = None
    outcome: str | None = None
    notes: str | None = None
    actor: str | None = None


class ActivityResponse(BaseModel):
    id: UUID
    case_id: UUID
    tenant_id: UUID | None = None
    activity_type: str
    channel: str | None
    outcome: str | None
    notes: str | None
    actor: str | None
    created_at: datetime

    model_config = {
        "from_attributes": True,
    }
