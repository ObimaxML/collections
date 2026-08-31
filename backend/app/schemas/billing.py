from datetime import date, datetime
from decimal import Decimal
from uuid import UUID
from pydantic import BaseModel, Field


class LineItem(BaseModel):
    description: str
    quantity: Decimal = Decimal("1.00")
    unit_price: Decimal = Decimal("0.00")
    total: Decimal = Decimal("0.00")


class BankingDetails(BaseModel):
    bank_name: str = "First National Bank (FNB)"
    account_name: str = "Molmos (Pty) Ltd - Khokhisa Collections"
    account_number: str = "62899432101"
    branch_code: str = "250655"
    account_type: str = "Business Cheque Account"
    swift_code: str = "FIRNZAJJ"
    payment_reference: str = "INV-MOLMOS"


# Proposal Schemas
class ProposalCreate(BaseModel):
    tenant_id: UUID
    title: str
    engagement_model: str = "MANAGED_SERVICE"
    subscription_tier: str = "ENTERPRISE"
    monthly_fee: Decimal | None = Decimal("0.00")
    commission_rate: Decimal | None = Decimal("10.00")
    valid_until: date | None = None
    scope_of_work: str | None = None
    terms_and_conditions: str | None = None
    line_items: list[LineItem] = []
    created_by: str | None = None


class ProposalUpdate(BaseModel):
    title: str | None = None
    status: str | None = None
    engagement_model: str | None = None
    subscription_tier: str | None = None
    monthly_fee: Decimal | None = None
    commission_rate: Decimal | None = None
    valid_until: date | None = None
    scope_of_work: str | None = None
    terms_and_conditions: str | None = None
    line_items: list[LineItem] | None = None
    approved_by: str | None = None


class ProposalResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    tenant_name: str | None = None
    tenant_code: str | None = None
    tenant_physical_address: str | None = None
    tenant_postal_address: str | None = None
    tenant_contact_person: str | None = None
    tenant_contact_position: str | None = None
    tenant_contact_phone: str | None = None
    tenant_billing_email: str | None = None
    proposal_number: str
    title: str
    engagement_model: str
    subscription_tier: str
    status: str
    total_amount: Decimal
    vat_amount: Decimal
    monthly_fee: Decimal | None
    commission_rate: Decimal | None
    valid_until: date | None
    scope_of_work: str | None
    terms_and_conditions: str | None
    line_items: list[dict]
    approved_by: str | None
    approved_at: datetime | None
    created_by: str | None
    created_at: datetime

    class Config:
        from_attributes = True


# Invoice Schemas
class InvoiceCreate(BaseModel):
    tenant_id: UUID
    proposal_id: UUID | None = None
    billing_period: str
    issue_date: date = Field(default_factory=date.today)
    due_date: date
    vat_rate: Decimal = Decimal("15.00")
    line_items: list[LineItem] = []
    banking_details: BankingDetails | None = None
    notes: str | None = None


class InvoiceUpdate(BaseModel):
    status: str | None = None
    billing_period: str | None = None
    due_date: date | None = None
    paid_amount: Decimal | None = None
    line_items: list[LineItem] | None = None
    banking_details: BankingDetails | None = None
    notes: str | None = None


class InvoiceResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    tenant_name: str | None = None
    tenant_code: str | None = None
    tenant_physical_address: str | None = None
    tenant_postal_address: str | None = None
    tenant_contact_person: str | None = None
    tenant_contact_position: str | None = None
    tenant_contact_phone: str | None = None
    tenant_billing_email: str | None = None
    proposal_id: UUID | None
    invoice_number: str
    billing_period: str
    status: str
    issue_date: date
    due_date: date
    subtotal: Decimal
    vat_rate: Decimal
    vat_amount: Decimal
    total_amount: Decimal
    paid_amount: Decimal
    line_items: list[dict]
    banking_details: dict
    notes: str | None
    created_at: datetime

    class Config:
        from_attributes = True
