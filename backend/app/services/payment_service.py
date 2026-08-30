from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    AuditEvent,
    MunicipalAccount,
    Payment,
)
from app.services.promise_service import (
    evaluate_payment_against_promises,
)


class PaymentServiceError(Exception):
    """Base payment service exception."""


class PaymentValidationError(PaymentServiceError):
    """Raised when payment data is invalid."""


class PaymentDuplicateError(PaymentServiceError):
    """Raised when a payment already exists."""


class PaymentAccountNotFoundError(PaymentServiceError):
    """Raised when the municipal account cannot be found."""


def record_payment(
    db: Session,
    *,
    tenant_id: UUID | str,
    account_number: str,
    amount: Decimal,
    payment_date,
    external_reference: str | None = None,
    actor: str = "system",
) -> Payment:
    """
    Record and reconcile a payment against a municipal account.

    This is the single source of truth for payment processing.
    Both API and batch-import workflows should use this function.
    """

    # ---------------------------------------------------------
    # Validation
    # ---------------------------------------------------------

    if not tenant_id:
        raise PaymentValidationError(
            "tenant_id is required."
        )

    if isinstance(tenant_id, str):
        try:
            tenant_id = UUID(tenant_id)
        except ValueError as exc:
            raise PaymentValidationError("Invalid tenant_id UUID format.") from exc

    if not account_number:
        raise PaymentValidationError(
            "account_number is required."
        )

    if amount is None:
        raise PaymentValidationError(
            "Payment amount is required."
        )

    amount = Decimal(str(amount))

    if amount <= Decimal("0.00"):
        raise PaymentValidationError(
            "Payment amount must be greater than zero."
        )

    if payment_date is None:
        raise PaymentValidationError(
            "payment_date is required."
        )

    today = datetime.now(
        timezone.utc
    ).date()

    if payment_date > today:
        raise PaymentValidationError(
            "Payment date cannot be in the future."
        )

    if external_reference:
        external_reference = (
            str(external_reference).strip()
        )

    # ---------------------------------------------------------
    # Find municipal account
    # ---------------------------------------------------------

    account = db.execute(
        select(MunicipalAccount)
        .where(
            MunicipalAccount.tenant_id == tenant_id,
            MunicipalAccount.account_number
            == account_number,
        )
    ).scalar_one_or_none()

    if not account:
        raise PaymentAccountNotFoundError(
            f"Municipal account '{account_number}' "
            "was not found."
        )

    # ---------------------------------------------------------
    # Duplicate protection
    # ---------------------------------------------------------

    if external_reference:
        existing_payment = db.execute(
            select(Payment)
            .where(
                Payment.tenant_id == tenant_id,
                Payment.external_reference
                == external_reference,
            )
        ).scalar_one_or_none()

        if existing_payment:
            raise PaymentDuplicateError(
                "Payment with external reference "
                f"'{external_reference}' already exists."
            )

    # ---------------------------------------------------------
    # Create payment
    # ---------------------------------------------------------

    now = datetime.now(timezone.utc)

    payment = Payment(
        id=uuid4(),
        tenant_id=tenant_id,
        account_id=account.id,
        amount=amount,
        payment_date=payment_date,
        external_reference=external_reference,
        reconciliation_status="RECONCILED",
        posted_at=now,
        created_at=now,
    )

    db.add(payment)

    # ---------------------------------------------------------
    # Update account
    # ---------------------------------------------------------

    account.balance = max(
        Decimal("0.00"),
        Decimal(str(account.balance)) - amount,
    )

    account.arrears = max(
        Decimal("0.00"),
        Decimal(str(account.arrears)) - amount,
    )

    account.last_payment_date = payment_date
    account.last_payment_amount = amount

    if account.arrears <= Decimal("0.00"):
        account.days_in_arrears = 0

    # ---------------------------------------------------------
    # Evaluate payment against promises
    # ---------------------------------------------------------

    evaluate_payment_against_promises(
        db,
        payment=payment,
        actor=actor,
    )

    # ---------------------------------------------------------
    # Audit
    # ---------------------------------------------------------

    audit_event = AuditEvent(
        id=uuid4(),
        tenant_id=tenant_id,
        actor=actor,
        event_type="PAYMENT_RECORDED",
        entity_type="Payment",
        entity_id=payment.id,
        payload={
            "account_id": str(account.id),
            "account_number": account.account_number,
            "amount": str(amount),
            "payment_date": payment_date.isoformat(),
            "external_reference": external_reference,
        },
        created_at=now,
    )

    db.add(audit_event)

    return payment
