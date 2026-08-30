from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import MunicipalAccount, Payment


ZERO = Decimal("0.00")


def get_account_ledger(
    db: Session,
    account_id: UUID,
) -> dict:
    """
    Return the current financial position of a municipal account.

    The account balance and arrears come from the municipal account,
    while payments are calculated from successfully reconciled /
    allocated payment records.
    """

    account = db.get(
        MunicipalAccount,
        account_id,
    )

    if not account:
        raise ValueError("Municipal account not found.")

    payment_total = db.scalar(
        select(
            func.coalesce(
                func.sum(Payment.amount),
                0,
            )
        )
        .where(
            Payment.account_id == account_id
        )
        .where(
            Payment.reconciliation_status.in_(
                [
                    "ALLOCATED",
                    "PARTIAL",
                    "MATCHED",
                    "RECONCILED",
                    "POSTED",
                    "SUCCESS",
                ]
            )
        )
    )

    payment_total = Decimal(
        str(payment_total or ZERO)
    )

    balance = Decimal(
        str(account.balance)
    )

    arrears = Decimal(
        str(account.arrears)
    )

    return {
        "account_id": account.id,
        "account_number": account.account_number,
        "account_status": account.account_status,
        "balance": balance,
        "arrears": arrears,
        "payments_received": payment_total,
        "days_in_arrears": account.days_in_arrears,
        "last_payment_date": account.last_payment_date,
        "last_payment_amount": account.last_payment_amount,
    }


def get_account_payment_total(
    db: Session,
    account_id: UUID,
) -> Decimal:
    """
    Return the total successfully processed payments
    for an account.
    """

    total = db.scalar(
        select(
            func.coalesce(
                func.sum(Payment.amount),
                0,
            )
        )
        .where(
            Payment.account_id == account_id
        )
        .where(
            Payment.reconciliation_status.in_(
                [
                    "ALLOCATED",
                    "PARTIAL",
                    "MATCHED",
                    "RECONCILED",
                    "POSTED",
                    "SUCCESS",
                ]
            )
        )
    )

    return Decimal(
        str(total or ZERO)
    )
