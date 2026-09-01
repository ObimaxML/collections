import uuid
import hashlib
from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import (
    AuditEvent,
    Customer,
    MunicipalAccount,
    Tenant,
    User,
)
from app.models.legal_compliance import (
    DataProcessingAgreement,
    DataBreachIncident,
    MunicipalContractMandate,
    LegalDocument,
    UserLegalAcceptance,
)

router = APIRouter(
    prefix="/legal-compliance",
    tags=["Legal & Regulatory Compliance (POPIA, MFMA, ECTA, PAIA)"],
)


# -------------------------------------------------------------
# Schemas
# -------------------------------------------------------------

class DpaCreate(BaseModel):
    tenant_id: UUID
    agreement_version: str = "v1.0-2026"
    agreement_title: str = "POPIA Section 21 Operator Data Processing Agreement"
    agreement_text: str | None = None


class DpaSign(BaseModel):
    signed_by_name: str
    signed_by_position: str
    signer_ip_address: str | None = "127.0.0.1"


class DataBreachCreate(BaseModel):
    tenant_id: UUID | None = None
    incident_type: str = "UNAUTHORIZED_ACCESS_ATTEMPT"
    severity: str = "MEDIUM"  # LOW, MEDIUM, HIGH, CRITICAL
    description: str
    affected_subjects_count: int = 0
    affected_data_categories: str = "Debtor contact information and municipal balance"
    containment_actions: str | None = None
    reported_by: str = "Security Operations Unit"


class DataBreachUpdate(BaseModel):
    status: str
    containment_actions: str | None = None
    notify_municipality: bool = False
    notify_regulator: bool = False


class ContractMandateCreate(BaseModel):
    tenant_id: UUID
    mandate_reference: str
    contract_title: str
    contract_type: str = "COLLECTOR_MANDATE"  # COLLECTOR_MANDATE, PLATFORM_SLA, PANEL_APPOINTMENT
    vendor_party_name: str
    start_date: date
    end_date: date
    contract_value: Decimal | None = None
    contingency_commission_pct: Decimal | None = Decimal("10.00")
    scope_of_work: str | None = None
    mandate_document_url: str | None = None
    sla_response_time_hours: int = 24


class LegalDocumentCreate(BaseModel):
    doc_type: str  # TERMS_OF_USE, POPIA_COLLECTOR_NOTICE, POPIA_MUNICIPAL_NOTICE, POPIA_DEBTOR_NOTICE, PAIA_MANUAL
    title: str
    version: str
    content: str
    requires_reacceptance: bool = False


class UserAcceptanceCreate(BaseModel):
    user_id: UUID
    doc_type: str
    version_accepted: str


# -------------------------------------------------------------
# Default Standard POPIA Operator Agreement Template (s 21)
# -------------------------------------------------------------

DEFAULT_SECTION_21_DPA_TEXT = """
# POPIA SECTION 21 WRITTEN OPERATOR DATA PROCESSING AGREEMENT

**BETWEEN:**
1. **THE MUNICIPALITY / LOCAL AUTHORITY** (hereinafter referred to as the **"Responsible Party"**)
AND
2. **KHOKHISA DEBT COLLECTION OS (PTY) LTD** (hereinafter referred to as the **"Operator"**)

---

### 1. STATUTORY CONTEXT & MANDATE (POPIA ACT 4 OF 2013, S 20 & 21)
1.1 The Responsible Party has mandated the Operator to provide cloud-based debt recovery orchestration, debtor tracing verification, and algorithmic work queue processing.
1.2 In terms of Section 21(1) of the Protection of Personal Information Act (POPIA), the Operator must process personal information only with the knowledge or authorization of the Responsible Party and treat personal information which comes to its knowledge as confidential.

### 2. PLATFORM STATUS AS TECHNOLOGY OPERATOR ONLY
2.1 The platform operates strictly as a **technology intermediary/operator** and **never holds debtor funds**. All debtor repayments settle directly into verified statutory Collector Trust Accounts (s 9 Debt Collectors Act) or municipal primary revenue accounts.
2.2 The Operator processes personal information strictly in accordance with documented instructions from the Responsible Party.

### 3. MANDATORY SECURITY SAFEGUARDS (SECTION 19 POPIA)
3.1 The Operator warrants that it implements appropriate, reasonable technical and organizational measures to prevent loss of, damage to, or unauthorized destruction of personal information, and unlawful access to or processing of personal information.
3.2 Measures include AES-256 encryption at rest, TLS 1.3 in transit, Mandatory Multi-Factor Authentication (MFA), role-based access control (RBAC), and an immutable, tamper-evident audit log of every access, view, edit, or export of debtor records.

### 4. DATA RESIDENCY & CROSS-BORDER TRANSFERS (SECTION 72 POPIA)
4.1 All personal information and municipal debt books are hosted exclusively within the geographical borders of the **Republic of South Africa** (Johannesburg / Cape Town DCs).
4.2 No cross-border data transfer shall occur without the prior written authorization of the Responsible Party and verifiable Section 72 lawful adequacy safeguards.

### 5. DATA BREACH NOTIFICATION OBLIGATIONS (SECTION 22 POPIA)
5.1 The Operator shall notify the Responsible Party immediately upon becoming aware of or reasonably suspecting any unauthorized access to, acquisition of, or breach of personal information.
5.2 The notification shall enable the Responsible Party to satisfy its statutory disclosure obligations to the Information Regulator and affected data subjects without undue delay.

### 6. ELECTRONIC SIGNATURE & LEGAL EFFECT (ECTA ACT 25 OF 2002)
6.1 In terms of Section 13 of the Electronic Communications and Transactions Act (ECTA), the parties agree that this electronic execution constitutes an authentic, binding, and enforceable agreement.
"""

# -------------------------------------------------------------
# 1. POPIA Section 21 Operator Agreements
# -------------------------------------------------------------

@router.get("/operator-agreements")
def list_operator_agreements(
    tenant_id: str | None = None,
    db: Session = Depends(get_db),
):
    """
    List all POPIA Section 21 Written Operator Agreements.
    """
    query = select(DataProcessingAgreement).order_by(DataProcessingAgreement.created_at.desc())
    if tenant_id and tenant_id.upper() != "GLOBAL":
        try:
            query = query.where(DataProcessingAgreement.tenant_id == UUID(tenant_id))
        except ValueError:
            pass

    agreements = db.scalars(query).all()
    results = []
    for a in agreements:
        tenant = db.get(Tenant, a.tenant_id)
        results.append({
            "id": str(a.id),
            "tenant_id": str(a.tenant_id),
            "tenant_name": tenant.name if tenant else "Unknown Municipality",
            "tenant_code": tenant.code if tenant else "N/A",
            "agreement_version": a.agreement_version,
            "agreement_title": a.agreement_title,
            "agreement_text": a.agreement_text,
            "status": a.status,
            "signed_by_name": a.signed_by_name,
            "signed_by_position": a.signed_by_position,
            "signed_at": a.signed_at.isoformat() if a.signed_at else None,
            "signer_ip_address": a.signer_ip_address,
            "tamper_proof_hash": a.tamper_proof_hash,
            "created_at": a.created_at.isoformat(),
        })
    return results


@router.post("/operator-agreements")
def create_operator_agreement(
    payload: DpaCreate,
    actor: str = "Municipal Compliance Officer",
    db: Session = Depends(get_db),
):
    """
    Initialize a POPIA Section 21 Operator Agreement for a municipality.
    """
    tenant = db.get(Tenant, payload.tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Municipality not found.")

    text_content = payload.agreement_text or DEFAULT_SECTION_21_DPA_TEXT.replace(
        "THE MUNICIPALITY / LOCAL AUTHORITY",
        f"{tenant.name.upper()} ({tenant.code})"
    )

    dpa = DataProcessingAgreement(
        id=uuid.uuid4(),
        tenant_id=payload.tenant_id,
        agreement_version=payload.agreement_version,
        agreement_title=payload.agreement_title,
        agreement_text=text_content,
        status="PENDING_SIGNATURE",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(dpa)

    # Log audit event
    audit = AuditEvent(
        id=uuid.uuid4(),
        tenant_id=payload.tenant_id,
        actor=actor,
        event_type="POPIA_OPERATOR_AGREEMENT_CREATED",
        entity_type="DataProcessingAgreement",
        entity_id=dpa.id,
        payload={
            "version": dpa.agreement_version,
            "status": dpa.status,
            "tenant_name": tenant.name,
        },
        created_at=datetime.now(timezone.utc),
    )
    db.add(audit)

    db.commit()
    db.refresh(dpa)
    return {"message": "Operator Agreement created successfully.", "id": str(dpa.id)}


@router.post("/operator-agreements/{agreement_id}/sign")
def sign_operator_agreement(
    agreement_id: UUID,
    payload: DpaSign,
    db: Session = Depends(get_db),
):
    """
    ECTA Section 13 Compliant Electronic Execution of POPIA Section 21 Operator Agreement.
    """
    dpa = db.get(DataProcessingAgreement, agreement_id)
    if not dpa:
        raise HTTPException(status_code=404, detail="Operator Agreement not found.")

    now = datetime.now(timezone.utc)
    sig_raw = f"{dpa.id}:{dpa.agreement_version}:{payload.signed_by_name}:{payload.signed_by_position}:{now.isoformat()}"
    tamper_hash = hashlib.sha256(sig_raw.encode("utf-8")).hexdigest()

    dpa.signed_by_name = payload.signed_by_name
    dpa.signed_by_position = payload.signed_by_position
    dpa.signed_at = now
    dpa.signer_ip_address = payload.signer_ip_address or "127.0.0.1"
    dpa.tamper_proof_hash = tamper_hash
    dpa.status = "EXECUTED"
    dpa.updated_at = now

    # Audit log
    audit = AuditEvent(
        id=uuid.uuid4(),
        tenant_id=dpa.tenant_id,
        actor=payload.signed_by_name,
        event_type="POPIA_OPERATOR_AGREEMENT_EXECUTED",
        entity_type="DataProcessingAgreement",
        entity_id=dpa.id,
        payload={
            "signed_by": payload.signed_by_name,
            "position": payload.signed_by_position,
            "tamper_hash": tamper_hash,
            "signed_at": now.isoformat(),
        },
        created_at=now,
    )
    db.add(audit)

    db.commit()
    return {
        "message": "POPIA Section 21 Operator Agreement executed electronically under ECTA s 13.",
        "id": str(dpa.id),
        "tamper_hash": tamper_hash,
        "signed_at": now.isoformat(),
    }


# -------------------------------------------------------------
# 2. POPIA Section 22 Data Breach Incident Registry
# -------------------------------------------------------------

@router.get("/breach-incidents")
def list_breach_incidents(
    tenant_id: str | None = None,
    db: Session = Depends(get_db),
):
    """
    List security and data breach incidents logged under POPIA Section 22.
    """
    query = select(DataBreachIncident).order_by(DataBreachIncident.detected_at.desc())
    if tenant_id and tenant_id.upper() != "GLOBAL":
        try:
            query = query.where(
                or_(
                    DataBreachIncident.tenant_id == UUID(tenant_id),
                    DataBreachIncident.tenant_id.is_(None)
                )
            )
        except ValueError:
            pass

    incidents = db.scalars(query).all()
    results = []
    for inc in incidents:
        tenant = db.get(Tenant, inc.tenant_id) if inc.tenant_id else None
        results.append({
            "id": str(inc.id),
            "incident_reference": inc.incident_reference,
            "tenant_id": str(inc.tenant_id) if inc.tenant_id else None,
            "tenant_name": tenant.name if tenant else "Global / Platform-Wide",
            "severity": inc.severity,
            "status": inc.status,
            "incident_type": inc.incident_type,
            "description": inc.description,
            "affected_subjects_count": inc.affected_subjects_count,
            "affected_data_categories": inc.affected_data_categories,
            "containment_actions": inc.containment_actions,
            "municipality_notified_at": inc.municipality_notified_at.isoformat() if inc.municipality_notified_at else None,
            "regulator_notified_at": inc.regulator_notified_at.isoformat() if inc.regulator_notified_at else None,
            "reported_by": inc.reported_by,
            "detected_at": inc.detected_at.isoformat(),
            "resolved_at": inc.resolved_at.isoformat() if inc.resolved_at else None,
        })
    return results


@router.post("/breach-incidents")
def report_breach_incident(
    payload: DataBreachCreate,
    actor: str = "SecOps Lead",
    db: Session = Depends(get_db),
):
    """
    Log a suspected or confirmed data incident under POPIA Section 22.
    """
    inc_ref = f"INC-POPIA-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"

    inc = DataBreachIncident(
        id=uuid.uuid4(),
        incident_reference=inc_ref,
        tenant_id=payload.tenant_id,
        severity=payload.severity.upper(),
        status="INVESTIGATING",
        incident_type=payload.incident_type,
        description=payload.description,
        affected_subjects_count=payload.affected_subjects_count,
        affected_data_categories=payload.affected_data_categories,
        containment_actions=payload.containment_actions,
        reported_by=payload.reported_by,
        detected_at=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc),
    )
    db.add(inc)

    # Log audit event
    audit = AuditEvent(
        id=uuid.uuid4(),
        tenant_id=payload.tenant_id or uuid.UUID("00000000-0000-0000-0000-000000000000"),
        actor=actor,
        event_type="POPIA_BREACH_INCIDENT_REPORTED",
        entity_type="DataBreachIncident",
        entity_id=inc.id,
        payload={
            "incident_reference": inc_ref,
            "severity": inc.severity,
            "affected_count": inc.affected_subjects_count,
        },
        created_at=datetime.now(timezone.utc),
    )
    db.add(audit)

    db.commit()
    db.refresh(inc)
    return {"message": "Incident logged in Section 22 breach registry.", "incident_reference": inc_ref, "id": str(inc.id)}


@router.patch("/breach-incidents/{incident_id}")
def update_breach_incident(
    incident_id: UUID,
    payload: DataBreachUpdate,
    actor: str = "Information Officer",
    db: Session = Depends(get_db),
):
    """
    Update breach containment status or trigger statutory notifications to Municipalities & Information Regulator.
    """
    inc = db.get(DataBreachIncident, incident_id)
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found.")

    inc.status = payload.status.upper()
    if payload.containment_actions:
        inc.containment_actions = payload.containment_actions

    now = datetime.now(timezone.utc)
    if payload.notify_municipality and not inc.municipality_notified_at:
        inc.municipality_notified_at = now
    if payload.notify_regulator and not inc.regulator_notified_at:
        inc.regulator_notified_at = now

    if inc.status == "RESOLVED" and not inc.resolved_at:
        inc.resolved_at = now

    # Audit log
    audit = AuditEvent(
        id=uuid.uuid4(),
        tenant_id=inc.tenant_id or uuid.UUID("00000000-0000-0000-0000-000000000000"),
        actor=actor,
        event_type="POPIA_BREACH_STATUS_UPDATED",
        entity_type="DataBreachIncident",
        entity_id=inc.id,
        payload={
            "status": inc.status,
            "municipality_notified": bool(inc.municipality_notified_at),
            "regulator_notified": bool(inc.regulator_notified_at),
        },
        created_at=now,
    )
    db.add(audit)

    db.commit()
    return {"message": "Incident updated successfully.", "id": str(inc.id), "status": inc.status}


# -------------------------------------------------------------
# 3. MFMA Section 116 Contract & Mandate Register
# -------------------------------------------------------------

@router.get("/mandates")
def list_contract_mandates(
    tenant_id: str | None = None,
    db: Session = Depends(get_db),
):
    """
    List municipal contract mandates, collector SLAs, and expiry countdowns (30/14/7-day alerts).
    """
    query = select(MunicipalContractMandate).order_by(MunicipalContractMandate.end_date.asc())
    if tenant_id and tenant_id.upper() != "GLOBAL":
        try:
            query = query.where(MunicipalContractMandate.tenant_id == UUID(tenant_id))
        except ValueError:
            pass

    mandates = db.scalars(query).all()
    today = date.today()
    results = []

    for m in mandates:
        tenant = db.get(Tenant, m.tenant_id)
        days_remaining = (m.end_date - today).days

        # Evaluate live status based on dates
        status = m.status
        if days_remaining <= 0:
            status = "EXPIRED"
        elif days_remaining <= 30 and status == "ACTIVE":
            status = "EXPIRING_SOON"

        results.append({
            "id": str(m.id),
            "tenant_id": str(m.tenant_id),
            "tenant_name": tenant.name if tenant else "Municipality",
            "tenant_code": tenant.code if tenant else "N/A",
            "mandate_reference": m.mandate_reference,
            "contract_title": m.contract_title,
            "contract_type": m.contract_type,
            "vendor_party_name": m.vendor_party_name,
            "start_date": m.start_date.isoformat(),
            "end_date": m.end_date.isoformat(),
            "days_remaining": days_remaining,
            "contract_value": float(m.contract_value) if m.contract_value else None,
            "contingency_commission_pct": float(m.contingency_commission_pct) if m.contingency_commission_pct else None,
            "status": status,
            "scope_of_work": m.scope_of_work,
            "mandate_document_url": m.mandate_document_url,
            "sla_response_time_hours": m.sla_response_time_hours,
        })
    return results


@router.post("/mandates")
def create_contract_mandate(
    payload: ContractMandateCreate,
    actor: str = "Supply Chain Management",
    db: Session = Depends(get_db),
):
    """
    Register a new municipal contract mandate or platform SLA under MFMA Section 116.
    """
    tenant = db.get(Tenant, payload.tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Municipality not found.")

    mandate = MunicipalContractMandate(
        id=uuid.uuid4(),
        tenant_id=payload.tenant_id,
        mandate_reference=payload.mandate_reference,
        contract_title=payload.contract_title,
        contract_type=payload.contract_type,
        vendor_party_name=payload.vendor_party_name,
        start_date=payload.start_date,
        end_date=payload.end_date,
        contract_value=payload.contract_value,
        contingency_commission_pct=payload.contingency_commission_pct,
        status="ACTIVE",
        scope_of_work=payload.scope_of_work,
        mandate_document_url=payload.mandate_document_url,
        sla_response_time_hours=payload.sla_response_time_hours,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(mandate)

    # Audit log
    audit = AuditEvent(
        id=uuid.uuid4(),
        tenant_id=payload.tenant_id,
        actor=actor,
        event_type="MFMA_MANDATE_REGISTERED",
        entity_type="MunicipalContractMandate",
        entity_id=mandate.id,
        payload={
            "mandate_ref": mandate.mandate_reference,
            "vendor": mandate.vendor_party_name,
            "end_date": mandate.end_date.isoformat(),
        },
        created_at=datetime.now(timezone.utc),
    )
    db.add(audit)

    db.commit()
    db.refresh(mandate)
    return {"message": "MFMA contract mandate registered.", "id": str(mandate.id)}


# -------------------------------------------------------------
# 4. POPIA Section 19 Personal Information Access Audit Trail
# -------------------------------------------------------------

@router.get("/pii-access-logs")
def list_pii_access_logs(
    tenant_id: str | None = None,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """
    Audit log of every view, edit, export, or deletion of personal information.
    Most demanded POPIA control during municipal procurement tenders.
    """
    query = select(AuditEvent).where(
        AuditEvent.event_type.in_([
            "PII_ACCESS_VIEW",
            "PII_ACCESS_EXPORT",
            "PII_DATA_EDIT",
            "PII_DATA_DELETION",
            "POPIA_CONSENT_UPDATED",
            "POPIA_REQUEST_LOGGED",
            "POPIA_REQUEST_RESOLVED",
            "ACCOUNT_360_VIEWED",
        ])
    ).order_by(AuditEvent.created_at.desc()).limit(limit)

    if tenant_id and tenant_id.upper() != "GLOBAL":
        try:
            query = query.where(AuditEvent.tenant_id == UUID(tenant_id))
        except ValueError:
            pass

    events = db.scalars(query).all()
    results = []
    for ev in events:
        tenant = db.get(Tenant, ev.tenant_id)
        results.append({
            "id": str(ev.id),
            "tenant_id": str(ev.tenant_id),
            "tenant_name": tenant.name if tenant else "Municipality",
            "actor": ev.actor,
            "event_type": ev.event_type,
            "entity_type": ev.entity_type,
            "entity_id": str(ev.entity_id) if ev.entity_id else None,
            "payload": ev.payload,
            "created_at": ev.created_at.isoformat(),
        })
    return results


# -------------------------------------------------------------
# 5. Versioned In-App Legal Policies & ECTA User Acceptance
# -------------------------------------------------------------

DEFAULT_TERMS_OF_USE = """
# KHOKHISA DEBT COLLECTION OS — MASTER TERMS OF SERVICE

**Effective Date: 1 September 2026 | Version: v2.1-ZA**

### 1. NATURE OF SERVICE: TECHNOLOGY PLATFORM ONLY
1.1 Khokhisa Debt Collection OS provides cloud-native municipal revenue software, workflow automation, and algorithmic case routing.
1.2 **Khokhisa is a technology provider, not a debt collection agency.** Khokhisa does not engage in direct debt recovery, does not take cession of municipal book debts, and never receives, holds, or disburses debtor funds into its own accounts.

### 2. COLLECTOR STATUTORY COMPLIANCE & TRUST ACCOUNTS
2.1 All debt collection practitioners utilizing the platform warrant that they maintain active, unencumbered registration with the **Council for Debt Collectors (CFDC)** under Act 114 of 1998.
2.2 Collectors warrant that all debtor payments collected settle exclusively into verified statutory **Trust Accounts** (Section 9(1) of Act 114 of 1998) or directly into the designated municipal bank accounts.

### 3. POPIA ROLES & RESPONSIBILITIES
3.1 Municipalities act as the **Responsible Party** under Section 1 of the Protection of Personal Information Act (POPIA Act 4 of 2013).
3.2 The Platform acts strictly as an **Operator** under Section 21 of POPIA, processing debtor data only on documented municipal instructions.

### 4. LIMITATION OF LIABILITY
To the maximum extent permitted by South African law, Khokhisa shall not be liable for statutory non-compliance by third-party collectors, nor for municipal credit control determinations.
"""

DEFAULT_PRIVACY_POLICY = """
# KHOKHISA POPIA PRIVACY POLICY & DATA PROCESSING NOTICE

**In accordance with Sections 18, 19, and 51 of POPIA (Act 4 of 2013)**

### 1. WHAT DATA WE PROCESS
- **Debtors / Consumers:** Full names, ID numbers, contact numbers, residential addresses, municipal account numbers, arrears balances, payment records, and communication timestamps.
- **Municipal & Collector Users:** Name, official email address, role, IP address, and electronic signature logs.

### 2. LAWFUL BASIS & PURPOSE OF PROCESSING
Processing is necessary for:
- Performing statutory municipal credit control and debt recovery under the Municipal Systems Act 32 of 2000 (Section 96) and MFMA 56 of 2003.
- Compliance with the Debt Collectors Act 114 of 1998.
- Legitimate interests of the municipality in recovering public revenue.

### 3. SECURITY SAFEGUARDS (SECTION 19)
- High-grade AES-256 encryption at rest; TLS 1.3 encryption in transit.
- Role-Based Access Control (RBAC) and Multi-Factor Authentication.
- Complete audit logging of every query, view, edit, or export of debtor records.

### 4. DATA RESIDENCY (SECTION 72)
All databases and backup archives are hosted exclusively in **South Africa** (Johannesburg / Cape Town).

### 5. INFORMATION REGULATOR CONTACT DETAILS
- **JD House, 27 Stiemens Street, Braamfontein, Johannesburg, 2001**
- Email: `POPIAComplaints@inforegulator.org.za` / `enquiries@inforegulator.org.za`
"""

DEFAULT_PAIA_MANUAL = """
# SECTION 51 PROMOTION OF ACCESS TO INFORMATION ACT (PAIA) MANUAL

**Prepared in terms of Section 51 of the Promotion of Access to Information Act 2 of 2000 for Khokhisa Debt Collection OS (Pty) Ltd.**

### 1. CONTACT PARTICULARS
- **Information Officer:** Managing Director / Compliance Head
- **Email:** `privacy@khokhisa.co.za` | `compliance@khokhisa.co.za`
- **Postal Address:** Sandton City Financial Tower, Johannesburg, Gauteng, 2196

### 2. GUIDE OF THE INFORMATION REGULATOR (SECTION 10)
A guide on how to exercise PAIA rights is available from the Information Regulator.

### 3. ACCESS REQUEST PROCEDURE (SECTION 53)
Requests for access to records must be submitted in the prescribed Form 2 to the Information Officer.
"""


@router.get("/documents")
def list_legal_documents(
    doc_type: str | None = None,
    db: Session = Depends(get_db),
):
    """
    List active versioned legal documents (Terms of Use, POPIA notices, PAIA manual).
    """
    query = select(LegalDocument).where(LegalDocument.is_active == True)
    if doc_type:
        query = query.where(LegalDocument.doc_type == doc_type.upper())

    docs = db.scalars(query).all()

    # Seed defaults if empty
    if not docs:
        defaults = [
            ("TERMS_OF_USE", "Khokhisa Master Terms of Service & Operator Disclaimer", "v2.1-ZA", DEFAULT_TERMS_OF_USE),
            ("POPIA_PRIVACY_NOTICE", "POPIA Section 18 Privacy Notice & Data Subject Charter", "v2.1-ZA", DEFAULT_PRIVACY_POLICY),
            ("PAIA_MANUAL", "Section 51 PAIA Compliance Manual", "v1.0-2026", DEFAULT_PAIA_MANUAL),
        ]
        for dtype, dtitle, dver, dcontent in defaults:
            new_doc = LegalDocument(
                id=uuid.uuid4(),
                doc_type=dtype,
                title=dtitle,
                version=dver,
                content=dcontent,
                is_active=True,
                published_date=date.today(),
            )
            db.add(new_doc)
        db.commit()
        docs = db.scalars(query).all()

    return [
        {
            "id": str(d.id),
            "doc_type": d.doc_type,
            "title": d.title,
            "version": d.version,
            "content": d.content,
            "published_date": d.published_date.isoformat(),
            "requires_reacceptance": d.requires_reacceptance,
        }
        for d in docs
    ]


@router.post("/acceptances")
def record_user_acceptance(
    payload: UserAcceptanceCreate,
    req: Request,
    db: Session = Depends(get_db),
):
    """
    Record ECTA compliant electronic acceptance of legal terms by user.
    """
    user = db.get(User, payload.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    doc = db.scalar(
        select(LegalDocument).where(
            LegalDocument.doc_type == payload.doc_type.upper(),
            LegalDocument.version == payload.version_accepted,
        )
    )

    now = datetime.now(timezone.utc)
    client_ip = req.client.host if req.client else "127.0.0.1"
    user_agent = req.headers.get("user-agent", "Unknown Browser")
    raw_sig = f"{user.id}:{payload.doc_type}:{payload.version_accepted}:{now.isoformat()}:{client_ip}"
    acc_hash = hashlib.sha256(raw_sig.encode("utf-8")).hexdigest()

    acc = UserLegalAcceptance(
        id=uuid.uuid4(),
        user_id=user.id,
        legal_document_id=doc.id if doc else uuid.uuid4(),
        doc_type=payload.doc_type.upper(),
        version_accepted=payload.version_accepted,
        accepted_at=now,
        ip_address=client_ip,
        user_agent=user_agent,
        acceptance_hash=acc_hash,
    )
    db.add(acc)

    # Audit log
    audit = AuditEvent(
        id=uuid.uuid4(),
        tenant_id=user.tenant_id or uuid.UUID("00000000-0000-0000-0000-000000000000"),
        actor=user.full_name,
        event_type="LEGAL_TERMS_ACCEPTED_ECTA",
        entity_type="UserLegalAcceptance",
        entity_id=acc.id,
        payload={
            "doc_type": payload.doc_type,
            "version": payload.version_accepted,
            "acceptance_hash": acc_hash,
            "ip_address": client_ip,
        },
        created_at=now,
    )
    db.add(audit)

    db.commit()
    return {"message": "Legal terms acceptance logged under ECTA s 13.", "acceptance_hash": acc_hash}


@router.get("/acceptances/roster")
def list_user_acceptances(
    tenant_id: str | None = None,
    db: Session = Depends(get_db),
):
    """
    List user acceptance audit roster for municipal audit readiness.
    """
    acceptances = db.scalars(
        select(UserLegalAcceptance).order_by(UserLegalAcceptance.accepted_at.desc())
    ).all()

    results = []
    for a in acceptances:
        user = db.get(User, a.user_id)
        results.append({
            "id": str(a.id),
            "user_id": str(a.user_id),
            "user_name": user.full_name if user else "System User",
            "user_email": user.email if user else "N/A",
            "user_role": user.role if user else "USER",
            "doc_type": a.doc_type,
            "version_accepted": a.version_accepted,
            "accepted_at": a.accepted_at.isoformat(),
            "ip_address": a.ip_address,
            "acceptance_hash": a.acceptance_hash,
        })
    return results
