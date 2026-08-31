import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    JSON,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Proposal(Base):
    __tablename__ = "proposals"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    proposal_number: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    engagement_model: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="MANAGED_SERVICE",
    )  # MANAGED_SERVICE, SAAS_SELF_SERVICE, HYBRID
    subscription_tier: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="ENTERPRISE",
    )  # STARTER, PROFESSIONAL, ENTERPRISE, OUTSOURCED_COMMISSION
    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="DRAFT",
    )  # DRAFT, SUBMITTED_TO_MUNICIPALITY, APPROVED, REJECTED, EXPIRED
    total_amount: Mapped[Decimal] = mapped_column(
        Numeric(precision=14, scale=2),
        nullable=False,
        default=Decimal("0.00"),
    )
    vat_amount: Mapped[Decimal] = mapped_column(
        Numeric(precision=14, scale=2),
        nullable=False,
        default=Decimal("0.00"),
    )
    monthly_fee: Mapped[Decimal | None] = mapped_column(
        Numeric(precision=14, scale=2),
        nullable=True,
        default=Decimal("0.00"),
    )
    commission_rate: Mapped[Decimal | None] = mapped_column(
        Numeric(precision=5, scale=2),
        nullable=True,
        default=Decimal("10.00"),
    )
    valid_until: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )
    scope_of_work: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    terms_and_conditions: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    line_items: Mapped[list] = mapped_column(
        JSON,
        nullable=False,
        default=list,
    )
    approved_by: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )
    approved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_by: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    tenant = relationship("Tenant")


class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    proposal_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("proposals.id", ondelete="SET NULL"),
        nullable=True,
    )
    invoice_number: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
    )
    billing_period: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )  # e.g., "August 2026", "2026-08"
    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="DRAFT",
    )  # DRAFT, ISSUED, PAID, OVERDUE, CANCELLED
    issue_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        default=date.today,
    )
    due_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )
    subtotal: Mapped[Decimal] = mapped_column(
        Numeric(precision=14, scale=2),
        nullable=False,
        default=Decimal("0.00"),
    )
    vat_rate: Mapped[Decimal] = mapped_column(
        Numeric(precision=5, scale=2),
        nullable=False,
        default=Decimal("15.00"),
    )
    vat_amount: Mapped[Decimal] = mapped_column(
        Numeric(precision=14, scale=2),
        nullable=False,
        default=Decimal("0.00"),
    )
    total_amount: Mapped[Decimal] = mapped_column(
        Numeric(precision=14, scale=2),
        nullable=False,
        default=Decimal("0.00"),
    )
    paid_amount: Mapped[Decimal] = mapped_column(
        Numeric(precision=14, scale=2),
        nullable=False,
        default=Decimal("0.00"),
    )
    line_items: Mapped[list] = mapped_column(
        JSON,
        nullable=False,
        default=list,
    )
    banking_details: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
        default=lambda: {
            "bank_name": "First National Bank (FNB)",
            "account_name": "Khokhisa (Pty) Ltd - Khokhisa Collections",
            "account_number": "62899432101",
            "branch_code": "250655",
            "account_type": "Business Cheque Account",
            "swift_code": "FIRNZAJJ",
            "payment_reference": "INV-MOLMOS",
        },
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

    tenant = relationship("Tenant")
    proposal = relationship("Proposal")
