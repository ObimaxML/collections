import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.contact_attempt import ContactAttempt
from app.models.financial_ledger import FinancialTransaction
from app.models.import_staging import ImportBatch, ImportRow


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    engagement_model: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="MANAGED_SERVICE",
    )  # MANAGED_SERVICE, SAAS_SELF_SERVICE
    subscription_tier: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="ENTERPRISE",
    )  # STARTER, PROFESSIONAL, ENTERPRISE, OUTSOURCED_COMMISSION
    commission_rate: Mapped[Decimal | None] = mapped_column(
        Numeric(precision=5, scale=2),
        nullable=True,
        default=Decimal("10.00"),
    )
    monthly_subscription_fee: Mapped[Decimal | None] = mapped_column(
        Numeric(precision=12, scale=2),
        nullable=True,
        default=Decimal("0.00"),
    )
    subscription_status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="ACTIVE",
    )  # ACTIVE, TRIAL, SUSPENDED, EXPIRED
    billing_contact_email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    contract_start_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )
    contract_end_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    customers = relationship("Customer", back_populates="tenant")
    properties = relationship("Property", back_populates="tenant")
    municipal_accounts = relationship(
        "MunicipalAccount",
        back_populates="tenant",
    )
    collection_cases = relationship(
        "CollectionCase",
        back_populates="tenant",
    )
    payments = relationship("Payment", back_populates="tenant")
    audit_events = relationship("AuditEvent", back_populates="tenant")
    users = relationship("User", secondary="user_tenants", back_populates="tenants")


class UserTenant(Base):
    __tablename__ = "user_tenants"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
    )
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id"),
        nullable=True,
        index=True,
    )
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )
    hashed_password: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    full_name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )
    role: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="ADMIN",
    )  # SUPERADMIN, ADMIN, COLLECTOR, AUDITOR
    is_active: Mapped[bool] = mapped_column(
        nullable=False,
        default=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    tenant = relationship(
        "Tenant",
        foreign_keys=[tenant_id],
    )
    tenants = relationship(
        "Tenant",
        secondary="user_tenants",
        back_populates="users",
    )


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id"),
        nullable=False,
        index=True,
    )
    first_name: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )
    last_name: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )
    id_number: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        index=True,
    )
    company_registration: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    mobile: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )
    email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    metadata_: Mapped[dict | None] = mapped_column(
        "metadata",
        JSON,
        nullable=True,
        default=dict,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    tenant = relationship("Tenant", back_populates="customers")

    municipal_accounts = relationship(
        "MunicipalAccount",
        back_populates="customer",
    )


class Property(Base):
    __tablename__ = "properties"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id"),
        nullable=False,
        index=True,
    )
    property_reference: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        index=True,
    )
    address: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    tenant = relationship("Tenant", back_populates="properties")

    municipal_accounts = relationship(
        "MunicipalAccount",
        back_populates="property",
    )


class MunicipalAccount(Base):
    __tablename__ = "municipal_accounts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id"),
        nullable=False,
        index=True,
    )
    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customers.id"),
        nullable=True,
    )
    property_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("properties.id"),
        nullable=True,
    )
    account_number: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    account_status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    balance: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
    )
    arrears: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
    )
    days_in_arrears: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    last_payment_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )
    last_payment_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
    )
    metadata_: Mapped[dict | None] = mapped_column(
        "metadata",
        JSON,
        nullable=True,
        default=dict,
    )

    tenant = relationship(
        "Tenant",
        back_populates="municipal_accounts",
    )
    customer = relationship(
        "Customer",
        back_populates="municipal_accounts",
    )
    property = relationship(
        "Property",
        back_populates="municipal_accounts",
    )

    collection_cases = relationship(
        "CollectionCase",
        back_populates="account",
    )
    payments = relationship(
        "Payment",
        back_populates="account",
    )


class CollectionCase(Base):
    __tablename__ = "collection_cases"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id"),
        nullable=False,
        index=True,
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("municipal_accounts.id"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    priority: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    strategy_code: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    assigned_to: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )
    opened_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    closed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    tenant = relationship(
        "Tenant",
        back_populates="collection_cases",
    )
    account = relationship(
        "MunicipalAccount",
        back_populates="collection_cases",
    )

    promises = relationship(
        "Promise",
        back_populates="case",
    )
    payment_plans = relationship(
        "PaymentPlan",
        back_populates="case",
    )
    activities = relationship(
        "CollectionActivity",
        back_populates="case",
        order_by="CollectionActivity.created_at.desc()",
    )
    contact_attempts = relationship(
        "ContactAttempt",
        back_populates="case",
    )


class CollectionActivity(Base):
    __tablename__ = "collection_activities"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id"),
        nullable=False,
        index=True,
    )

    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("collection_cases.id"),
        nullable=False,
        index=True,
    )

    actor: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    channel: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    outcome: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    successful: Mapped[bool] = mapped_column(
        nullable=False,
        default=False,
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    next_action: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )

    next_action_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    tenant = relationship(
        "Tenant",
    )

    case = relationship(
        "CollectionCase",
        back_populates="activities",
    )


class CaseActivity(Base):
    __tablename__ = "case_activities"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("collection_cases.id"),
        nullable=False,
        index=True,
    )

    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id"),
        nullable=True,
        index=True,
    )

    activity_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )

    channel: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    outcome: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    actor: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        index=True,
    )

    case = relationship(
        "CollectionCase",
    )

    tenant = relationship(
        "Tenant",
    )


class Promise(Base):
    __tablename__ = "promises"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
    )
    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("collection_cases.id"),
        nullable=False,
        index=True,
    )
    amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
    )
    due_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    case = relationship(
        "CollectionCase",
        back_populates="promises",
    )
    allocations = relationship(
        "PaymentAllocation",
        back_populates="promise",
    )


class PaymentPlan(Base):
    __tablename__ = "payment_plans"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
    )
    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("collection_cases.id"),
        nullable=False,
        index=True,
    )
    deposit_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
    )
    installment_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
    )
    frequency: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
    )
    number_of_installments: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    start_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )

    case = relationship(
        "CollectionCase",
        back_populates="payment_plans",
    )


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id"),
        nullable=False,
        index=True,
    )
    account_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("municipal_accounts.id"),
        nullable=True,
        index=True,
    )
    amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
    )
    payment_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )
    external_reference: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        index=True,
    )
    reconciliation_status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    posted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    tenant = relationship(
        "Tenant",
        back_populates="payments",
    )
    account = relationship(
        "MunicipalAccount",
        back_populates="payments",
    )
    allocations = relationship(
        "PaymentAllocation",
        back_populates="payment",
    )


class PaymentAllocation(Base):
    __tablename__ = "payment_allocations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
    )

    payment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("payments.id"),
        nullable=False,
        index=True,
    )

    promise_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("promises.id"),
        nullable=True,
        index=True,
    )

    amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
    )

    allocation_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    payment = relationship(
        "Payment",
        back_populates="allocations",
    )

    promise = relationship(
        "Promise",
        back_populates="allocations",
    )


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id"),
        nullable=False,
        index=True,
    )
    actor: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )
    event_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )
    entity_type: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    entity_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
    )
    payload: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )

    tenant = relationship(
        "Tenant",
        back_populates="audit_events",
    )


__all__ = [
    "Tenant",
    "User",
    "Customer",
    "Property",
    "MunicipalAccount",
    "CollectionCase",
    "CollectionActivity",
    "CaseActivity",
    "Promise",
    "PaymentPlan",
    "Payment",
    "PaymentAllocation",
    "AuditEvent",
    "ContactAttempt",
    "FinancialTransaction",
    "ImportBatch",
    "ImportRow",
]