import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    AuditEvent,
    CollectionCase,
    Payment,
    PaymentAllocation,
    Promise,
)


def allocate_payment(
    db: Session,
    payment: Payment,
) -> dict:
    """
    Allocate a payment against outstanding promises
    belonging to the payment's municipal account.

    Allocation is performed oldest due date first.
    Creates persistent PaymentAllocation records in the database.
    """

    if not payment.account_id:
        return {
            "status": "UNALLOCATED",
            "allocated_amount": Decimal("0.00"),
            "unallocated_amount": payment.amount,
            "allocations": [],
            "reason": "Payment has no municipal account.",
        }

    # Prevent accidental duplicate processing.
    if payment.reconciliation_status == "ALLOCATED":
        return {
            "status": "ALREADY_ALLOCATED",
            "allocated_amount": payment.amount,
            "unallocated_amount": Decimal("0.00"),
            "allocations": [],
        }

    statement = (
        select(Promise)
        .join(
            CollectionCase,
            Promise.case_id == CollectionCase.id,
        )
        .where(
            CollectionCase.account_id == payment.account_id,
        )
        .where(
            Promise.status == "ACTIVE",
        )
        .order_by(
            Promise.due_date.asc(),
            Promise.created_at.asc(),
        )
    )

    promises = list(db.scalars(statement))

    remaining = Decimal(payment.amount)
    allocations = []

    for promise in promises:
        if remaining <= Decimal("0.00"):
            break

        allocation_amount = min(
            remaining,
            Decimal(promise.amount),
        )

        remaining -= allocation_amount

        if allocation_amount >= Decimal(promise.amount):
            promise.status = "FULFILLED"
            allocation_status = "FULFILLED"
        else:
            allocation_status = "PARTIAL"

        # 1. Create persistent PaymentAllocation record
        allocation_record = PaymentAllocation(
            id=uuid.uuid4(),
            payment_id=payment.id,
            promise_id=promise.id,
            amount=allocation_amount,
            allocation_type="PROMISE",
            created_at=datetime.now(timezone.utc),
        )
        db.add(allocation_record)

        allocations.append(
            {
                "promise_id": str(promise.id),
                "allocated_amount": allocation_amount,
                "promise_amount": promise.amount,
                "status": allocation_status,
            }
        )

        # 2. Record AuditEvent
        event = AuditEvent(
            id=uuid.uuid4(),
            tenant_id=payment.tenant_id,
            actor="system",
            event_type="PAYMENT_ALLOCATED",
            entity_type="promise",
            entity_id=promise.id,
            payload={
                "payment_id": str(payment.id),
                "allocated_amount": str(
                    allocation_amount
                ),
                "promise_amount": str(
                    promise.amount
                ),
                "allocation_status": allocation_status,
            },
            created_at=datetime.now(timezone.utc),
        )
        db.add(event)

    allocated_amount = (
        Decimal(payment.amount) - remaining
    )

    # 3. If there is remaining unallocated cash, log unallocated allocation record
    if remaining > Decimal("0.00"):
        unallocated_record = PaymentAllocation(
            id=uuid.uuid4(),
            payment_id=payment.id,
            promise_id=None,
            amount=remaining,
            allocation_type="UNALLOCATED",
            created_at=datetime.now(timezone.utc),
        )
        db.add(unallocated_record)

    if allocated_amount == Decimal("0.00"):
        payment.reconciliation_status = "UNMATCHED"
        status = "UNALLOCATED"

    elif remaining > Decimal("0.00"):
        payment.reconciliation_status = "PARTIAL"
        status = "PARTIALLY_ALLOCATED"

    else:
        payment.reconciliation_status = "ALLOCATED"
        status = "ALLOCATED"

    return {
        "status": status,
        "allocated_amount": allocated_amount,
        "unallocated_amount": remaining,
        "allocations": allocations,
    }
