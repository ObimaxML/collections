from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Customer, PopiaRequest, AuditEvent
from app.schemas.popia import (
    PopiaRequestCreate,
    PopiaRequestUpdate,
    PopiaRequestResponse,
    PopiaCustomerConsentUpdate,
)

router = APIRouter(
    prefix="/popia",
    tags=["POPIA Compliance Framework"],
)


@router.get(
    "/requests",
    response_model=list[PopiaRequestResponse],
)
def list_popia_requests(
    tenant_id: UUID,
    status: str | None = None,
    db: Session = Depends(get_db),
):
    """
    List all POPIA data subject privacy requests for a municipality.
    """
    statement = select(PopiaRequest).where(PopiaRequest.tenant_id == tenant_id)
    if status:
        statement = statement.where(PopiaRequest.status == status.upper())
    statement = statement.order_by(PopiaRequest.created_at.desc())
    return list(db.scalars(statement))


@router.post(
    "/requests",
    response_model=PopiaRequestResponse,
    status_code=201,
)
def create_popia_request(
    tenant_id: UUID,
    payload: PopiaRequestCreate,
    db: Session = Depends(get_db),
):
    """
    Log a formal POPIA Data Subject Request (e.g. Section 23/24 Access, Rectification, or Objection).
    """
    customer = db.get(Customer, payload.customer_id)
    if not customer or customer.tenant_id != tenant_id:
        raise HTTPException(
            status_code=404,
            detail="Customer not found in this municipality.",
        )

    req = PopiaRequest(
        id=uuid4(),
        tenant_id=tenant_id,
        customer_id=payload.customer_id,
        request_type=payload.request_type.upper(),
        status="PENDING",
        requester_name=payload.requester_name.strip(),
        requester_email=payload.requester_email.strip() if payload.requester_email else None,
        justification_notes=payload.justification_notes,
        created_at=datetime.now(timezone.utc),
    )
    db.add(req)

    # Log to immutable AuditEvent
    audit = AuditEvent(
        id=uuid4(),
        tenant_id=tenant_id,
        actor=payload.requester_name,
        event_type="POPIA_REQUEST_LOGGED",
        entity_type="Customer",
        entity_id=customer.id,
        payload={
            "request_id": str(req.id),
            "request_type": req.request_type,
            "requester_email": req.requester_email,
        },
        created_at=datetime.now(timezone.utc),
    )
    db.add(audit)

    db.commit()
    db.refresh(req)
    return req


@router.put(
    "/requests/{request_id}",
    response_model=PopiaRequestResponse,
)
def action_popia_request(
    tenant_id: UUID,
    request_id: UUID,
    payload: PopiaRequestUpdate,
    db: Session = Depends(get_db),
):
    """
    Approve, Reject, or Complete a POPIA data subject privacy request.
    """
    req = db.get(PopiaRequest, request_id)
    if not req or req.tenant_id != tenant_id:
        raise HTTPException(
            status_code=404,
            detail="POPIA request not found.",
        )

    req.status = payload.status.upper()
    req.actioned_by = payload.actioned_by
    req.actioned_at = datetime.now(timezone.utc)
    if payload.justification_notes:
        req.justification_notes = payload.justification_notes

    # If objection or consent withdrawal is approved, enforce Do-Not-Contact flag
    if req.status == "APPROVED" and req.request_type in ["CONSENT_WITHDRAWAL", "DELETION_OBJECTION", "RESTRICTION"]:
        customer = db.get(Customer, req.customer_id)
        if customer:
            customer.popia_dnc_status = True
            customer.popia_consent_status = "EXPLICIT_OPT_OUT"

    # Audit logging
    audit = AuditEvent(
        id=uuid4(),
        tenant_id=tenant_id,
        actor=payload.actioned_by,
        event_type=f"POPIA_REQUEST_{req.status}",
        entity_type="PopiaRequest",
        entity_id=req.id,
        payload={
            "customer_id": str(req.customer_id),
            "status": req.status,
            "actioned_by": req.actioned_by,
        },
        created_at=datetime.now(timezone.utc),
    )
    db.add(audit)

    db.commit()
    db.refresh(req)
    return req


@router.put(
    "/customers/{customer_id}/consent",
)
def update_customer_consent(
    tenant_id: UUID,
    customer_id: UUID,
    payload: PopiaCustomerConsentUpdate,
    db: Session = Depends(get_db),
):
    """
    Directly update a customer's POPIA consent status and Do-Not-Contact flag.
    """
    customer = db.get(Customer, customer_id)
    if not customer or customer.tenant_id != tenant_id:
        raise HTTPException(
            status_code=404,
            detail="Customer not found.",
        )

    prev_status = customer.popia_consent_status
    customer.popia_consent_status = payload.popia_consent_status.upper()
    customer.popia_dnc_status = payload.popia_dnc_status
    if payload.popia_consent_status.upper() == "CONSENTED":
        customer.popia_consent_date = datetime.now(timezone.utc)

    # Audit
    audit = AuditEvent(
        id=uuid4(),
        tenant_id=tenant_id,
        actor=payload.actor,
        event_type="POPIA_CONSENT_UPDATED",
        entity_type="Customer",
        entity_id=customer.id,
        payload={
            "prev_status": prev_status,
            "new_status": customer.popia_consent_status,
            "dnc_status": customer.popia_dnc_status,
        },
        created_at=datetime.now(timezone.utc),
    )
    db.add(audit)

    db.commit()
    db.refresh(customer)
    return {
        "status": "success",
        "customer_id": customer.id,
        "popia_consent_status": customer.popia_consent_status,
        "popia_dnc_status": customer.popia_dnc_status,
    }
