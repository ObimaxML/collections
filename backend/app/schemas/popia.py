from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class PopiaRequestCreate(BaseModel):
    customer_id: UUID
    request_type: str  # ACCESS_SUBJECT_DATA, RECTIFICATION, DELETION_OBJECTION, CONSENT_WITHDRAWAL, RESTRICTION
    requester_name: str
    requester_email: str | None = None
    justification_notes: str | None = None


class PopiaRequestUpdate(BaseModel):
    status: str  # PENDING, APPROVED, REJECTED, COMPLETED
    actioned_by: str
    justification_notes: str | None = None


class PopiaRequestResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    customer_id: UUID
    request_type: str
    status: str
    requester_name: str
    requester_email: str | None
    justification_notes: str | None
    actioned_by: str | None
    actioned_at: datetime | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PopiaCustomerConsentUpdate(BaseModel):
    popia_consent_status: str  # CONSENTED, EXPLICIT_OPT_OUT, STATUTORY_COLLECTION, REJECTED
    popia_dnc_status: bool = False
    actor: str = "compliance-officer"
