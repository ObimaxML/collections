from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Tenant
from app.schemas.tenants import TenantCreate, TenantResponse, TenantUpdate


router = APIRouter(
    prefix="/tenants",
    tags=["Municipal Tenants"],
)


@router.get(
    "",
    response_model=list[TenantResponse],
)
def list_tenants(
    db: Session = Depends(get_db),
):
    """
    List all onboarded municipalities / tenants with their SaaS and Engagement subscriptions.
    """
    statement = select(Tenant).order_by(Tenant.name.asc())
    return list(db.scalars(statement))


@router.post(
    "",
    response_model=TenantResponse,
    status_code=201,
)
def create_tenant(
    payload: TenantCreate,
    db: Session = Depends(get_db),
):
    """
    Onboard a new municipality into CollectionsOS with engagement model (Internal SaaS or Molmos Managed Service).
    """
    code_upper = payload.code.strip().upper()

    existing = db.scalar(
        select(Tenant).where(Tenant.code == code_upper)
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Municipality with code '{code_upper}' already exists.",
        )

    tenant = Tenant(
        id=uuid4(),
        name=payload.name.strip(),
        code=code_upper,
        engagement_model=payload.engagement_model,
        subscription_tier=payload.subscription_tier,
        commission_rate=payload.commission_rate,
        monthly_subscription_fee=payload.monthly_subscription_fee,
        subscription_status=payload.subscription_status,
        billing_contact_email=payload.billing_contact_email,
        physical_address=payload.physical_address,
        postal_address=payload.postal_address,
        contact_person=payload.contact_person,
        contact_position=payload.contact_position,
        contact_phone=payload.contact_phone,
        contract_start_date=payload.contract_start_date,
        contract_end_date=payload.contract_end_date,
        created_at=datetime.now(timezone.utc),
    )

    db.add(tenant)
    db.commit()
    db.refresh(tenant)

    return tenant


@router.get(
    "/{tenant_id}",
    response_model=TenantResponse,
)
def get_tenant(
    tenant_id: UUID,
    db: Session = Depends(get_db),
):
    """
    Get municipality details by ID.
    """
    tenant = db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(
            status_code=404,
            detail="Municipality not found.",
        )
    return tenant


@router.put(
    "/{tenant_id}",
    response_model=TenantResponse,
)
def update_tenant(
    tenant_id: UUID,
    payload: TenantUpdate,
    db: Session = Depends(get_db),
):
    """
    Update municipality SaaS subscription, engagement model, billing terms, address, contact details, or contract status.
    """
    tenant = db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(
            status_code=404,
            detail="Municipality not found.",
        )

    if payload.name is not None:
        tenant.name = payload.name.strip()
    if payload.code is not None:
        code_upper = payload.code.strip().upper()
        if code_upper != tenant.code:
            existing = db.scalar(select(Tenant).where(Tenant.code == code_upper, Tenant.id != tenant_id))
            if existing:
                raise HTTPException(status_code=409, detail=f"Code '{code_upper}' already in use.")
            tenant.code = code_upper
    if payload.engagement_model is not None:
        tenant.engagement_model = payload.engagement_model
    if payload.subscription_tier is not None:
        tenant.subscription_tier = payload.subscription_tier
    if payload.commission_rate is not None:
        tenant.commission_rate = payload.commission_rate
    if payload.monthly_subscription_fee is not None:
        tenant.monthly_subscription_fee = payload.monthly_subscription_fee
    if payload.subscription_status is not None:
        tenant.subscription_status = payload.subscription_status
    if payload.billing_contact_email is not None:
        tenant.billing_contact_email = payload.billing_contact_email
    if payload.physical_address is not None:
        tenant.physical_address = payload.physical_address
    if payload.postal_address is not None:
        tenant.postal_address = payload.postal_address
    if payload.contact_person is not None:
        tenant.contact_person = payload.contact_person
    if payload.contact_position is not None:
        tenant.contact_position = payload.contact_position
    if payload.contact_phone is not None:
        tenant.contact_phone = payload.contact_phone
    if payload.contract_start_date is not None:
        tenant.contract_start_date = payload.contract_start_date
    if payload.contract_end_date is not None:
        tenant.contract_end_date = payload.contract_end_date

    db.commit()
    db.refresh(tenant)
    return tenant


@router.patch(
    "/{tenant_id}/status",
    response_model=TenantResponse,
)
def update_tenant_status(
    tenant_id: UUID,
    status: str,
    db: Session = Depends(get_db),
):
    """
    SuperAdmin quick action to update SaaS subscription status (e.g. TRIAL, ACTIVE, SUSPENDED, EXPIRED).
    """
    tenant = db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(
            status_code=404,
            detail="Municipality not found.",
        )
    valid_statuses = ["ACTIVE", "TRIAL", "SUSPENDED", "EXPIRED"]
    status_upper = status.strip().upper()
    if status_upper not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status '{status}'. Must be one of {valid_statuses}",
        )
    tenant.subscription_status = status_upper
    db.commit()
    db.refresh(tenant)
    return tenant


@router.delete(
    "/{tenant_id}",
    status_code=200,
)
def delete_tenant(
    tenant_id: UUID,
    db: Session = Depends(get_db),
):
    """
    SuperAdmin deletion of a municipality and its associated operational records.
    """
    from app.models import (
        MunicipalAccount, Customer, Property,
        CollectionCase, CollectionActivity, CaseActivity, ContactAttempt,
        Promise, PaymentPlan, Payment, PaymentAllocation,
        Proposal, Invoice, ImportBatch, ImportRow, AuditEvent
    )

    tenant = db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(
            status_code=404,
            detail="Municipality not found.",
        )

    tenant_name = tenant.name
    tenant_code = tenant.code

    # 1. Clear payment allocations for payments belonging to tenant
    pmts = db.query(Payment).filter(Payment.tenant_id == tenant_id).all()
    pmt_ids = [p.id for p in pmts]
    if pmt_ids:
        db.query(PaymentAllocation).filter(PaymentAllocation.payment_id.in_(pmt_ids)).delete(synchronize_session=False)

    # 2. Clear case-linked dependencies
    cases = db.query(CollectionCase).filter(CollectionCase.tenant_id == tenant_id).all()
    case_ids = [c.id for c in cases]
    if case_ids:
        db.query(CollectionActivity).filter(CollectionActivity.case_id.in_(case_ids)).delete(synchronize_session=False)
        db.query(CaseActivity).filter(CaseActivity.case_id.in_(case_ids)).delete(synchronize_session=False)
        db.query(ContactAttempt).filter(ContactAttempt.case_id.in_(case_ids)).delete(synchronize_session=False)
        
        proms = db.query(Promise).filter(Promise.case_id.in_(case_ids)).all()
        prom_ids = [pr.id for pr in proms]
        if prom_ids:
            db.query(PaymentAllocation).filter(PaymentAllocation.promise_id.in_(prom_ids)).delete(synchronize_session=False)
        
        db.query(Promise).filter(Promise.case_id.in_(case_ids)).delete(synchronize_session=False)
        db.query(PaymentPlan).filter(PaymentPlan.case_id.in_(case_ids)).delete(synchronize_session=False)

    # 3. Clear import rows and batches
    batches = db.query(ImportBatch).filter(ImportBatch.tenant_id == tenant_id).all()
    batch_ids = [b.id for b in batches]
    if batch_ids:
        db.query(ImportRow).filter(ImportRow.batch_id.in_(batch_ids)).delete(synchronize_session=False)
    db.query(ImportBatch).filter(ImportBatch.tenant_id == tenant_id).delete(synchronize_session=False)

    # 4. Clear payments, cases, accounts, customers, properties, proposals, invoices, audit events
    db.query(Payment).filter(Payment.tenant_id == tenant_id).delete(synchronize_session=False)
    db.query(CollectionCase).filter(CollectionCase.tenant_id == tenant_id).delete(synchronize_session=False)
    db.query(MunicipalAccount).filter(MunicipalAccount.tenant_id == tenant_id).delete(synchronize_session=False)
    db.query(Customer).filter(Customer.tenant_id == tenant_id).delete(synchronize_session=False)
    db.query(Property).filter(Property.tenant_id == tenant_id).delete(synchronize_session=False)
    db.query(Proposal).filter(Proposal.tenant_id == tenant_id).delete(synchronize_session=False)
    db.query(Invoice).filter(Invoice.tenant_id == tenant_id).delete(synchronize_session=False)
    db.query(AuditEvent).filter(AuditEvent.tenant_id == tenant_id).delete(synchronize_session=False)

    # 5. Delete tenant itself
    db.delete(tenant)
    db.commit()

    return {
        "success": True,
        "message": f"Municipality '{tenant_name}' ({tenant_code}) and all related records deleted successfully.",
        "deleted_tenant_id": str(tenant_id),
    }
