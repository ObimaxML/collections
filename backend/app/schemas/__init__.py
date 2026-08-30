from uuid import UUID
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class UserLogin(BaseModel):
    email: str
    password: str


class UserCreate(BaseModel):
    email: str
    password: str
    full_name: str
    role: str = "ADMIN"
    tenant_id: UUID | None = None


class UserUpdate(BaseModel):
    full_name: str | None = None
    email: str | None = None
    role: str | None = None
    tenant_id: UUID | None = None
    remove_tenant: bool = False
    password: str | None = None
    is_active: bool | None = None


class UserResponse(BaseModel):
    id: UUID
    tenant_id: UUID | None
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class CustomerBase(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    id_number: str | None = None
    company_registration: str | None = None
    mobile: str | None = None
    email: str | None = None


class CustomerCreate(CustomerBase):
    tenant_id: UUID


class CustomerResponse(CustomerBase):
    id: UUID
    tenant_id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PropertyResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    property_reference: str | None = None
    address: str | None = None

    model_config = ConfigDict(from_attributes=True)


class MunicipalAccountCreate(BaseModel):
    tenant_id: UUID
    customer_id: UUID | None = None
    property_id: UUID | None = None
    account_number: str
    account_status: str = "ACTIVE"
    balance: Decimal
    arrears: Decimal
    days_in_arrears: int
    last_payment_date: date | None = None
    last_payment_amount: Decimal = Decimal("0.00")


class MunicipalAccountResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    customer_id: UUID | None
    property_id: UUID | None
    account_number: str
    account_status: str
    balance: Decimal
    arrears: Decimal
    days_in_arrears: int
    last_payment_date: date | None
    last_payment_amount: Decimal

    model_config = ConfigDict(from_attributes=True)


class MunicipalAccountDetailResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    account_number: str
    account_status: str
    balance: Decimal
    arrears: Decimal
    days_in_arrears: int
    last_payment_date: date | None = None
    last_payment_amount: Decimal = Decimal("0.00")
    customer: CustomerResponse | None = None
    property: PropertyResponse | None = None
    active_case: dict | None = None
    cases: list[dict] = []
    payments: list[dict] = []
    promises: list[dict] = []
    payment_plans: list[dict] = []

    model_config = ConfigDict(from_attributes=True)


class CollectionCaseCreate(BaseModel):
    tenant_id: UUID
    account_id: UUID
    status: str = "NEW"
    priority: int = 1
    strategy_code: str | None = None
    assigned_to: str | None = None


class CollectionCaseResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    account_id: UUID
    status: str
    priority: int
    strategy_code: str | None
    assigned_to: str | None
    opened_at: datetime
    closed_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class CaseStatusUpdate(BaseModel):
    status: str
    actor: str | None = None
    notes: str | None = None
    reason: str | None = None


class AuditEventResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    actor: str | None
    event_type: str
    entity_type: str | None
    entity_id: UUID | None
    payload: dict
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PromiseCreate(BaseModel):
    amount: Decimal
    due_date: date
    actor: str


class PromiseStatusUpdate(BaseModel):
    status: str
    actor: str
    reason: str | None = None


class PromiseResponse(BaseModel):
    id: UUID
    case_id: UUID
    amount: Decimal
    due_date: date
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PaymentPlanCreate(BaseModel):
    deposit_amount: Decimal = Decimal("0.00")
    installment_amount: Decimal
    frequency: str
    number_of_installments: int
    start_date: date
    actor: str


class PaymentPlanStatusUpdate(BaseModel):
    status: str
    actor: str
    reason: str | None = None


class PaymentPlanResponse(BaseModel):
    id: UUID
    case_id: UUID
    deposit_amount: Decimal
    installment_amount: Decimal
    frequency: str
    number_of_installments: int
    status: str
    start_date: date

    model_config = ConfigDict(from_attributes=True)


class PaymentCreate(BaseModel):
    tenant_id: UUID
    account_id: UUID
    amount: Decimal
    payment_date: date
    external_reference: str | None = None
    actor: str | None = None


class PaymentReconciliation(BaseModel):
    tenant_id: UUID
    actor: str


class PaymentImportRow(BaseModel):
    account_number: str
    amount: Decimal
    payment_date: date
    external_reference: str | None = None


class PaymentResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    account_id: UUID | None
    amount: Decimal
    payment_date: date
    external_reference: str | None
    reconciliation_status: str
    posted_at: datetime | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PaymentReconciliationUpdate(BaseModel):
    reconciliation_status: str
    actor: str | None = None
    notes: str | None = None


class WorkQueueItem(BaseModel):
    case_id: UUID
    account_id: UUID
    account_number: str
    customer_id: UUID | None = None
    customer_name: str | None = None
    mobile: str | None = None
    arrears: Decimal
    balance: Decimal
    days_in_arrears: int
    case_status: str
    case_priority: int
    strategy_code: str | None = None
    assigned_to: str | None = None
    next_action: str
    priority_score: int
    promise_due_date: date | None = None
    promise_amount: Decimal | None = None
    promise_status: str | None = None

    model_config = ConfigDict(from_attributes=True)


class CaseAssignmentUpdate(BaseModel):
    assigned_to: str
    actor: str | None = None


class ContactAttemptCreate(BaseModel):
    actor: str
    channel: str
    outcome: str
    notes: str | None = None
    next_action: str | None = None
    next_action_date: date | None = None


class ContactAttemptResponse(BaseModel):
    id: UUID
    case_id: UUID
    actor: str | None
    channel: str
    outcome: str
    notes: str | None
    next_action: str | None
    next_action_date: date | None
    created_at: datetime


class ContactHistoryItem(BaseModel):
    id: UUID
    actor: str | None
    channel: str
    outcome: str
    notes: str | None
    next_action: str | None
    next_action_date: date | None
    created_at: datetime


class CaseGenerationRequest(BaseModel):
    tenant_id: UUID
    min_arrears: Decimal = Decimal("500.00")
    min_days_in_arrears: int = 30
    actor: str = "system"


class CaseGenerationResult(BaseModel):
    tenant_id: UUID
    eligible_accounts: int
    cases_created: int
    cases_updated: int
    cases_closed: int
    skipped: int