from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    CollectionCase,
    MunicipalAccount,
    Payment,
    Promise,
)


ZERO = Decimal("0.00")


def get_account_financials(
    db: Session,
    *,
    account_id: UUID,
):
    account = db.get(
        MunicipalAccount,
        account_id,
    )

    if not account:
        raise ValueError(
            "Municipal account not found."
        )

    total_payments = db.scalar(
        select(
            func.coalesce(
                func.sum(Payment.amount),
                0,
            )
        )
        .where(
            Payment.account_id == account.id,
            Payment.reconciliation_status
            == "RECONCILED",
        )
    )

    total_payments = Decimal(
        str(total_payments or ZERO)
    )

    arrears = Decimal(
        str(account.arrears or ZERO)
    )

    balance = Decimal(
        str(account.balance or ZERO)
    )

    outstanding = max(
        balance - total_payments,
        ZERO,
    )

    recovery_rate = (
        (
            total_payments / balance
        ) * Decimal("100")
        if balance > ZERO
        else ZERO
    )

    pending_promises = db.scalar(
        select(
            func.coalesce(
                func.sum(Promise.amount),
                0,
            )
        )
        .join(
            CollectionCase,
            Promise.case_id == CollectionCase.id,
        )
        .where(
            CollectionCase.account_id == account.id,
            Promise.status == "PENDING",
        )
    )

    pending_promises = Decimal(
        str(pending_promises or ZERO)
    )

    return {
        "account_id": account.id,
        "account_number": account.account_number,
        "balance": balance,
        "arrears": arrears,
        "total_payments": total_payments,
        "outstanding": outstanding,
        "recovery_rate": recovery_rate,
        "pending_promises": pending_promises,
    }


def get_portfolio_financials(
    db: Session,
):
    total_balance = db.scalar(
        select(
            func.coalesce(
                func.sum(
                    MunicipalAccount.balance
                ),
                0,
            )
        )
    )

    total_arrears = db.scalar(
        select(
            func.coalesce(
                func.sum(
                    MunicipalAccount.arrears
                ),
                0,
            )
        )
    )

    total_payments = db.scalar(
        select(
            func.coalesce(
                func.sum(Payment.amount),
                0,
            )
        )
        .where(
            Payment.reconciliation_status
            == "RECONCILED"
        )
    )

    total_balance = Decimal(
        str(total_balance or ZERO)
    )

    total_arrears = Decimal(
        str(total_arrears or ZERO)
    )

    total_payments = Decimal(
        str(total_payments or ZERO)
    )

    outstanding = max(
        total_balance - total_payments,
        ZERO,
    )

    recovery_rate = (
        (
            total_payments
            / total_balance
        )
        * Decimal("100")
        if total_balance > ZERO
        else ZERO
    )

    return {
        "debt_book": total_balance,
        "arrears": total_arrears,
        "recovered": total_payments,
        "outstanding": outstanding,
        "recovery_rate": recovery_rate,
    }
