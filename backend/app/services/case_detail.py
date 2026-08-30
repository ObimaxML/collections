from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    AuditEvent,
    CollectionActivity,
    CollectionCase,
    Customer,
    MunicipalAccount,
    Payment,
    PaymentPlan,
    Promise,
    Property,
)


def get_case_detail(
    db: Session,
    case_id: UUID,
):
    case = db.get(
        CollectionCase,
        case_id,
    )

    if not case:
        raise ValueError("Collection case not found.")

    account = db.get(
        MunicipalAccount,
        case.account_id,
    )

    if not account:
        raise ValueError(
            "Municipal account linked to case was not found."
        )

    customer = None

    if account.customer_id:
        customer = db.get(
            Customer,
            account.customer_id,
        )

    property_ = None

    if account.property_id:
        property_ = db.get(
            Property,
            account.property_id,
        )

    promises = db.scalars(
        select(Promise)
        .where(
            Promise.case_id == case.id
        )
        .order_by(
            Promise.due_date.desc()
        )
    ).all()

    payment_plans = db.scalars(
        select(PaymentPlan)
        .where(
            PaymentPlan.case_id == case.id
        )
        .order_by(
            PaymentPlan.start_date.desc()
        )
    ).all()

    payments = db.scalars(
        select(Payment)
        .where(
            Payment.account_id == account.id
        )
        .order_by(
            Payment.payment_date.desc()
        )
    ).all()

    audit_events = db.scalars(
        select(AuditEvent)
        .where(
            AuditEvent.entity_type.in_(["CollectionCase", "collection_case"])
        )
        .where(
            AuditEvent.entity_id == case.id
        )
        .order_by(
            AuditEvent.created_at.desc()
        )
    ).all()

    activities = db.scalars(
        select(CollectionActivity)
        .where(
            CollectionActivity.case_id == case.id
        )
        .order_by(
            CollectionActivity.created_at.desc()
        )
    ).all()

    return {
        "case": {
            "id": case.id,
            "tenant_id": case.tenant_id,
            "account_id": case.account_id,
            "status": case.status,
            "priority": case.priority,
            "strategy_code": case.strategy_code,
            "assigned_to": case.assigned_to,
            "opened_at": case.opened_at,
            "closed_at": case.closed_at,
        },

        "customer": (
            {
                "id": customer.id,
                "first_name": customer.first_name,
                "last_name": customer.last_name,
                "id_number": customer.id_number,
                "company_registration": (
                    customer.company_registration
                ),
                "mobile": customer.mobile,
                "email": customer.email,
            }
            if customer
            else None
        ),

        "property": (
            {
                "id": property_.id,
                "property_reference": (
                    property_.property_reference
                ),
                "address": property_.address,
            }
            if property_
            else None
        ),

        "account": {
            "id": account.id,
            "account_number": account.account_number,
            "account_status": account.account_status,
            "balance": account.balance,
            "arrears": account.arrears,
            "days_in_arrears": (
                account.days_in_arrears
            ),
            "last_payment_date": (
                account.last_payment_date
            ),
            "last_payment_amount": (
                account.last_payment_amount
            ),
        },

        "activities": [
            {
                "id": activity.id,
                "actor": activity.actor,
                "channel": activity.channel,
                "outcome": activity.outcome,
                "successful": activity.successful,
                "notes": activity.notes,
                "next_action": activity.next_action,
                "next_action_date": (
                    activity.next_action_date
                ),
                "created_at": activity.created_at,
            }
            for activity in activities
        ],

        "promises": [
            {
                "id": promise.id,
                "amount": promise.amount,
                "due_date": promise.due_date,
                "status": promise.status,
                "created_at": promise.created_at,
            }
            for promise in promises
        ],

        "payment_plans": [
            {
                "id": plan.id,
                "deposit_amount": (
                    plan.deposit_amount
                ),
                "installment_amount": (
                    plan.installment_amount
                ),
                "frequency": plan.frequency,
                "number_of_installments": (
                    plan.number_of_installments
                ),
                "status": plan.status,
                "start_date": plan.start_date,
            }
            for plan in payment_plans
        ],

        "payments": [
            {
                "id": payment.id,
                "amount": payment.amount,
                "payment_date": payment.payment_date,
                "external_reference": (
                    payment.external_reference
                ),
                "reconciliation_status": (
                    payment.reconciliation_status
                ),
                "posted_at": payment.posted_at,
                "created_at": payment.created_at,
            }
            for payment in payments
        ],

        "audit_history": [
            {
                "id": event.id,
                "actor": event.actor,
                "event_type": event.event_type,
                "entity_type": event.entity_type,
                "entity_id": event.entity_id,
                "payload": event.payload,
                "created_at": event.created_at,
            }
            for event in audit_events
        ],
    }
