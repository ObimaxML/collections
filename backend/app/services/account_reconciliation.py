from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import FinancialTransaction, MunicipalAccount
from app.services.ledger import (
    get_account_ledger_balance,
)

RECONCILIATION_TOLERANCE = Decimal("0.01")


def reconcile_account(
    db: Session,
    *,
    account_id: UUID,
):
    account = db.scalar(
        select(MunicipalAccount)
        .where(
            MunicipalAccount.id == account_id
        )
    )

    if account is None:
        raise ValueError(
            "Municipal account not found."
        )

    ledger_balance = get_account_ledger_balance(
        db=db,
        account_id=account.id,
    )

    stored_balance = (
        account.balance
        if account.balance is not None
        else Decimal("0.00")
    )

    difference = (
        ledger_balance - stored_balance
    )

    opening_balance_exists = db.scalar(
        select(FinancialTransaction.id)
        .where(
            FinancialTransaction.account_id
            == account.id,
            FinancialTransaction.transaction_type
            == "OPENING_BALANCE",
        )
        .limit(1)
    ) is not None

    if not opening_balance_exists:
        status = "NO_LEDGER"
    elif abs(difference) <= RECONCILIATION_TOLERANCE:
        status = "MATCH"
    else:
        status = "MISMATCH"

    return {
        "account_id": account.id,
        "account_number": account.account_number,
        "stored_balance": stored_balance,
        "ledger_balance": ledger_balance,
        "difference": difference,
        "status": status,
        "opening_balance_exists": opening_balance_exists,
        "ledger_coverage": (
            "OPENING_BALANCE"
            if opening_balance_exists
            else "NONE"
        ),
    }


def reconcile_all_accounts(
    db: Session,
):
    accounts = list(
        db.scalars(
            select(MunicipalAccount)
            .order_by(
                MunicipalAccount.account_number
            )
        ).all()
    )

    results = []

    for account in accounts:
        results.append(
            reconcile_account(
                db=db,
                account_id=account.id,
            )
        )

    results.sort(
        key=lambda result: abs(
            result["difference"]
        ),
        reverse=True,
    )

    return results
