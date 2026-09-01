from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Tenant
from app.models.billing import Invoice, Proposal
from app.schemas.billing import (
    InvoiceCreate,
    InvoiceResponse,
    InvoiceUpdate,
    ProposalCreate,
    ProposalResponse,
    ProposalUpdate,
)

router = APIRouter(
    prefix="/billing",
    tags=["Municipal Commercial Billing & Proposals"],
)


def _format_proposal(proposal: Proposal, db: Session) -> dict:
    tenant = db.get(Tenant, proposal.tenant_id)
    return {
        "id": proposal.id,
        "tenant_id": proposal.tenant_id,
        "tenant_name": tenant.name if tenant else None,
        "tenant_code": tenant.code if tenant else None,
        "tenant_physical_address": tenant.physical_address if tenant else None,
        "tenant_postal_address": tenant.postal_address if tenant else None,
        "tenant_contact_person": tenant.contact_person if tenant else None,
        "tenant_contact_position": tenant.contact_position if tenant else None,
        "tenant_contact_phone": tenant.contact_phone if tenant else None,
        "tenant_billing_email": tenant.billing_contact_email if tenant else None,
        "proposal_number": proposal.proposal_number,
        "title": proposal.title,
        "engagement_model": proposal.engagement_model,
        "subscription_tier": proposal.subscription_tier,
        "status": proposal.status,
        "total_amount": proposal.total_amount,
        "vat_amount": proposal.vat_amount,
        "monthly_fee": proposal.monthly_fee,
        "commission_rate": proposal.commission_rate,
        "valid_until": proposal.valid_until,
        "scope_of_work": proposal.scope_of_work,
        "terms_and_conditions": proposal.terms_and_conditions,
        "line_items": proposal.line_items,
        "approved_by": proposal.approved_by,
        "approved_at": proposal.approved_at,
        "created_by": proposal.created_by,
        "created_at": proposal.created_at,
    }


def _format_invoice(invoice: Invoice, db: Session) -> dict:
    tenant = db.get(Tenant, invoice.tenant_id)
    return {
        "id": invoice.id,
        "tenant_id": invoice.tenant_id,
        "tenant_name": tenant.name if tenant else None,
        "tenant_code": tenant.code if tenant else None,
        "tenant_physical_address": tenant.physical_address if tenant else None,
        "tenant_postal_address": tenant.postal_address if tenant else None,
        "tenant_contact_person": tenant.contact_person if tenant else None,
        "tenant_contact_position": tenant.contact_position if tenant else None,
        "tenant_contact_phone": tenant.contact_phone if tenant else None,
        "tenant_billing_email": tenant.billing_contact_email if tenant else None,
        "proposal_id": invoice.proposal_id,
        "invoice_number": invoice.invoice_number,
        "billing_period": invoice.billing_period,
        "status": invoice.status,
        "issue_date": invoice.issue_date,
        "due_date": invoice.due_date,
        "subtotal": invoice.subtotal,
        "vat_rate": invoice.vat_rate,
        "vat_amount": invoice.vat_amount,
        "total_amount": invoice.total_amount,
        "paid_amount": invoice.paid_amount,
        "line_items": invoice.line_items,
        "banking_details": invoice.banking_details,
        "notes": invoice.notes,
        "created_at": invoice.created_at,
    }


# -----------------------------------------------------------------------------
# PROPOSALS API
# -----------------------------------------------------------------------------

@router.get("/proposals", response_model=list[ProposalResponse])
def list_proposals(
    tenant_id: UUID | None = None,
    db: Session = Depends(get_db),
):
    query = select(Proposal).order_by(Proposal.created_at.desc())
    if tenant_id:
        query = query.where(Proposal.tenant_id == tenant_id)
    proposals = db.scalars(query).all()
    return [_format_proposal(p, db) for p in proposals]


@router.post("/proposals", response_model=ProposalResponse, status_code=201)
def create_proposal(
    payload: ProposalCreate,
    db: Session = Depends(get_db),
):
    tenant = db.get(Tenant, payload.tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Municipality not found.")

    # Generate sequential proposal number: PROP-CODE-YYYYMM-XXX
    count = db.scalar(select(func.count()).select_from(Proposal)) or 0
    seq = count + 1
    now_str = datetime.now().strftime("%Y%m")
    proposal_number = f"PROP-{tenant.code}-{now_str}-{seq:03d}"

    # Calculate line items subtotal
    subtotal = Decimal("0.00")
    items_data = []
    for item in payload.line_items:
        qty = Decimal(str(item.quantity))
        price = Decimal(str(item.unit_price))
        total = qty * price
        items_data.append({
            "description": item.description,
            "quantity": float(qty),
            "unit_price": float(price),
            "total": float(total),
        })
        subtotal += total

    # If no line items passed, autogenerate platform subscription usage fees
    if not items_data:
        fee = payload.monthly_fee or (Decimal("45000.00") if payload.subscription_tier == "ENTERPRISE" else Decimal("25000.00"))
        items_data.append({
            "description": f"Khokhisa {payload.subscription_tier or 'Enterprise'} Cloud Software License & Platform Usage (Monthly)",
            "quantity": 1.0,
            "unit_price": float(fee),
            "total": float(fee),
        })
        subtotal += fee

    vat_amount = (subtotal * Decimal("0.15")).quantize(Decimal("0.01"))
    total_amount = subtotal + vat_amount

    proposal = Proposal(
        id=uuid4(),
        tenant_id=payload.tenant_id,
        proposal_number=proposal_number,
        title=payload.title,
        engagement_model=payload.engagement_model,
        subscription_tier=payload.subscription_tier,
        status="DRAFT",
        total_amount=total_amount,
        vat_amount=vat_amount,
        monthly_fee=payload.monthly_fee,
        commission_rate=payload.commission_rate,
        valid_until=payload.valid_until,
        scope_of_work=payload.scope_of_work or (
            f"Provision of Khokhisa Debt Recovery Operating System & Municipal Revenue collections under {payload.engagement_model}."
        ),
        terms_and_conditions=payload.terms_and_conditions or (
            "1. Invoicing on monthly payment cycles.\n2. Subject to Municipal Finance Management Act (MFMA) compliance.\n3. 30-day payment term."
        ),
        line_items=items_data,
        created_by=payload.created_by or "SuperAdmin",
        created_at=datetime.now(timezone.utc),
    )

    db.add(proposal)
    db.commit()
    db.refresh(proposal)
    return _format_proposal(proposal, db)


import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger("khokhisa.billing")


def _send_proposal_email(proposal: Proposal, tenant: Tenant, recipient_email: str) -> bool:
    """
    Sends or dispatches official notification email to municipal representative with proposal summary.
    If SMTP is configured, sends via SMTP; otherwise logs structured notification event.
    """
    from app.core.config import settings
    subject = f"Commercial Proposal {proposal.proposal_number} - {tenant.name} / Khokhisa"
    
    body_text = f"""Dear Municipal Executive / Finance Team ({tenant.name}),

Please find your official commercial proposal from Khokhisa Municipal Revenue Recovery OS:

Proposal Number: {proposal.proposal_number}
Title: {proposal.title}
Operating Model: {proposal.engagement_model}
Subscription Tier: {proposal.subscription_tier}
Total Value: R {proposal.total_amount:,.2f}
Status: SUBMITTED TO MUNICIPALITY FOR REVIEW

You can review and approve this proposal directly within your Khokhisa Municipal Portal.

Kind Regards,
Khokhisa Revenue Management Team
Khokhisa (Pty) Ltd
"""
    logger.info(f"📧 [PROPOSAL DISPATCH] To: {recipient_email} | Subject: {subject} | Proposal: {proposal.proposal_number}")
    
    if settings.smtp_host and settings.smtp_user and settings.smtp_password:
        try:
            msg = MIMEMultipart()
            msg["From"] = settings.smtp_from
            msg["To"] = recipient_email
            msg["Subject"] = subject
            msg.attach(MIMEText(body_text, "plain"))
            
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
                if settings.smtp_tls:
                    server.starttls()
                server.login(settings.smtp_user, settings.smtp_password)
                server.send_message(msg)
            logger.info(f"✅ SMTP Email delivered successfully to {recipient_email}")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to dispatch email via SMTP: {e}")
            return False
    return True


@router.patch("/proposals/{proposal_id}/status", response_model=ProposalResponse)
def update_proposal_status(
    proposal_id: UUID,
    status: str = Query(..., description="DRAFT, SUBMITTED_TO_MUNICIPALITY, APPROVED, REJECTED"),
    actor: str | None = Query(default="Municipal Executive"),
    target_email: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    proposal = db.get(Proposal, proposal_id)
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found.")

    valid_statuses = {"DRAFT", "SUBMITTED_TO_MUNICIPALITY", "APPROVED", "REJECTED", "EXPIRED"}
    status_upper = status.strip().upper()
    proposal.status = status_upper
    tenant = db.get(Tenant, proposal.tenant_id)

    if status_upper == "APPROVED":
        proposal.approved_by = actor
        proposal.approved_at = datetime.now(timezone.utc)

        # Check if an invoice was already generated for this proposal
        existing_inv = db.scalar(select(Invoice).where(Invoice.proposal_id == proposal.id))
        if not existing_inv and tenant:
            count = db.scalar(select(func.count()).select_from(Invoice)) or 0
            seq = count + 1
            now_str = datetime.now().strftime("%Y%m")
            invoice_number = f"INV-{tenant.code}-{now_str}-{seq:03d}"

            now_date = datetime.now().date()
            due_date = now_date + timedelta(days=30)
            billing_period = now_date.strftime("%B %Y")

            default_banking = {
                "bank_name": "Capitec Business",
                "account_name": "Moloi Mosea Investments (Pty) Ltd",
                "account_number": "62899432101",
                "branch_code": "470010",
                "account_type": "Business Cheque Account",
                "swift_code": "CBLAZAJJ",
                "payment_reference": invoice_number,
            }

            prop_subtotal = (proposal.total_amount - (proposal.vat_amount or Decimal("0.00")))
            vat_rate = Decimal("15.00") if (proposal.vat_amount and proposal.vat_amount > 0) else Decimal("0.00")

            auto_invoice = Invoice(
                id=uuid4(),
                tenant_id=proposal.tenant_id,
                proposal_id=proposal.id,
                invoice_number=invoice_number,
                billing_period=billing_period,
                status="ISSUED",
                issue_date=now_date,
                due_date=due_date,
                subtotal=prop_subtotal,
                vat_rate=vat_rate,
                vat_amount=proposal.vat_amount or Decimal("0.00"),
                total_amount=proposal.total_amount,
                paid_amount=Decimal("0.00"),
                line_items=proposal.line_items or [],
                banking_details=default_banking,
                created_at=datetime.now(timezone.utc),
            )
            db.add(auto_invoice)
            logger.info(f"🧾 [AUTO-INVOICE GENERATED] Invoice {invoice_number} created automatically for approved Proposal {proposal.proposal_number}")

    elif status_upper == "REJECTED":
        proposal.approved_by = f"Rejected by {actor}"
        proposal.approved_at = datetime.now(timezone.utc)
    elif status_upper == "SUBMITTED_TO_MUNICIPALITY":
        # Dispatch notification to recipient
        rec_email = target_email or (tenant.billing_contact_email if tenant else None) or "obimax.ml@gmail.com"
        if tenant:
            _send_proposal_email(proposal, tenant, rec_email)

    db.commit()
    db.refresh(proposal)
    return _format_proposal(proposal, db)


@router.delete("/proposals/{proposal_id}", status_code=200)
def delete_proposal(
    proposal_id: UUID,
    db: Session = Depends(get_db),
):
    proposal = db.get(Proposal, proposal_id)
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found.")
    
    db.delete(proposal)
    db.commit()
    return {"status": "ok", "message": f"Proposal {proposal.proposal_number} deleted successfully."}


# -----------------------------------------------------------------------------
# INVOICES API
# -----------------------------------------------------------------------------

@router.get("/invoices", response_model=list[InvoiceResponse])
def list_invoices(
    tenant_id: UUID | None = None,
    db: Session = Depends(get_db),
):
    query = select(Invoice).order_by(Invoice.created_at.desc())
    if tenant_id:
        query = query.where(Invoice.tenant_id == tenant_id)
    invoices = db.scalars(query).all()
    return [_format_invoice(inv, db) for inv in invoices]


@router.post("/invoices", response_model=InvoiceResponse, status_code=201)
def create_invoice(
    payload: InvoiceCreate,
    db: Session = Depends(get_db),
):
    tenant = db.get(Tenant, payload.tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Municipality not found.")

    # Generate sequential invoice number: INV-CODE-YYYYMM-XXX
    count = db.scalar(select(func.count()).select_from(Invoice)) or 0
    seq = count + 1
    now_str = datetime.now().strftime("%Y%m")
    invoice_number = f"INV-{tenant.code}-{now_str}-{seq:03d}"

    # Calculate line items subtotal
    subtotal = Decimal("0.00")
    items_data = []
    for item in payload.line_items:
        qty = Decimal(str(item.quantity))
        price = Decimal(str(item.unit_price))
        total = qty * price
        items_data.append({
            "description": item.description,
            "quantity": float(qty),
            "unit_price": float(price),
            "total": float(total),
        })
        subtotal += total

    # If no line items, autogenerate from tenant engagement model
    if not items_data:
        if tenant.engagement_model == "SAAS_SELF_SERVICE":
            fee = tenant.monthly_subscription_fee or Decimal("20000.00")
            items_data.append({
                "description": f"Khokhisa {tenant.subscription_tier} SaaS License ({payload.billing_period})",
                "quantity": 1.0,
                "unit_price": float(fee),
                "total": float(fee),
            })
            subtotal += fee
        else:
            comm = tenant.commission_rate or Decimal("10.00")
            items_data.append({
                "description": f"Managed Collections Recovery Fee ({comm}% Commission for {payload.billing_period})",
                "quantity": 1.0,
                "unit_price": 0.0,
                "total": 0.0,
            })

    vat_rate = Decimal(str(payload.vat_rate))
    vat_amount = (subtotal * (vat_rate / Decimal("100.00"))).quantize(Decimal("0.01"))
    total_amount = subtotal + vat_amount

    default_banking = {
        "bank_name": "Capitec Business",
        "account_name": "Moloi Mosea Investments (Pty) Ltd",
        "account_number": "62899432101",
        "branch_code": "470010",
        "account_type": "Business Cheque Account",
        "swift_code": "CBLAZAJJ",
        "payment_reference": invoice_number,
    }

    invoice = Invoice(
        id=uuid4(),
        tenant_id=payload.tenant_id,
        proposal_id=payload.proposal_id,
        invoice_number=invoice_number,
        billing_period=payload.billing_period,
        status="ISSUED",
        issue_date=payload.issue_date,
        due_date=payload.due_date,
        subtotal=subtotal,
        vat_rate=vat_rate,
        vat_amount=vat_amount,
        total_amount=total_amount,
        paid_amount=Decimal("0.00"),
        line_items=items_data,
        banking_details=payload.banking_details.model_dump() if payload.banking_details else default_banking,
        notes=payload.notes or f"Official Tax Invoice for municipal revenue & debt recovery services. Payment due within 30 days.",
        created_at=datetime.now(timezone.utc),
    )

    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    return _format_invoice(invoice, db)


@router.post("/invoices/autogenerate", response_model=InvoiceResponse, status_code=201)
def autogenerate_invoice_from_tenant(
    tenant_id: str,
    billing_period: str | None = None,
    due_days: int = 30,
    db: Session = Depends(get_db),
):
    """
    Autogenerates an official tax invoice based on the municipality's configured engagement model,
    subscription tier, monthly fee, recovery books, and banking details.
    """
    target_tenant_id = None
    if tenant_id and tenant_id.upper() != "GLOBAL":
        try:
            target_tenant_id = UUID(tenant_id)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid municipality ID: {tenant_id}")
    
    tenant = None
    if target_tenant_id:
        tenant = db.get(Tenant, target_tenant_id)
    else:
        # If GLOBAL, select the first active municipality or default tenant
        tenant = db.execute(
            select(Tenant).where(Tenant.subscription_status == "ACTIVE").order_by(Tenant.name)
        ).scalars().first() or db.execute(select(Tenant).order_by(Tenant.name)).scalars().first()

    if not tenant:
        raise HTTPException(status_code=404, detail="No active municipality found to generate invoice for.")

    period = billing_period or datetime.now().strftime("%B %Y")
    issue_d = date.today()
    from datetime import timedelta
    due_d = issue_d + timedelta(days=due_days)

    items = []
    subtotal = Decimal("0.00")

    # Platform Usage & SaaS Subscription License Fee
    monthly_fee = tenant.monthly_subscription_fee or (Decimal("45000.00") if tenant.subscription_tier == "ENTERPRISE" else Decimal("25000.00"))
    if monthly_fee and monthly_fee > 0:
        items.append({
            "description": f"Khokhisa {tenant.subscription_tier or 'Standard'} Platform Usage & Cloud Software License ({period})",
            "quantity": 1.0,
            "unit_price": float(monthly_fee),
            "total": float(monthly_fee),
        })
        subtotal += monthly_fee

    # Volume usage / seat usage line item if registered debtor accounts exceed tier threshold
    from app.models import ConsumerAccount
    acc_count = db.scalar(select(func.count()).select_from(ConsumerAccount).where(ConsumerAccount.tenant_id == tenant.id)) or 0
    if acc_count > 10000:
        overage = acc_count - 10000
        overage_fee = (Decimal(str(overage)) * Decimal("0.85")).quantize(Decimal("0.01"))
        items.append({
            "description": f"High-Volume Data Processing Usage ({overage:,} accounts above 10k baseline @ R0.85/acct)",
            "quantity": float(overage),
            "unit_price": 0.85,
            "total": float(overage_fee),
        })
        subtotal += overage_fee
    elif not items:
        # Default baseline platform usage fee
        base_fee = Decimal("15000.00")
        items.append({
            "description": f"Khokhisa Cloud Platform Usage & Infrastructure ({period})",
            "quantity": 1.0,
            "unit_price": float(base_fee),
            "total": float(base_fee),
        })
        subtotal += base_fee

    vat_rate = Decimal("15.00")
    vat_amount = (subtotal * Decimal("0.15")).quantize(Decimal("0.01"))
    total_amount = subtotal + vat_amount

    count = db.scalar(select(func.count()).select_from(Invoice)) or 0
    seq = count + 1
    now_str = datetime.now().strftime("%Y%m")
    invoice_number = f"INV-{tenant.code}-{now_str}-{seq:03d}"

    banking = {
        "bank_name": "First National Bank (FNB)",
        "account_name": "Khokhisa (Pty) Ltd - Khokhisa Collections",
        "account_number": "62899432101",
        "branch_code": "250655",
        "account_type": "Business Cheque Account",
        "swift_code": "FIRNZAJJ",
        "payment_reference": invoice_number,
    }

    invoice = Invoice(
        id=uuid4(),
        tenant_id=tenant.id,
        invoice_number=invoice_number,
        billing_period=period,
        status="ISSUED",
        issue_date=issue_d,
        due_date=due_d,
        subtotal=subtotal,
        vat_rate=vat_rate,
        vat_amount=vat_amount,
        total_amount=total_amount,
        paid_amount=Decimal("0.00"),
        line_items=items,
        banking_details=banking,
        notes=f"Auto-generated based on {tenant.engagement_model} contract terms for {period}.",
        created_at=datetime.now(timezone.utc),
    )

    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    return _format_invoice(invoice, db)


@router.patch("/invoices/{invoice_id}/status", response_model=InvoiceResponse)
def update_invoice_status(
    invoice_id: UUID,
    status: str = Query(..., description="DRAFT, ISSUED, PAID, OVERDUE, CANCELLED"),
    paid_amount: Decimal | None = Query(default=None),
    db: Session = Depends(get_db),
):
    invoice = db.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found.")

    status_upper = status.strip().upper()
    invoice.status = status_upper
    if status_upper == "PAID":
        invoice.paid_amount = paid_amount if paid_amount is not None else invoice.total_amount

    db.commit()
    db.refresh(invoice)
    return _format_invoice(invoice, db)


@router.delete("/invoices/{invoice_id}", status_code=200)
def delete_invoice(
    invoice_id: UUID,
    db: Session = Depends(get_db),
):
    invoice = db.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    
    db.delete(invoice)
    db.commit()
    return {"status": "ok", "message": f"Invoice {invoice.invoice_number} deleted successfully."}
