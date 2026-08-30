from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class TenantCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    code: str = Field(min_length=2, max_length=100)


class TenantResponse(BaseModel):
    id: UUID
    name: str
    code: str
    created_at: datetime

    model_config = {
        "from_attributes": True,
    }
