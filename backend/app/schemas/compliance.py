from datetime import date, datetime
from decimal import Decimal
from uuid import UUID
from pydantic import BaseModel, Field


# -------------------------------------------------------------
# Collector Profile Schemas
# -------------------------------------------------------------

class CollectorProfileCreate(BaseModel):
    user_id: UUID
    cfdc_registration_number: str = Field(min_length=3, max_length=100)
    cfdc_expiry_date: date
    cfdc_certificate_url: str | None = None
    kyc_documents: dict | None = None


class CollectorProfileUpdate(BaseModel):
    cfdc_registration_number: str | None = None
    cfdc_expiry_date: date | None = None
    cfdc_certificate_url: str | None = None
    kyc_documents: dict | None = None
    compliance_status: str | None = None
    suspension_reason: str | None = None


class CollectorProfileResponse(BaseModel):
    id: UUID
    user_id: UUID
    user_name: str | None = None
    user_email: str | None = None
    cfdc_registration_number: str
    cfdc_expiry_date: date
    cfdc_certificate_url: str | None
    kyc_documents: dict | None
    compliance_status: str
    suspension_reason: str | None
    last_verified_at: datetime | None
    verified_by: str | None
    created_at: datetime
    trust_account: dict | None = None
    assignments: list[dict] = []
    days_to_cfdc_expiry: int | None = None
    days_to_audit_due: int | None = None


# -------------------------------------------------------------
# Trust Account Schemas
# -------------------------------------------------------------

class CollectorTrustAccountCreate(BaseModel):
    bank_name: str = Field(min_length=2, max_length=150)
    branch_code: str = Field(min_length=2, max_length=50)
    account_number: str = Field(min_length=4, max_length=100)
    account_holder_name: str = Field(min_length=2, max_length=255)
    bank_confirmation_letter_url: str | None = None
    auditor_letter_url: str | None = None
    last_audit_report_url: str | None = None
    audit_due_date: date


class CollectorTrustAccountUpdate(BaseModel):
    bank_name: str | None = None
    branch_code: str | None = None
    account_number: str | None = None
    account_holder_name: str | None = None
    bank_confirmation_letter_url: str | None = None
    auditor_letter_url: str | None = None
    last_audit_report_url: str | None = None
    audit_due_date: date | None = None
    verification_status: str | None = None


# -------------------------------------------------------------
# Municipal Assignment Schemas
# -------------------------------------------------------------

class CollectorAssignmentRequest(BaseModel):
    tenant_id: UUID
    notes: str | None = None


class CollectorAssignmentAction(BaseModel):
    status: str  # ACTIVE, SUSPENDED, REMOVED
    notes: str | None = None


# -------------------------------------------------------------
# Remittance Tracking Schemas
# -------------------------------------------------------------

class RemittanceRecordCreate(BaseModel):
    tenant_id: UUID
    payment_id: UUID | None = None
    debtor_reference: str
    amount_received: Decimal = Field(gt=0)
    receipt_date: date
    commission_rate: Decimal = Field(default=Decimal("10.00"), ge=0, le=100)
    bank_statement_ref: str | None = None
    notes: str | None = None


class RemittanceStatusUpdate(BaseModel):
    remittance_status: str  # REMITTED, RECONCILED
    remittance_date: date | None = None
    bank_statement_ref: str | None = None
    notes: str | None = None


class RemittanceStatementResponse(BaseModel):
    collector_id: UUID
    collector_name: str
    cfdc_number: str
    tenant_id: UUID
    tenant_name: str
    statement_period: str
    total_cash_collected: Decimal
    total_commission_earned: Decimal
    total_remitted_to_municipality: Decimal
    total_pending_remittance: Decimal
    items: list[dict]
