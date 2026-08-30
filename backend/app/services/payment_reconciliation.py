import uuid
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    AuditEvent,
    CollectionCase,
    MunicipalAccount,
    Payment,
    Promise,
)
from app.services.ledger import (
    create_payment_transaction,
)


def reconcile_payment(
    db: Session,
    *,
    payment_id: UUID,
    actor: str = "system",
):
    payment = db.get(
        Payment,
        payment_id,
    )

    if not payment:
        raise ValueError(
            "Payment not found."
        )

    if payment.reconciliation_status == "RECONCILED":
        return {
            "payment": payment,
            "matched_promise": None,
            "result": "ALREADY_RECONCILED",
            "remaining_payment": Decimal("0"),
        }

    if not payment.account_id:
        raise ValueError(
            "Payment is not linked to a municipal account."
        )

    account = db.get(
        MunicipalAccount,
        payment.account_id,
    )

    if not account:
        raise ValueError(
            "Municipal account not found."
        )

    pending_promises = list(
        db.scalars(
            select(Promise)
            .join(
                CollectionCase,
                Promise.case_id == CollectionCase.id,
            )
            .where(
                CollectionCase.account_id == account.id,
                Promise.status == "PENDING",
            )
            .order_by(
                Promise.due_date.asc(),
                Promise.created_at.asc(),
            )
        ).all()
    )

    payment.reconciliation_status = "RECONCILED"

    matched_promise = None
    promise_result = "NO_PENDING_PROMISE"

    remaining_payment = Decimal(
        payment.amount
    )

    for promise in pending_promises:

        if remaining_payment <= 0:
            break

        if remaining_payment >= promise.amount:
            remaining_payment -= promise.amount

            promise.status = "KEPT"

            case = db.get(
                CollectionCase,
                promise.case_id,
            )

            if case:
                case.status = "PAYING"

            matched_promise = promise
            promise_result = "KEPT"

        else:
            promise_result = "PARTIAL_PAYMENT"

            matched_promise = promise

            break

    ledger_transaction = create_payment_transaction(
        db=db,
        payment=payment,
        created_by=actor,
    )

    now = datetime.now(timezone.utc)

    audit_event = AuditEvent(
        id=uuid.uuid4(),
        tenant_id=payment.tenant_id,
        actor=actor,
        event_type="PAYMENT_RECONCILED",
        entity_type="Payment",
        entity_id=payment.id,
        payload={
            "payment_amount": str(payment.amount),
            "account_id": str(account.id),
            "matched_promise_id": (
                str(matched_promise.id)
                if matched_promise
                else None
            ),
            "promise_result": promise_result,
            "remaining_payment": str(
                remaining_payment
            ),
            "ledger_transaction_id": (
                str(ledger_transaction.id)
                if ledger_transaction
                else None
            ),
        },
        created_at=now,
    )

    db.add(audit_event)

    db.commit()
    db.refresh(payment)

    return {
        "payment": payment,
        "matched_promise": matched_promise,
        "result": promise_result,
        "remaining_payment": remaining_payment,
    }


def reconcile_payment_against_promises(db: Session, payment_id: UUID, actor: str = "system"):
    res = reconcile_payment(db=db, payment_id=payment_id, actor=actor)
    return res.get("matched_promise")
