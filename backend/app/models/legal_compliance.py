import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from sqlalchemy import (
    Boolean,
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


class DataProcessingAgreement(Base):
    """
    POPIA Section 21 Operator Agreement between Municipality (Responsible Party)
    and Platform (Operator).
    """
    __tablename__ = "data_processing_agreements"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id"),
        nullable=False,
        index=True,
    )
    agreement_version: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="v1.0-2026",
    )
    agreement_title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        default="POPIA Section 21 Operator Data Processing Agreement",
    )
    agreement_text: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="DRAFT",  # DRAFT, PENDING_SIGNATURE, EXECUTED, SUPERSEDED
    )
    signed_by_name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    signed_by_position: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    signed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    signer_ip_address: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    tamper_proof_hash: Mapped[str | None] = mapped_column(
        String(128),
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


class DataBreachIncident(Base):
    """
    POPIA Section 22 Incident & Breach Notification Register.
    """
    __tablename__ = "data_breach_incidents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    incident_reference: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
    )
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id"),
        nullable=True,
    )
    severity: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="MEDIUM",  # LOW, MEDIUM, HIGH, CRITICAL
    )
    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="INVESTIGATING",  # INVESTIGATING, CONTAINED, NOTIFIED_MUNICIPALITY, REPORTED_REGULATOR, RESOLVED
    )
    incident_type: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )  # e.g., UNAUTHORIZED_ACCESS_ATTEMPT, CREDENTIAL_LEAK, EXPORT_ANOMALY, LOSS_OF_INTEGRITY
    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    affected_subjects_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )
    affected_data_categories: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )  # e.g., Names, ID Numbers, Account Numbers, Contact Info
    containment_actions: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    municipality_notified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    regulator_notified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    reported_by: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    detected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )


class MunicipalContractMandate(Base):
    """
    MFMA Municipal Contract & Collector Mandate Register (Section 116 MFMA).
    """
    __tablename__ = "municipal_contract_mandates"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id"),
        nullable=False,
        index=True,
    )
    mandate_reference: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        unique=True,
    )
    contract_title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    contract_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        default="COLLECTOR_MANDATE",  # COLLECTOR_MANDATE, PLATFORM_SLA, PANEL_APPOINTMENT
    )
    vendor_party_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    start_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )
    end_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )
    contract_value: Mapped[Decimal | None] = mapped_column(
        Numeric(precision=14, scale=2),
        nullable=True,
    )
    contingency_commission_pct: Mapped[Decimal | None] = mapped_column(
        Numeric(precision=5, scale=2),
        nullable=True,
    )
    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="ACTIVE",  # ACTIVE, EXPIRING_SOON, EXPIRED, TERMINATED
    )
    scope_of_work: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    mandate_document_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )
    sla_response_time_hours: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=24,
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


class LegalDocument(Base):
    """
    Versioned in-app legal policies & notices (Terms of Use, POPIA Privacy Notice, PAIA Manual).
    """
    __tablename__ = "legal_documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    doc_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )  # TERMS_OF_USE, POPIA_COLLECTOR_NOTICE, POPIA_MUNICIPAL_NOTICE, POPIA_DEBTOR_NOTICE, PAIA_MANUAL
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    version: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )
    published_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        default=date.today,
    )
    requires_reacceptance: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )


class UserLegalAcceptance(Base):
    """
    ECTA Section 13 Compliant Electronic Acceptance Log per User and Legal Document.
    """
    __tablename__ = "user_legal_acceptances"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    legal_document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("legal_documents.id"),
        nullable=False,
    )
    doc_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    version_accepted: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    accepted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    ip_address: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    user_agent: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )
    acceptance_hash: Mapped[str | None] = mapped_column(
        String(128),
        nullable=True,
    )
