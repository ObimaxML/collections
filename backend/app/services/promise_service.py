from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    AuditEvent,
    CollectionCase,
    Payment,
    PaymentAllocation,
    Promise,
)


OPEN_PROMISE_STATUSES = (
    "OPEN",
    "ACTIVE",
    "PENDING",
    "PARTIAL",
)


def evaluate_payment_against_promises(
    db: Session,
    *,
    payment: Payment,
    actor: str = "system",
) -> list[Promise]:

    if not payment.account_id:
        return []

    cases = db.execute(
        select(CollectionCase)
        .where(
            CollectionCase.account_id
            == payment.account_id
        )
    ).scalars().all()

    if not cases:
        return []

    affected_promises: list[Promise] = []

    remaining_amount = Decimal(
        str(payment.amount)
    )

    for case in cases:

        if remaining_amount <= Decimal("0.00"):
            break

        promises = db.execute(
            select(Promise)
            .where(
                Promise.case_id == case.id,
                Promise.status.in_(
                    OPEN_PROMISE_STATUSES
                ),
            )
            .order_by(
                Promise.due_date.asc(),
                Promise.created_at.asc(),
            )
        ).scalars().all()

        for promise in promises:

            if remaining_amount <= Decimal("0.00"):
                break

            promise_amount = Decimal(
                str(promise.amount)
            )

            # -------------------------------------------------
            # Determine amount already allocated
            # -------------------------------------------------

            allocated = db.execute(
                select(
                    PaymentAllocation.amount
                )
                .where(
                    PaymentAllocation.promise_id
                    == promise.id
                )
            ).scalars().all()

            already_paid = sum(
                (
                    Decimal(str(value))
                    for value in allocated
                ),
                Decimal("0.00"),
            )

            outstanding_promise = max(
                Decimal("0.00"),
                promise_amount - already_paid,
            )

            if outstanding_promise <= Decimal("0.00"):
                promise.status = "KEPT"
                continue

            allocation_amount = min(
                remaining_amount,
                outstanding_promise,
            )

            allocation = PaymentAllocation(
                id=uuid4(),
                payment_id=payment.id,
                promise_id=promise.id,
                amount=allocation_amount,
                allocation_type="PROMISE",
                created_at=datetime.now(
                    timezone.utc
                ),
            )

            db.add(allocation)

            remaining_amount -= allocation_amount

            new_total_paid = (
                already_paid
                + allocation_amount
            )

            if new_total_paid >= promise_amount:
                promise.status = "KEPT"
                event_type = "PROMISE_KEPT"
            else:
                promise.status = "PARTIAL"
                event_type = "PROMISE_PARTIAL"

            affected_promises.append(
                promise
            )

            db.add(
                AuditEvent(
                    id=uuid4(),
                    tenant_id=payment.tenant_id,
                    actor=actor,
                    event_type=event_type,
                    entity_type="Promise",
                    entity_id=promise.id,
                    payload={
                        "payment_id": str(
                            payment.id
                        ),
                        "allocated_amount": str(
                            allocation_amount
                        ),
                        "promise_amount": str(
                            promise_amount
                        ),
                        "total_paid": str(
                            new_total_paid
                        ),
                        "remaining": str(
                            max(
                                Decimal("0.00"),
                                promise_amount
                                - new_total_paid,
                            )
                        ),
                    },
                    created_at=datetime.now(
                        timezone.utc
                    ),
                )
            )

    # ---------------------------------------------------------
    # Allocate excess payment
    # ---------------------------------------------------------

    if remaining_amount > Decimal("0.00"):

        db.add(
            PaymentAllocation(
                id=uuid4(),
                payment_id=payment.id,
                promise_id=None,
                amount=remaining_amount,
                allocation_type="UNALLOCATED",
                created_at=datetime.now(
                    timezone.utc
                ),
            )
        )

    return affected_promises


def mark_overdue_promises_broken(
    db: Session,
    *,
    tenant_id: UUID | None = None,
    as_of: date | None = None,
    actor: str = "promise_monitor",
) -> int:
    """
    Mark overdue OPEN/ACTIVE/PENDING/PARTIAL promises as BROKEN.

    Returns the number of promises changed.
    """

    as_of = as_of or datetime.now(
        timezone.utc
    ).date()

    query = (
        select(Promise, CollectionCase)
        .join(
            CollectionCase,
            CollectionCase.id
            == Promise.case_id,
        )
        .where(
            Promise.status.in_(
                OPEN_PROMISE_STATUSES
            ),
            Promise.due_date < as_of,
        )
    )

    if tenant_id:
        query = query.where(
            CollectionCase.tenant_id
            == tenant_id
        )

    results = db.execute(query).all()

    broken_count = 0

    for promise, case in results:

        promise.status = "BROKEN"

        broken_count += 1

        # -----------------------------------------------------
        # Escalate case
        # -----------------------------------------------------

        if case.status not in (
            "PAID",
            "CLOSED",
        ):
            case.status = "BROKEN_PROMISE"

        # -----------------------------------------------------
        # Audit
        # -----------------------------------------------------

        db.add(
            AuditEvent(
                id=uuid4(),
                tenant_id=case.tenant_id,
                actor=actor,
                event_type="PROMISE_BROKEN",
                entity_type="Promise",
                entity_id=promise.id,
                payload={
                    "case_id": str(case.id),
                    "due_date": (
                        promise.due_date.isoformat()
                    ),
                    "status": "BROKEN",
                },
                created_at=datetime.now(
                    timezone.utc
                ),
            )
        )

    return broken_count
