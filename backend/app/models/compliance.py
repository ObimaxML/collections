from datetime import date, datetime, timezone
from decimal import Decimal
import uuid

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
    JSON,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class CollectorProfile(Base):
    """
    Council for Debt Collectors (CFDC) registration and compliance profile for collectors.
    """
    __tablename__ = "collector_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    cfdc_registration_number: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )
    cfdc_expiry_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
    )
    cfdc_certificate_url: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    kyc_documents: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
        default=dict,
    )
    compliance_status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="PENDING_VERIFICATION",  # VERIFIED, PENDING_VERIFICATION, SUSPENDED, REJECTED
        index=True,
    )
    suspension_reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    last_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    verified_by: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    user = relationship("User", backref="collector_profile")
    trust_account = relationship("CollectorTrustAccount", back_populates="collector_profile", uselist=False, cascade="all, delete-orphan")
    assignments = relationship("CollectorMunicipalAssignment", back_populates="collector_profile", cascade="all, delete-orphan")
    remittances = relationship("CollectorRemittance", back_populates="collector_profile", cascade="all, delete-orphan")


class CollectorTrustAccount(Base):
    """
    Statutory Trust Account maintained by registered debt collectors (Debt Collectors Act).
    """
    __tablename__ = "collector_trust_accounts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    collector_profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("collector_profiles.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    bank_name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )
    branch_code: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    account_number: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    account_holder_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    bank_confirmation_letter_url: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    auditor_letter_url: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    last_audit_report_url: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    audit_due_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
    )
    verification_status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="PENDING",  # VERIFIED, PENDING, REJECTED, REVOKED
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    collector_profile = relationship("CollectorProfile", back_populates="trust_account")


class CollectorMunicipalAssignment(Base):
    """
    Many-to-Many assignment relationship between Collectors and Municipalities (Tenants).
    Only Municipality Admins can approve or remove collectors.
    """
    __tablename__ = "collector_municipal_assignments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    collector_profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("collector_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    assigned_by: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )
    assigned_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="PENDING_APPROVAL",  # PENDING_APPROVAL, ACTIVE, SUSPENDED, REMOVED
        index=True,
    )
    approved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    approved_by: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )
    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    collector_profile = relationship("CollectorProfile", back_populates="assignments")
    tenant = relationship("Tenant", backref="collector_assignments")


class CollectorRemittance(Base):
    """
    Trust account remittance tracking to the municipality's configured bank account.
    """
    __tablename__ = "collector_remittances"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    collector_profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("collector_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    payment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("payments.id", ondelete="SET NULL"),
        nullable=True,
    )
    debtor_reference: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )
    amount_received: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
    )
    receipt_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )
    commission_rate: Mapped[Decimal] = mapped_column(
        Numeric(5, 2),
        nullable=False,
        default=Decimal("10.00"),
    )
    commission_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        default=Decimal("0.00"),
    )
    remittance_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
    )
    remittance_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )
    remittance_status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="PENDING",  # PENDING, REMITTED, RECONCILED
        index=True,
    )
    bank_statement_ref: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    collector_profile = relationship("CollectorProfile", back_populates="remittances")
    tenant = relationship("Tenant", backref="collector_remittances")
    payment = relationship("Payment")
