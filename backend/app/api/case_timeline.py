from datetime import datetime, date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import (
    AuditEvent,
    CollectionCase,
    MunicipalAccount,
    Customer,
    Promise,
    PaymentPlan,
    Payment,
)


router = APIRouter(
    prefix="/cases",
    tags=["Case Timeline"],
)


@router.get("/{case_id}/timeline")
def get_case_timeline(
    case_id: UUID,
    db: Session = Depends(get_db),
):
    # ---------------------------------------------------------
    # 1. Find case
    # ---------------------------------------------------------
    case = db.get(CollectionCase, case_id)

    if not case:
        raise HTTPException(
            status_code=404,
            detail="Collection case not found.",
        )

    # ---------------------------------------------------------
    # 2. Account
    # ---------------------------------------------------------
    account = db.get(
        MunicipalAccount,
        case.account_id,
    )

    if not account:
        raise HTTPException(
            status_code=404,
            detail="Municipal account not found.",
        )

    # ---------------------------------------------------------
    # 3. Customer
    # ---------------------------------------------------------
    customer = None

    if account.customer_id:
        customer = db.get(
            Customer,
            account.customer_id,
        )

    # ---------------------------------------------------------
    # 4. Promises
    # ---------------------------------------------------------
    promises = db.execute(
        select(Promise)
        .where(Promise.case_id == case.id)
        .order_by(Promise.due_date.desc())
    ).scalars().all()

    # ---------------------------------------------------------
    # 5. Payment plans
    # ---------------------------------------------------------
    payment_plans = db.execute(
        select(PaymentPlan)
        .where(PaymentPlan.case_id == case.id)
        .order_by(PaymentPlan.start_date.desc())
    ).scalars().all()

    # ---------------------------------------------------------
    # 6. Payments
    # ---------------------------------------------------------
    payments = db.execute(
        select(Payment)
        .where(
            Payment.account_id == account.id
        )
        .order_by(Payment.payment_date.desc())
    ).scalars().all()

    # ---------------------------------------------------------
    # 7. Audit events
    # ---------------------------------------------------------
    audit_events = db.execute(
        select(AuditEvent)
        .where(
            AuditEvent.entity_id == case.id,
        )
        .order_by(AuditEvent.created_at.desc())
    ).scalars().all()

    # ---------------------------------------------------------
    # 8. Build timeline
    # ---------------------------------------------------------
    timeline = []

    for promise in promises:
        timeline.append(
            {
                "type": "PROMISE",
                "id": str(promise.id),
                "date": promise.created_at.isoformat() if promise.created_at else None,
                "sort_key": promise.created_at,
                "title": "Promise to Pay",
                "status": promise.status,
                "amount": float(promise.amount),
                "due_date": promise.due_date.isoformat() if promise.due_date else None,
            }
        )

    for plan in payment_plans:
        timeline.append(
            {
                "type": "PAYMENT_PLAN",
                "id": str(plan.id),
                "date": plan.start_date.isoformat() if plan.start_date else None,
                "sort_key": datetime.combine(plan.start_date, datetime.min.time()) if isinstance(plan.start_date, date) else plan.start_date,
                "title": "Payment Plan",
                "status": plan.status,
                "deposit_amount": float(plan.deposit_amount),
                "installment_amount": float(plan.installment_amount),
                "frequency": plan.frequency,
                "number_of_installments": plan.number_of_installments,
            }
        )

    for payment in payments:
        timeline.append(
            {
                "type": "PAYMENT",
                "id": str(payment.id),
                "date": payment.payment_date.isoformat() if payment.payment_date else None,
                "sort_key": datetime.combine(payment.payment_date, datetime.min.time()) if isinstance(payment.payment_date, date) else payment.payment_date,
                "title": "Payment Received",
                "status": payment.reconciliation_status,
                "amount": float(payment.amount),
                "external_reference": payment.external_reference,
                "posted_at": payment.posted_at.isoformat() if payment.posted_at else None,
            }
        )

    for event in audit_events:
        timeline.append(
            {
                "type": "AUDIT",
                "id": str(event.id),
                "date": event.created_at.isoformat() if event.created_at else None,
                "sort_key": event.created_at,
                "title": event.event_type,
                "actor": event.actor,
                "entity_type": event.entity_type,
                "entity_id": (
                    str(event.entity_id)
                    if event.entity_id
                    else None
                ),
                "payload": event.payload,
            }
        )

    # Newest first
    timeline.sort(
        key=lambda item: str(item.get("sort_key") or ""),
        reverse=True,
    )

    # Clean internal sort_key
    for item in timeline:
        item.pop("sort_key", None)

    # ---------------------------------------------------------
    # 9. Response
    # ---------------------------------------------------------
    return {
        "case": {
            "id": str(case.id),
            "tenant_id": str(case.tenant_id),
            "account_id": str(case.account_id),
            "status": case.status,
            "priority": case.priority,
            "strategy_code": case.strategy_code,
            "assigned_to": case.assigned_to,
            "opened_at": case.opened_at.isoformat() if case.opened_at else None,
            "closed_at": case.closed_at.isoformat() if case.closed_at else None,
        },
        "account": {
            "id": str(account.id),
            "account_number": account.account_number,
            "account_status": account.account_status,
            "balance": float(account.balance),
            "arrears": float(account.arrears),
            "days_in_arrears": account.days_in_arrears,
            "last_payment_date": account.last_payment_date.isoformat() if account.last_payment_date else None,
            "last_payment_amount": float(account.last_payment_amount),
        },
        "customer": (
            {
                "id": str(customer.id),
                "first_name": customer.first_name,
                "last_name": customer.last_name,
                "id_number": customer.id_number,
                "company_registration": customer.company_registration,
                "mobile": customer.mobile,
                "email": customer.email,
            }
            if customer
            else None
        ),
        "promises": [
            {
                "id": str(p.id),
                "amount": float(p.amount),
                "due_date": p.due_date.isoformat() if p.due_date else None,
                "status": p.status,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in promises
        ],
        "payment_plans": [
            {
                "id": str(p.id),
                "deposit_amount": float(p.deposit_amount),
                "installment_amount": float(p.installment_amount),
                "frequency": p.frequency,
                "number_of_installments": (
                    p.number_of_installments
                ),
                "status": p.status,
                "start_date": p.start_date.isoformat() if p.start_date else None,
            }
            for p in payment_plans
        ],
        "payments": [
            {
                "id": str(p.id),
                "amount": float(p.amount),
                "payment_date": p.payment_date.isoformat() if p.payment_date else None,
                "external_reference": (
                    p.external_reference
                ),
                "reconciliation_status": (
                    p.reconciliation_status
                ),
                "posted_at": p.posted_at.isoformat() if p.posted_at else None,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in payments
        ],
        "timeline": timeline,
    }
