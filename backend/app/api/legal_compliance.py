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

DEFAULT_TERMS_OF_USE = """# TERMS OF USE
Khokhisa Debt Collection OS — Version 1.0 | Effective date: 1 September 2026

### 1. INTRODUCTION AND ACCEPTANCE
1.1 These Terms of Use ("Terms") govern access to and use of Khokhisa Debt Collection OS ("the Platform"), operated by Khokhisa Technologies (Pty) Ltd, registration number 2014/032353/07, a company incorporated in South Africa ("we", "us", "the Platform Operator").
1.2 By registering an account, accessing, or using the Platform, you agree to be bound by these Terms, our Privacy Policy, and any commercial terms applicable to your subscription. If you do not agree, do not use the Platform.
1.3 If you use the Platform on behalf of a municipality, company, or other entity, you warrant that you are authorised to bind that entity, and "you" includes that entity.

### 2. DEFINITIONS
"Act" means the Debt Collectors Act 114 of 1998, including its regulations and code of conduct; "CFDC" means the Council for Debt Collectors; "Collector" means a debt collector registered with the CFDC and verified on the Platform; "Municipality" means a municipality as defined in the Local Government: Municipal Systems Act 32 of 2000 that subscribes to the Platform; "Debtor" means a person whose municipal account is managed through the Platform; "POPIA" means the Protection of Personal Information Act 4 of 2013.

### 3. NATURE OF THE PLATFORM
3.1 The Platform is a software and workflow tool only. We are not a debt collector, do not perform debt collection, and do not provide legal, financial, or debt counselling advice.
3.2 The Platform never takes possession, custody, or control of Debtor funds. All payments are made directly into the Collector's trust account contemplated in section 20(1) of the Act, or directly into the Municipality's bank account, as configured.
3.3 The Platform is not a party to any collection mandate between a Municipality and a Collector, and is not responsible for the conduct of Collectors or the instructions of Municipalities.

### 4. ELIGIBILITY AND ACCOUNTS
4.1 You must provide accurate, current, and complete registration information and keep it updated.
4.2 You are responsible for safeguarding your login credentials, for all activity under your account, and for notifying us immediately at security@khokhisa.co.za of any unauthorised access. Accounts are personal and may not be shared.
4.3 We may refuse, suspend, or terminate accounts that provide false information or breach these Terms.

### 5. COLLECTOR-SPECIFIC TERMS
5.1 To register as a Collector you must: (a) hold valid, current registration with the CFDC under section 8 of the Act; (b) maintain a separate trust account as required by section 20(1) of the Act and provide verified details of that account; (c) complete our identity/KYC verification; and (d) submit your annual trust account audit report within the period prescribed by the Act.
5.2 Verification on the Platform is an administrative control only. It does not certify, replace, or constitute CFDC registration, and we make no representation that any Collector is compliant with the Act.
5.3 You must comply with the Act, its code of conduct, and all prescribed fee caps at all times. You may only charge or recover collection fees lawfully due to a registered debt collector.
5.4 You may only act for Municipalities to which you have been assigned on the Platform, and only within the scope of your mandate from that Municipality.
5.5 If your CFDC registration lapses or expires, your trust account verification is withdrawn, or your audit becomes overdue, the Platform will automatically suspend your collection access and notify your assigned Municipalities. This suspension is a protective administrative measure and does not constitute a finding of non-compliance by us.
5.6 You may not harass, threaten, or mislead Debtors, and must conduct all collection activity lawfully and within the code of conduct.

### 6. MUNICIPALITY-SPECIFIC TERMS
6.1 The Municipality warrants that: (a) it has lawful authority to appoint and instruct Collectors; (b) debtor data uploaded to the Platform is accurate and lawfully obtained; and (c) its use of the Platform complies with the Local Government: Municipal Finance Management Act 56 of 2003 and its own supply chain management policy.
6.2 The Municipality is the responsible party under POPIA for all debtor personal information processed through the Platform, and must ensure a lawful basis exists for all instructions given through the Platform.
6.3 The Municipality is responsible for approving, managing, and removing Collectors assigned to it, and for the actions of its own users.

### 7. DEBTOR PORTAL
7.1 Debtor portal access is provided on behalf of the relevant Municipality and/or assigned Collector. Account-specific debt queries, disputes, and payment arrangements must be directed to that Municipality or Collector, not to the Platform Operator.
7.2 Payment confirmations displayed on the portal are subject to bank settlement and reconciliation by the receiving account holder.

### 8. ACCEPTABLE USE
You may not: (a) use the Platform for any unlawful purpose; (b) process personal information outside an authorised mandate or lawful basis; (c) harass, intimidate, or mislead any person through the Platform; (d) attempt to gain unauthorised access to any part of the Platform or another user's data; (e) reverse engineer, copy, or scrape the Platform except as permitted by law; or (f) introduce malware or disrupt the Platform.

### 9. INTELLECTUAL PROPERTY
9.1 The Platform, including all software, design, and documentation, is owned by or licensed to the Platform Operator. We grant you a limited, non-exclusive, non-transferable, revocable licence to use the Platform for its intended purpose while your account is active.
9.2 You retain all ownership of data you upload. You grant us a limited licence to host, process, and display that data solely to provide the Platform services.

### 10. DISCLAIMERS
10.1 The Platform is provided "as is" and "as available". To the extent permitted by law, we disclaim all warranties, express or implied, including merchantability, fitness for a particular purpose, and non-infringement.
10.2 We do not warrant that the Platform will be uninterrupted or error-free, that debtor data uploaded by Municipalities is accurate, or that any Collector is or will remain compliant with the Act.
10.3 Nothing in these Terms excludes liability that cannot be excluded under the Consumer Protection Act 68 of 2008, the Electronic Communications and Transactions Act 25 of 2002, or other applicable law.

### 11. LIMITATION OF LIABILITY
To the maximum extent permitted by law: (a) we are not liable for the conduct of any Collector or Municipality, for payment gateway or banking failures, or for indirect, consequential, special, or punitive damages, including loss of revenue or data; and (b) our total aggregate liability arising from or relating to the Platform is limited to the subscription fees paid by you in the 12 months preceding the claim.

### 12. INDEMNIFICATION
Collectors and Municipalities each indemnify the Platform Operator against all claims, losses, fines, and expenses (including reasonable legal costs) arising from: (a) their unlawful collection conduct or breach of the Act; (b) unlawful or unauthorised processing instructions; or (c) their breach of these Terms.

### 13. SUSPENSION AND TERMINATION
13.1 We may suspend or terminate access for material breach, unlawful use, non-payment (subject to the commercial terms), or where required by law or a regulator.
13.2 On termination, you may export your data within 30 days, after which it will be deleted in accordance with our retention policy, subject to legal retention obligations.
13.3 Clauses that by their nature should survive (including liability, indemnity, IP, and dispute clauses) survive termination.

### 14. PRIVACY
Your use of the Platform is subject to our Privacy Policy. Municipalities remain the responsible parties under POPIA; the Platform acts as operator as described in the Privacy Policy and applicable operator agreements.

### 15. GOVERNING LAW AND DISPUTES
15.1 These Terms are governed by the laws of South Africa.
15.2 Disputes will follow this escalation: (a) written notice and good-faith negotiation for 30 days; (b) failing resolution, mediation; (c) failing mediation, the courts of South Africa, and you consent to the jurisdiction of the Gauteng Division of the High Court, Johannesburg.
15.3 Nothing prevents either party from seeking urgent interim relief.

### 16. AMENDMENTS
We may update these Terms with at least 30 days' notice. Material changes require re-acceptance before continued use; otherwise, continued use after the effective date constitutes acceptance. Previous versions are available on request.

### 17. GENERAL
17.1 These Terms, together with the Privacy Policy and any commercial terms, are the whole agreement between you and us regarding the Platform.
17.2 If any provision is unenforceable, the remainder continues in force. No waiver is effective unless in writing. You may not cede or delegate your rights or obligations without our consent.
17.3 Notices may be given electronically in accordance with ECTA, to the addresses in the Contact section of the Platform.
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

DEFAULT_COMMERCIAL_TERMS = """# COMMERCIAL TERMS & CONDITIONS
Khokhisa Debt Collection OS — Version 1.0 | Effective date: 1 September 2026

### 1. SUBSCRIPTIONS AND PRICING
1.1 The Platform is offered under the subscription tiers published in the platform tier matrix. Fees are quoted in South African Rand (ZAR) and are exclusive of Value-Added Tax under the Value-Added Tax Act 89 of 1991 (unless otherwise explicitly stated in an executed Order Form).
1.2 Subscription fees are based on the contracted engagement tier structure (per municipality portfolio size, collector user seats, and debtor account volume), as selected at municipal sign-up or stipulated in an official municipal proposal / SLA.

### 2. BILLING AND PAYMENT
2.1 Subscriptions are billed monthly or annually in advance. Invoices are payable within 30 days of invoice date.
2.2 Accepted payment methods: Electronic Funds Transfer (EFT), direct bank debit order, or corporate card.
2.3 Overdue amounts attract interest at the maximum rate permitted by the National Credit Act 34 of 2005 / applicable South African law. We may suspend platform access after written notice and a statutory grace period of 15 business days. Suspension for non-payment will never result in immediate deletion of Municipal data; data remains securely exportable in standard formats for 30 days after suspension.

### 3. COMMISSION AND COLLECTION FEES
3.1 The Platform does not deduct, hold, or pay collection commission. Any collection fees or contingency commissions are strictly a matter between the Collector and the Municipality, and may only be charged by Collectors holding valid CFDC registration, within the fee caps prescribed under the Debt Collectors Act 114 of 1998 and applicable regulations (max 18% / R2,500 statutory cap).
3.2 The Platform's fee-calculation, remittance tracking, and statement generation features are administrative tools only; the Collector and Municipality remain responsible for the statutory lawfulness of all amounts charged.

### 4. SERVICE LEVELS (SLA)
4.1 Target uptime: 99.5% per calendar month, excluding scheduled maintenance performed during standard maintenance windows (Sundays 02:00–05:00 SAST) with at least 48 hours' advance notice.
4.2 Support response targets:
  - Critical Severity (service down / security anomaly): 4 business hours.
  - Standard Severity (operational workflow query): 1 business day.
  - General Administrative Queries: 2 business days.
4.3 If monthly uptime falls below the target, the subscriber is entitled to a service credit of 10% of that month's subscription fee, claimed within 30 days. Service credits represent the primary administrative remedy for uptime failures to the extent permitted by law.

### 5. CANCELLATION AND REFUNDS
5.1 Subscriptions may be cancelled on 30 days' written notice. Annual subscriptions cancelled early are refunded pro rata for full unused calendar months, less any volume discounts applied for annual commitment.
5.2 We do not refund partial months or fees for periods where the service was operational and available.
5.3 On cancellation or expiry, the subscriber may export all municipal debt books, customer records, and transaction logs in standard machine-readable format (CSV/JSON) within 30 days, after which data is securely purged in accordance with our retention policy.

### 6. MUNICIPAL PROCUREMENT & MFMA COMPLIANCE
6.1 Our contracting terms are structured to be fully compatible with the Local Government: Municipal Finance Management Act 56 of 2003 (MFMA), the Municipal Systems Act 32 of 2000, and municipal supply chain management policies.
6.2 A contract register entry (MFMA s 116) and all compliance documentation required for municipal procurement (SARS Tax Clearance PIN, B-BBEE Level 1 Certificate, CSD Registration Report, CIPC Company Registration) are readily available.
6.3 Where a Municipality's procurement framework requires termination-for-convenience rights or council-specific governance terms, these are incorporated by addendum.
6.4 Subscriptions do not auto-renew into binding commitments inconsistent with municipal budget cycles; renewal quotes and Section 116 review packs are issued 60 days prior to contract expiry.

### 7. CHANGES TO COMMERCIAL TERMS
We may update commercial pricing or terms on 60 days' written notice, effective at the next municipal contract renewal cycle. Continued use after renewal constitutes acceptance.
"""


@router.get("/documents")
def list_legal_documents(
    doc_type: str | None = None,
    db: Session = Depends(get_db),
):
    """
    List active versioned legal documents (Terms of Use, Commercial Terms, POPIA notices, PAIA manual).
    """
    query = select(LegalDocument).where(LegalDocument.is_active == True)
    if doc_type:
        query = query.where(LegalDocument.doc_type == doc_type.upper())

    docs = db.scalars(query).all()

    # Seed defaults if empty
    if not docs:
        defaults = [
            ("TERMS_OF_USE", "Khokhisa Master Terms of Service & Operator Disclaimer", "v1.0", DEFAULT_TERMS_OF_USE),
            ("COMMERCIAL_TERMS", "Khokhisa SaaS Commercial Terms & Conditions", "v1.0", DEFAULT_COMMERCIAL_TERMS),
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
