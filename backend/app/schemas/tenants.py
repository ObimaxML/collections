from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class TenantCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    code: str = Field(min_length=2, max_length=100)
    engagement_model: str = Field(default="MANAGED_SERVICE")  # MANAGED_SERVICE, SAAS_SELF_SERVICE
    subscription_tier: str = Field(default="ENTERPRISE")      # STARTER, PROFESSIONAL, ENTERPRISE, OUTSOURCED_COMMISSION
    commission_rate: Decimal | None = Decimal("10.00")
    monthly_subscription_fee: Decimal | None = Decimal("0.00")
    subscription_status: str = Field(default="ACTIVE")        # ACTIVE, TRIAL, SUSPENDED, EXPIRED
    billing_contact_email: str | None = None
    contract_start_date: date | None = None
    contract_end_date: date | None = None


class TenantUpdate(BaseModel):
    name: str | None = None
    code: str | None = None
    engagement_model: str | None = None
    subscription_tier: str | None = None
    commission_rate: Decimal | None = None
    monthly_subscription_fee: Decimal | None = None
    subscription_status: str | None = None
    billing_contact_email: str | None = None
    contract_start_date: date | None = None
    contract_end_date: date | None = None


class TenantResponse(BaseModel):
    id: UUID
    name: str
    code: str
    engagement_model: str
    subscription_tier: str
    commission_rate: Decimal | None
    monthly_subscription_fee: Decimal | None
    subscription_status: str
    billing_contact_email: str | None
    contract_start_date: date | None
    contract_end_date: date | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
