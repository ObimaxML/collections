import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import (
    AuditEvent,
    CollectionCase,
    Payment,
    Tenant,
    User,
)
from app.models.compliance import (
    CollectorProfile,
    CollectorTrustAccount,
    CollectorMunicipalAssignment,
    CollectorRemittance,
)
from app.schemas.compliance import (
    CollectorProfileCreate,
    CollectorProfileUpdate,
    CollectorProfileResponse,
    CollectorTrustAccountCreate,
    CollectorTrustAccountUpdate,
    CollectorAssignmentRequest,
    CollectorAssignmentAction,
    RemittanceRecordCreate,
    RemittanceStatusUpdate,
    RemittanceStatementResponse,
)
from app.services.compliance import (
    evaluate_collector_compliance,
    get_or_create_collector_profile,
    run_compliance_audit_job,
    calculate_statutory_remittance,
    check_and_enforce_collector_action_allowed,
)

router = APIRouter(
    prefix="/compliance",
    tags=["Collector Compliance & Trust Accounts"],
)


def _format_collector_profile(profile: CollectorProfile, db: Session) -> dict:
    user = db.get(User, profile.user_id)
    trust = db.scalar(
        select(CollectorTrustAccount).where(CollectorTrustAccount.collector_profile_id == profile.id)
    )
    assignments = db.scalars(
        select(CollectorMunicipalAssignment).where(CollectorMunicipalAssignment.collector_profile_id == profile.id)
    ).all()

    today = date.today()
    days_cfdc = (profile.cfdc_expiry_date - today).days if profile.cfdc_expiry_date else None
    days_audit = (trust.audit_due_date - today).days if (trust and trust.audit_due_date) else None

    # Evaluate live status
    live_status, live_reason = evaluate_collector_compliance(db, profile.id)

    trust_dict = None
    if trust:
        trust_dict = {
            "id": str(trust.id),
            "bank_name": trust.bank_name,
            "branch_code": trust.branch_code,
            "account_number": trust.account_number,
            "account_holder_name": trust.account_holder_name,
            "bank_confirmation_letter_url": trust.bank_confirmation_letter_url,
            "auditor_letter_url": trust.auditor_letter_url,
            "last_audit_report_url": trust.last_audit_report_url,
            "audit_due_date": trust.audit_due_date.isoformat(),
            "verification_status": trust.verification_status,
            "days_to_audit_due": days_audit,
        }

    asg_list = []
    for a in assignments:
        tenant = db.get(Tenant, a.tenant_id)
        asg_list.append({
            "id": str(a.id),
            "tenant_id": str(a.tenant_id),
            "tenant_name": tenant.name if tenant else "Unknown Municipality",
            "tenant_code": tenant.code if tenant else "N/A",
            "status": a.status,
            "assigned_by": a.assigned_by,
            "assigned_date": a.assigned_date.isoformat() if a.assigned_date else None,
            "approved_at": a.approved_at.isoformat() if a.approved_at else None,
            "approved_by": a.approved_by,
            "notes": a.notes,
        })

    return {
        "id": str(profile.id),
        "user_id": str(profile.user_id),
        "user_name": user.full_name if user else "Collector",
        "user_email": user.email if user else "",
        "user_role": user.role if user else "COLLECTOR",
        "cfdc_registration_number": profile.cfdc_registration_number,
        "cfdc_expiry_date": profile.cfdc_expiry_date.isoformat() if profile.cfdc_expiry_date else None,
        "cfdc_certificate_url": profile.cfdc_certificate_url,
        "kyc_documents": profile.kyc_documents or {},
        "compliance_status": profile.compliance_status,
        "live_evaluated_status": live_status,
        "live_evaluated_reason": live_reason,
        "suspension_reason": profile.suspension_reason,
        "last_verified_at": profile.last_verified_at.isoformat() if profile.last_verified_at else None,
        "verified_by": profile.verified_by,
        "created_at": profile.created_at.isoformat() if profile.created_at else None,
        "trust_account": trust_dict,
        "assignments": asg_list,
        "days_to_cfdc_expiry": days_cfdc,
        "days_to_audit_due": days_audit,
    }


# -------------------------------------------------------------
# 1. Collector Profile Endpoints
# -------------------------------------------------------------

@router.get("/collectors")
def list_collectors(
    tenant_id: str | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
):
    """
    List all collector compliance profiles with live traffic-light status badges.
    If tenant_id is provided, filters for collectors assigned or requesting assignment to that municipality.
    """
    # Ensure all collector users have a profile initialized
    collector_users = db.scalars(select(User).where(User.role == "COLLECTOR")).all()
    for u in collector_users:
        get_or_create_collector_profile(db, u.id)

    query = select(CollectorProfile)
    if status and status.upper() != "ALL":
        query = query.where(CollectorProfile.compliance_status == status.upper())

    profiles = db.scalars(query).all()
    results = [_format_collector_profile(p, db) for p in profiles]

    if tenant_id and tenant_id.upper() != "GLOBAL":
        try:
            t_uuid = UUID(tenant_id)
            results = [
                r for r in results
                if any(str(a["tenant_id"]) == str(t_uuid) for a in r["assignments"])
            ]
        except ValueError:
            pass

    return results


@router.get("/collectors/me")
def get_current_collector_profile(
    user_id: UUID,
    db: Session = Depends(get_db),
):
    """
    Get profile for currently authenticated collector.
    """
    profile = get_or_create_collector_profile(db, user_id)
    return _format_collector_profile(profile, db)


@router.put("/collectors/{profile_id}")
def update_collector_profile(
    profile_id: UUID,
    payload: CollectorProfileUpdate,
    actor: str = "Collector",
    db: Session = Depends(get_db),
):
    """
    Update CFDC registration and KYC document links.
    """
    profile = db.get(CollectorProfile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Collector profile not found.")

    if payload.cfdc_registration_number:
        profile.cfdc_registration_number = payload.cfdc_registration_number
    if payload.cfdc_expiry_date:
        profile.cfdc_expiry_date = payload.cfdc_expiry_date
    if payload.cfdc_certificate_url is not None:
        profile.cfdc_certificate_url = payload.cfdc_certificate_url
    if payload.kyc_documents is not None:
        merged = profile.kyc_documents or {}
        merged.update(payload.kyc_documents)
        profile.kyc_documents = merged
    if payload.compliance_status:
        profile.compliance_status = payload.compliance_status
        if payload.compliance_status == "VERIFIED":
            profile.last_verified_at = datetime.now(timezone.utc)
            profile.verified_by = actor
            profile.suspension_reason = None
        elif payload.compliance_status == "SUSPENDED":
            profile.suspension_reason = payload.suspension_reason or "Manually suspended by Administrator."

    profile.updated_at = datetime.now(timezone.utc)

    # Log audit event
    audit = AuditEvent(
        id=uuid.uuid4(),
        tenant_id=uuid.UUID("00000000-0000-0000-0000-000000000000"),
        actor=actor,
        event_type="COLLECTOR_PROFILE_UPDATED",
        entity_type="CollectorProfile",
        entity_id=profile.id,
        payload={
            "cfdc_number": profile.cfdc_registration_number,
            "status": profile.compliance_status,
            "updated_by": actor,
        },
        created_at=datetime.now(timezone.utc),
    )
    db.add(audit)

    db.commit()
    db.refresh(profile)
    return _format_collector_profile(profile, db)


# -------------------------------------------------------------
# 2. Collector Trust Account Endpoints
# -------------------------------------------------------------

@router.post("/collectors/{profile_id}/trust-account")
def create_or_update_trust_account(
    profile_id: UUID,
    payload: CollectorTrustAccountCreate,
    actor: str = "Collector",
    db: Session = Depends(get_db),
):
    """
    Save collector statutory trust account banking and auditor details.
    """
    profile = db.get(CollectorProfile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Collector profile not found.")

    trust = db.scalar(
        select(CollectorTrustAccount).where(CollectorTrustAccount.collector_profile_id == profile_id)
    )

    if not trust:
        trust = CollectorTrustAccount(
            id=uuid.uuid4(),
            collector_profile_id=profile_id,
            bank_name=payload.bank_name,
            branch_code=payload.branch_code,
            account_number=payload.account_number,
            account_holder_name=payload.account_holder_name,
            bank_confirmation_letter_url=payload.bank_confirmation_letter_url,
            auditor_letter_url=payload.auditor_letter_url,
            last_audit_report_url=payload.last_audit_report_url,
            audit_due_date=payload.audit_due_date,
            verification_status="PENDING",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(trust)
    else:
        trust.bank_name = payload.bank_name
        trust.branch_code = payload.branch_code
        trust.account_number = payload.account_number
        trust.account_holder_name = payload.account_holder_name
        if payload.bank_confirmation_letter_url:
            trust.bank_confirmation_letter_url = payload.bank_confirmation_letter_url
        if payload.auditor_letter_url:
            trust.auditor_letter_url = payload.auditor_letter_url
        if payload.last_audit_report_url:
            trust.last_audit_report_url = payload.last_audit_report_url
        trust.audit_due_date = payload.audit_due_date
        trust.updated_at = datetime.now(timezone.utc)

    # Log audit event
    audit = AuditEvent(
        id=uuid.uuid4(),
        tenant_id=uuid.UUID("00000000-0000-0000-0000-000000000000"),
        actor=actor,
        event_type="TRUST_ACCOUNT_CAPTURED",
        entity_type="CollectorTrustAccount",
        entity_id=trust.id,
        payload={
            "collector_profile_id": str(profile_id),
            "bank_name": payload.bank_name,
            "account_number": payload.account_number,
            "audit_due_date": payload.audit_due_date.isoformat(),
        },
        created_at=datetime.now(timezone.utc),
    )
    db.add(audit)

    db.commit()
    db.refresh(profile)
    return _format_collector_profile(profile, db)


@router.patch("/collectors/{profile_id}/trust-account/status")
def verify_trust_account(
    profile_id: UUID,
    verification_status: str = Query(..., description="VERIFIED, PENDING, REJECTED, REVOKED"),
    actor: str = "Admin",
    db: Session = Depends(get_db),
):
    """
    Admin verification of collector trust account & audit report.
    """
    trust = db.scalar(
        select(CollectorTrustAccount).where(CollectorTrustAccount.collector_profile_id == profile_id)
    )
    if not trust:
        raise HTTPException(status_code=404, detail="Trust account not found for this collector.")

    trust.verification_status = verification_status.upper()
    trust.updated_at = datetime.now(timezone.utc)

    profile = db.get(CollectorProfile, profile_id)
    if profile and verification_status.upper() == "VERIFIED":
        # Check if collector meets full requirements now
        status, reason = evaluate_collector_compliance(db, profile_id)
        profile.compliance_status = status
        if status == "VERIFIED":
            profile.last_verified_at = datetime.now(timezone.utc)
            profile.verified_by = actor
            profile.suspension_reason = None

    db.commit()
    return _format_collector_profile(profile, db)


# -------------------------------------------------------------
# 3. Municipal Assignment Endpoints (Many-to-Many)
# -------------------------------------------------------------

@router.post("/collectors/{profile_id}/assignments/request")
def request_municipal_assignment(
    profile_id: UUID,
    payload: CollectorAssignmentRequest,
    actor: str = "Collector",
    db: Session = Depends(get_db),
):
    """
    Collector requests assignment to a municipality.
    Enforces business rule: Collector CANNOT self-assign; assignment status starts as PENDING_APPROVAL.
    Enforces business rule: Collector cannot be assigned until CFDC, Trust Account, and KYC are complete and VERIFIED.
    """
    profile = db.get(CollectorProfile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Collector profile not found.")

    tenant = db.get(Tenant, payload.tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Municipality not found.")

    # Check compliance prerequisite
    status, reason = evaluate_collector_compliance(db, profile_id)
    if status != "VERIFIED":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot request municipal assignment: Collector compliance status is '{status}'. Prerequisites not met: {reason}",
        )

    # Check for existing assignment
    existing = db.scalar(
        select(CollectorMunicipalAssignment).where(
            CollectorMunicipalAssignment.collector_profile_id == profile_id,
            CollectorMunicipalAssignment.tenant_id == payload.tenant_id,
        )
    )
    if existing:
        if existing.status == "ACTIVE":
            return {"message": "Collector is already actively assigned to this municipality.", "assignment": str(existing.id)}
        existing.status = "PENDING_APPROVAL"
        existing.notes = payload.notes
        db.commit()
        return {"message": "Assignment re-requested for Municipal Admin approval.", "assignment": str(existing.id)}

    asg = CollectorMunicipalAssignment(
        id=uuid.uuid4(),
        collector_profile_id=profile_id,
        tenant_id=payload.tenant_id,
        assigned_by=actor,
        assigned_date=datetime.now(timezone.utc),
        status="PENDING_APPROVAL",
        notes=payload.notes,
        created_at=datetime.now(timezone.utc),
    )
    db.add(asg)

    # Audit log
    audit = AuditEvent(
        id=uuid.uuid4(),
        tenant_id=payload.tenant_id,
        actor=actor,
        event_type="COLLECTOR_ASSIGNMENT_REQUESTED",
        entity_type="CollectorMunicipalAssignment",
        entity_id=asg.id,
        payload={
            "collector_profile_id": str(profile_id),
            "tenant_id": str(payload.tenant_id),
            "status": "PENDING_APPROVAL",
        },
        created_at=datetime.now(timezone.utc),
    )
    db.add(audit)

    db.commit()
    db.refresh(asg)
    return {"message": "Assignment requested successfully. Awaiting Municipality Admin approval.", "assignment_id": str(asg.id)}


@router.patch("/assignments/{assignment_id}/action")
def action_municipal_assignment(
    assignment_id: UUID,
    payload: CollectorAssignmentAction,
    actor: str = "Municipality Admin",
    db: Session = Depends(get_db),
):
    """
    Municipality Admin approves, suspends, or removes a collector assignment.
    """
    asg = db.get(CollectorMunicipalAssignment, assignment_id)
    if not asg:
        raise HTTPException(status_code=404, detail="Assignment record not found.")

    new_status = payload.status.upper()
    if new_status not in ["ACTIVE", "SUSPENDED", "REMOVED"]:
        raise HTTPException(status_code=400, detail="Invalid assignment action status.")

    if new_status == "ACTIVE":
        # Double check compliance before activating
        comp_status, reason = evaluate_collector_compliance(db, asg.collector_profile_id)
        if comp_status != "VERIFIED":
            raise HTTPException(
                status_code=400,
                detail=f"Cannot approve collector assignment: Compliance check failed ({comp_status}). Reason: {reason}",
            )
        asg.approved_at = datetime.now(timezone.utc)
        asg.approved_by = actor

    asg.status = new_status
    if payload.notes:
        asg.notes = payload.notes

    # Audit log
    audit = AuditEvent(
        id=uuid.uuid4(),
        tenant_id=asg.tenant_id,
        actor=actor,
        event_type=f"COLLECTOR_ASSIGNMENT_{new_status}",
        entity_type="CollectorMunicipalAssignment",
        entity_id=asg.id,
        payload={
            "collector_profile_id": str(asg.collector_profile_id),
            "status": new_status,
            "action_by": actor,
            "notes": payload.notes,
        },
        created_at=datetime.now(timezone.utc),
    )
    db.add(audit)

    db.commit()
    return {"message": f"Assignment updated to {new_status} successfully.", "assignment_id": str(asg.id)}


# -------------------------------------------------------------
# 4. Remittance & Trust Account Ledger Endpoints
# -------------------------------------------------------------

@router.post("/remittances")
def record_trust_remittance(
    payload: RemittanceRecordCreate,
    collector_profile_id: UUID,
    actor: str = "Collector",
    db: Session = Depends(get_db),
):
    """
    Record payment received into collector trust account and calculate statutory commission and net municipal remittance.
    """
    profile = db.get(CollectorProfile, collector_profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Collector profile not found.")

    # Check collector verification status for statutory commission calculation
    is_verified = (profile.compliance_status == "VERIFIED")
    commission_amt, net_remit = calculate_statutory_remittance(
        amount_received=payload.amount_received,
        agreed_commission_rate=payload.commission_rate,
        is_collector_verified=is_verified,
    )

    remittance = CollectorRemittance(
        id=uuid.uuid4(),
        collector_profile_id=collector_profile_id,
        tenant_id=payload.tenant_id,
        payment_id=payload.payment_id,
        debtor_reference=payload.debtor_reference,
        amount_received=payload.amount_received,
        receipt_date=payload.receipt_date,
        commission_rate=payload.commission_rate if is_verified else Decimal("0.00"),
        commission_amount=commission_amt,
        remittance_amount=net_remit,
        remittance_status="PENDING",
        bank_statement_ref=payload.bank_statement_ref,
        notes=payload.notes,
        created_at=datetime.now(timezone.utc),
    )
    db.add(remittance)

    # Audit log
    audit = AuditEvent(
        id=uuid.uuid4(),
        tenant_id=payload.tenant_id,
        actor=actor,
        event_type="TRUST_REMITTANCE_RECORDED",
        entity_type="CollectorRemittance",
        entity_id=remittance.id,
        payload={
            "debtor_reference": payload.debtor_reference,
            "amount_received": float(payload.amount_received),
            "commission_amount": float(commission_amt),
            "remittance_amount": float(net_remit),
            "is_collector_verified": is_verified,
        },
        created_at=datetime.now(timezone.utc),
    )
    db.add(audit)

    db.commit()
    db.refresh(remittance)
    return {
        "id": str(remittance.id),
        "debtor_reference": remittance.debtor_reference,
        "amount_received": float(remittance.amount_received),
        "commission_amount": float(remittance.commission_amount),
        "remittance_amount": float(remittance.remittance_amount),
        "remittance_status": remittance.remittance_status,
        "receipt_date": remittance.receipt_date.isoformat(),
    }


@router.get("/remittances")
def list_remittances(
    collector_profile_id: str | None = None,
    tenant_id: str | None = None,
    remittance_status: str | None = None,
    db: Session = Depends(get_db),
):
    """
    List trust account remittance entries.
    """
    query = select(CollectorRemittance).order_by(CollectorRemittance.receipt_date.desc())

    if collector_profile_id and collector_profile_id.upper() != "ALL":
        try:
            query = query.where(CollectorRemittance.collector_profile_id == UUID(collector_profile_id))
        except ValueError:
            pass

    if tenant_id and tenant_id.upper() != "GLOBAL":
        try:
            query = query.where(CollectorRemittance.tenant_id == UUID(tenant_id))
        except ValueError:
            pass

    if remittance_status and remittance_status.upper() != "ALL":
        query = query.where(CollectorRemittance.remittance_status == remittance_status.upper())

    remittances = db.scalars(query).all()
    results = []
    for r in remittances:
        profile = db.get(CollectorProfile, r.collector_profile_id)
        user = db.get(User, profile.user_id) if profile else None
        tenant = db.get(Tenant, r.tenant_id)
        results.append({
            "id": str(r.id),
            "collector_profile_id": str(r.collector_profile_id),
            "collector_name": user.full_name if user else "Collector",
            "cfdc_number": profile.cfdc_registration_number if profile else "N/A",
            "tenant_id": str(r.tenant_id),
            "tenant_name": tenant.name if tenant else "Municipality",
            "debtor_reference": r.debtor_reference,
            "amount_received": float(r.amount_received),
            "commission_rate": float(r.commission_rate),
            "commission_amount": float(r.commission_amount),
            "remittance_amount": float(r.remittance_amount),
            "receipt_date": r.receipt_date.isoformat(),
            "remittance_date": r.remittance_date.isoformat() if r.remittance_date else None,
            "remittance_status": r.remittance_status,
            "bank_statement_ref": r.bank_statement_ref,
            "notes": r.notes,
            "created_at": r.created_at.isoformat(),
        })
    return results


@router.patch("/remittances/{remittance_id}/status")
def update_remittance_status(
    remittance_id: UUID,
    payload: RemittanceStatusUpdate,
    actor: str = "Finance / Admin",
    db: Session = Depends(get_db),
):
    """
    Mark remittance as remitted to municipality bank account or reconciled with bank statement.
    """
    remittance = db.get(CollectorRemittance, remittance_id)
    if not remittance:
        raise HTTPException(status_code=404, detail="Remittance record not found.")

    remittance.remittance_status = payload.remittance_status.upper()
    if payload.remittance_date:
        remittance.remittance_date = payload.remittance_date
    else:
        remittance.remittance_date = date.today()

    if payload.bank_statement_ref:
        remittance.bank_statement_ref = payload.bank_statement_ref
    if payload.notes:
        remittance.notes = payload.notes

    # Audit log
    audit = AuditEvent(
        id=uuid.uuid4(),
        tenant_id=remittance.tenant_id,
        actor=actor,
        event_type=f"REMITTANCE_{payload.remittance_status.upper()}",
        entity_type="CollectorRemittance",
        entity_id=remittance.id,
        payload={
            "remittance_id": str(remittance.id),
            "status": payload.remittance_status.upper(),
            "remittance_amount": float(remittance.remittance_amount),
            "bank_statement_ref": remittance.bank_statement_ref,
        },
        created_at=datetime.now(timezone.utc),
    )
    db.add(audit)

    db.commit()
    db.refresh(remittance)
    return {"message": f"Remittance updated to {remittance.remittance_status}.", "id": str(remittance.id)}


@router.get("/remittances/statement")
def get_monthly_remittance_statement(
    collector_profile_id: UUID,
    tenant_id: UUID,
    year: int = Query(default=datetime.now().year),
    month: int = Query(default=datetime.now().month),
    db: Session = Depends(get_db),
):
    """
    Generate official monthly trust account remittance statement per collector per municipality.
    """
    profile = db.get(CollectorProfile, collector_profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Collector profile not found.")
    user = db.get(User, profile.user_id)

    tenant = db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Municipality not found.")

    from calendar import monthrange
    num_days = monthrange(year, month)[1]
    start_d = date(year, month, 1)
    end_d = date(year, month, num_days)

    records = db.scalars(
        select(CollectorRemittance).where(
            CollectorRemittance.collector_profile_id == collector_profile_id,
            CollectorRemittance.tenant_id == tenant_id,
            CollectorRemittance.receipt_date >= start_d,
            CollectorRemittance.receipt_date <= end_d,
        ).order_by(CollectorRemittance.receipt_date.asc())
    ).all()

    total_cash = sum((r.amount_received for r in records), Decimal("0.00"))
    total_comm = sum((r.commission_amount for r in records), Decimal("0.00"))
    total_remitted = sum((r.remittance_amount for r in records if r.remittance_status in ["REMITTED", "RECONCILED"]), Decimal("0.00"))
    total_pending = sum((r.remittance_amount for r in records if r.remittance_status == "PENDING"), Decimal("0.00"))

    period_str = datetime(year, month, 1).strftime("%B %Y")

    items = [
        {
            "id": str(r.id),
            "debtor_reference": r.debtor_reference,
            "receipt_date": r.receipt_date.isoformat(),
            "amount_received": float(r.amount_received),
            "commission_rate": float(r.commission_rate),
            "commission_amount": float(r.commission_amount),
            "remittance_amount": float(r.remittance_amount),
            "remittance_status": r.remittance_status,
            "remittance_date": r.remittance_date.isoformat() if r.remittance_date else None,
            "bank_statement_ref": r.bank_statement_ref,
        }
        for r in records
    ]

    return {
        "collector_id": str(profile.id),
        "collector_name": user.full_name if user else "Registered Collector",
        "cfdc_number": profile.cfdc_registration_number,
        "tenant_id": str(tenant.id),
        "tenant_name": tenant.name,
        "tenant_bank_details": {
            "bank_name": tenant.bank_name or "First National Bank (FNB)",
            "branch_code": tenant.branch_code or "250655",
            "account_number": tenant.account_number or "62899432101",
            "account_holder_name": tenant.account_holder_name or f"{tenant.name} Primary Revenue Account",
            "payment_reference_format": tenant.payment_reference_format or "MUNI-{ACCOUNT_NO}",
        },
        "statement_period": period_str,
        "total_cash_collected": float(total_cash),
        "total_commission_earned": float(total_comm),
        "total_remitted_to_municipality": float(total_remitted),
        "total_pending_remittance": float(total_pending),
        "items": items,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# -------------------------------------------------------------
# 5. Scheduled Compliance Audit Job Trigger
# -------------------------------------------------------------

@router.post("/cron/run-audit")
def trigger_compliance_audit(
    actor: str = "Admin Manual Trigger",
    db: Session = Depends(get_db),
):
    """
    Execute daily compliance audit: checks CFDC expiry, trust account status, and audit due dates.
    Suspends non-compliant collectors and flags debtor accounts for reassignment.
    """
    summary = run_compliance_audit_job(db, actor=actor)
    return summary
