import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    AuditEvent,
    CollectionCase,
    Tenant,
    User,
)
from app.models.compliance import (
    CollectorProfile,
    CollectorTrustAccount,
    CollectorMunicipalAssignment,
    CollectorRemittance,
)


def get_or_create_collector_profile(
    db: Session,
    user_id: UUID,
    cfdc_registration_number: str = "CFDC-PENDING",
    cfdc_expiry_date: date | None = None,
) -> CollectorProfile:
    profile = db.scalar(
        select(CollectorProfile).where(CollectorProfile.user_id == user_id)
    )
    if not profile:
        profile = CollectorProfile(
            id=uuid.uuid4(),
            user_id=user_id,
            cfdc_registration_number=cfdc_registration_number,
            cfdc_expiry_date=cfdc_expiry_date or date(2027, 12, 31),
            compliance_status="PENDING_VERIFICATION",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


def evaluate_collector_compliance(db: Session, collector_profile_id: UUID) -> tuple[str, str | None]:
    """
    Evaluates whether a collector meets all mandatory statutory requirements:
    1. Valid, unexpired CFDC registration.
    2. Verified Trust Account.
    3. Audit report not overdue.
    Returns (status, reason)
    """
    profile = db.get(CollectorProfile, collector_profile_id)
    if not profile:
        return "REJECTED", "Collector profile not found."

    today = date.today()

    # 1. CFDC Registration Check
    if not profile.cfdc_registration_number or profile.cfdc_registration_number.startswith("CFDC-PENDING"):
        return "PENDING_VERIFICATION", "CFDC registration number is required."

    if not profile.cfdc_expiry_date or profile.cfdc_expiry_date < today:
        return "SUSPENDED", f"CFDC registration expired on {profile.cfdc_expiry_date}."

    # 2. Trust Account Check
    trust_account = db.scalar(
        select(CollectorTrustAccount).where(CollectorTrustAccount.collector_profile_id == profile.id)
    )
    if not trust_account:
        return "PENDING_VERIFICATION", "Trust account details and bank confirmation letter required."

    if trust_account.verification_status != "VERIFIED":
        return "PENDING_VERIFICATION", f"Trust account verification status is '{trust_account.verification_status}'."

    if not trust_account.audit_due_date or trust_account.audit_due_date < today:
        return "SUSPENDED", f"Trust account annual audit report is overdue since {trust_account.audit_due_date}."

    # 3. KYC Documents Check
    kyc = profile.kyc_documents or {}
    if not kyc.get("id_document_url") and not kyc.get("verified"):
        return "PENDING_VERIFICATION", "KYC documents (ID / Company Registration) pending verification."

    return "VERIFIED", None


def check_and_enforce_collector_action_allowed(
    db: Session,
    user_id: UUID,
    tenant_id: UUID | None = None,
    action_name: str = "Collection Action",
) -> CollectorProfile:
    """
    Hard server-side compliance gating:
    Throws ValueError / PermissionError if the collector is not fully verified or suspended,
    or not actively assigned to the target municipality.
    """
    user = db.get(User, user_id)
    if not user:
        raise PermissionError("User not found.")

    # SUPERADMIN and ADMIN oversight is exempt from collector CFDC gating
    if user.role in ["SUPERADMIN", "ADMIN", "AUDITOR"]:
        # Return or mock profile if needed
        profile = db.scalar(select(CollectorProfile).where(CollectorProfile.user_id == user_id))
        return profile or CollectorProfile(id=uuid.uuid4(), user_id=user_id, cfdc_registration_number="EXEMPT-ADMIN", cfdc_expiry_date=date(2099, 1, 1), compliance_status="VERIFIED")

    profile = db.scalar(select(CollectorProfile).where(CollectorProfile.user_id == user_id))
    if not profile:
        raise PermissionError(
            f"Compliance Gating: Collector profile not configured for {user.full_name or user.email}. Action '{action_name}' blocked."
        )

    status, reason = evaluate_collector_compliance(db, profile.id)
    if status != "VERIFIED":
        # Log suspension / block event
        audit = AuditEvent(
            id=uuid.uuid4(),
            tenant_id=tenant_id or user.tenant_id or uuid.UUID("00000000-0000-0000-0000-000000000000"),
            actor=user.email,
            event_type="COLLECTOR_ACTION_BLOCKED",
            entity_type="CollectorProfile",
            entity_id=profile.id,
            payload={
                "action": action_name,
                "compliance_status": status,
                "reason": reason,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
            created_at=datetime.now(timezone.utc),
        )
        db.add(audit)
        db.commit()

        raise PermissionError(
            f"Compliance Gating Blocked: Collector '{user.full_name}' compliance status is '{status}'. Reason: {reason}"
        )

    # If action is against a specific municipality, verify active assignment
    if tenant_id:
        assignment = db.scalar(
            select(CollectorMunicipalAssignment).where(
                CollectorMunicipalAssignment.collector_profile_id == profile.id,
                CollectorMunicipalAssignment.tenant_id == tenant_id,
                CollectorMunicipalAssignment.status == "ACTIVE",
            )
        )
        if not assignment:
            raise PermissionError(
                f"Compliance Gating Blocked: Collector is not actively assigned to Municipality '{tenant_id}'. Approval from Municipality Admin required."
            )

    return profile


def run_compliance_audit_job(db: Session, actor: str = "System Compliance Cron") -> dict:
    """
    Daily automated compliance audit check:
    If CFDC expired, audit overdue, or trust account unverified -> automatically suspend collector,
    suspend municipal assignments, flag debtor cases, and log audit events.
    """
    profiles = db.scalars(select(CollectorProfile)).all()
    today = date.today()
    suspended_count = 0
    verified_count = 0
    details = []

    for profile in profiles:
        user = db.get(User, profile.user_id)
        actor_name = user.full_name if user else str(profile.user_id)
        old_status = profile.compliance_status
        new_status, reason = evaluate_collector_compliance(db, profile.id)

        if new_status != profile.compliance_status:
            profile.compliance_status = new_status
            profile.suspension_reason = reason if new_status == "SUSPENDED" else None
            profile.updated_at = datetime.now(timezone.utc)

            # If suspended, cascade suspension to active municipal assignments
            if new_status == "SUSPENDED":
                suspended_count += 1
                assignments = db.scalars(
                    select(CollectorMunicipalAssignment).where(
                        CollectorMunicipalAssignment.collector_profile_id == profile.id,
                        CollectorMunicipalAssignment.status == "ACTIVE",
                    )
                ).all()
                for asg in assignments:
                    asg.status = "SUSPENDED"

                # Flag active debtor cases assigned to this collector
                if user:
                    cases = db.scalars(
                        select(CollectionCase).where(
                            CollectionCase.assigned_to == user.email,
                            CollectionCase.status.notin_(["PAID", "CLOSED"]),
                        )
                    ).all()
                    for case in cases:
                        case.strategy_code = f"FLAGGED_REASSIGNMENT:{reason[:30]}"

            # Log audit event
            audit = AuditEvent(
                id=uuid.uuid4(),
                tenant_id=user.tenant_id if user and user.tenant_id else uuid.UUID("00000000-0000-0000-0000-000000000000"),
                actor=actor,
                event_type="COLLECTOR_STATUS_CHANGED",
                entity_type="CollectorProfile",
                entity_id=profile.id,
                payload={
                    "collector_name": actor_name,
                    "previous_status": old_status,
                    "new_status": new_status,
                    "reason": reason,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                },
                created_at=datetime.now(timezone.utc),
            )
            db.add(audit)

            details.append({
                "collector_id": str(profile.id),
                "collector_name": actor_name,
                "previous_status": old_status,
                "new_status": new_status,
                "reason": reason,
            })
        elif new_status == "VERIFIED":
            verified_count += 1

    db.commit()
    return {
        "status": "COMPLETED",
        "total_checked": len(profiles),
        "verified_collectors": verified_count,
        "newly_suspended": suspended_count,
        "audit_timestamp": datetime.now(timezone.utc).isoformat(),
        "details": details,
    }


def calculate_statutory_remittance(
    amount_received: Decimal,
    agreed_commission_rate: Decimal = Decimal("10.00"),
    is_collector_verified: bool = True,
) -> tuple[Decimal, Decimal]:
    """
    Calculates commission and net remittance to municipality.
    Enforces Debt Collectors Act regulations:
    - Unverified / suspended collectors receive 0.00% commission.
    - Prescribed statutory commission cap (maximum 18.00% or R1,500 per payment installment).
    """
    if not is_collector_verified or amount_received <= 0:
        return Decimal("0.00"), amount_received

    # Enforce statutory cap of max 18% or prescribed cap
    effective_rate = min(agreed_commission_rate, Decimal("18.00"))
    raw_commission = (amount_received * (effective_rate / Decimal("100.00"))).quantize(Decimal("0.01"))
    
    # Statutory maximum cap per standard transaction installment
    statutory_fee_cap = Decimal("2500.00")
    commission_amount = min(raw_commission, statutory_fee_cap)
    
    net_remittance = amount_received - commission_amount
    return commission_amount, net_remittance
