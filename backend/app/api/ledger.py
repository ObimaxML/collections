from datetime import date
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.account_ledger import (
    get_account_ledger,
)
from app.services.ledger import (
    create_transaction,
    get_account_ledger_balance,
    get_account_transactions,
)
from app.services.account_reconciliation import (
    reconcile_account,
    reconcile_all_accounts,
)
from app.services.ledger_backfill import (
    backfill_reconciled_payments,
)
from app.schemas.ledger_import import (
    LedgerTransactionImport,
)
from app.services.ledger_import import (
    import_ledger_transaction,
)
from app.services.opening_balance import (
    backfill_opening_balances,
)


router = APIRouter(
    prefix="/ledger",
    tags=["Financial Ledger"],
)


@router.post(
    "/transactions/import",
)
def import_transaction(
    payload: LedgerTransactionImport,
    tenant_id: UUID,
    db: Session = Depends(get_db),
):
    try:
        result = import_ledger_transaction(
            db=db,
            tenant_id=tenant_id,
            payload=payload,
        )

        return {
            "success": True,
            **result,
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc


@router.post(
    "/backfill/opening-balances"
)
def backfill_opening_balance(
    actor: str = "opening-balance-backfill",
    db: Session = Depends(get_db),
):
    result = backfill_opening_balances(
        db=db,
        actor=actor,
    )

    return {
        "success": True,
        **result,
    }


@router.post("/backfill/reconciled-payments")
def backfill_payments(
    actor: str = "ledger-backfill",
    db: Session = Depends(get_db),
):
    result = backfill_reconciled_payments(
        db=db,
        actor=actor,
    )

    return {
        "success": True,
        **result,
    }


@router.get("/accounts/{account_id}/summary")
def account_ledger_summary(
    account_id: UUID,
    db: Session = Depends(get_db),
):
    try:
        return get_account_ledger(
            db,
            account_id,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        ) from exc


@router.get("/accounts/{account_id}")
def account_ledger(
    account_id: UUID,
    db: Session = Depends(get_db),
):
    transactions = get_account_transactions(
        db=db,
        account_id=account_id,
    )

    balance = get_account_ledger_balance(
        db=db,
        account_id=account_id,
    )

    return {
        "account_id": str(account_id),
        "balance": balance,
        "transactions": [
            {
                "id": str(transaction.id),
                "transaction_type": (
                    transaction.transaction_type
                ),
                "transaction_date": (
                    transaction.transaction_date
                ),
                "amount": transaction.amount,
                "reference": transaction.reference,
                "description": transaction.description,
                "source_type": transaction.source_type,
                "source_id": (
                    str(transaction.source_id)
                    if transaction.source_id
                    else None
                ),
                "created_at": (
                    transaction.created_at
                ),
                "created_by": (
                    transaction.created_by
                ),
            }
            for transaction in transactions
        ],
    }


@router.post("/accounts/{account_id}/transactions")
def add_transaction(
    account_id: UUID,
    tenant_id: UUID,
    transaction_type: str,
    amount: Decimal,
    transaction_date: date,
    reference: str | None = None,
    description: str | None = None,
    source_type: str | None = None,
    source_id: UUID | None = None,
    created_by: str = "system",
    db: Session = Depends(get_db),
):
    try:
        transaction = create_transaction(
            db=db,
            tenant_id=tenant_id,
            account_id=account_id,
            transaction_type=transaction_type,
            amount=amount,
            transaction_date=transaction_date,
            reference=reference,
            description=description,
            source_type=source_type,
            source_id=source_id,
            created_by=created_by,
        )

        return {
            "success": True,
            "transaction": {
                "id": str(transaction.id),
                "account_id": str(
                    transaction.account_id
                ),
                "transaction_type": (
                    transaction.transaction_type
                ),
                "amount": transaction.amount,
                "transaction_date": (
                    transaction.transaction_date
                ),
            },
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc


@router.get(
    "/accounts/{account_id}/reconciliation"
)
def account_reconciliation(
    account_id: UUID,
    db: Session = Depends(get_db),
):
    try:
        result = reconcile_account(
            db=db,
            account_id=account_id,
        )

        return {
            "success": True,
            **result,
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        ) from exc


@router.get(
    "/reconciliation/summary"
)
def reconciliation_summary(
    db: Session = Depends(get_db),
):
    results = reconcile_all_accounts(
        db=db,
    )

    match_count = sum(
        1
        for result in results
        if result["status"] == "MATCH"
    )

    mismatch_count = sum(
        1
        for result in results
        if result["status"] == "MISMATCH"
    )

    no_ledger_count = sum(
        1
        for result in results
        if result["status"] == "NO_LEDGER"
    )

    total_difference = sum(
        (
            result["difference"]
            for result in results
        ),
        Decimal("0.00"),
    )

    reconcilable_accounts = (
        match_count + mismatch_count
    )

    if reconcilable_accounts == 0:
        reconciliation_rate = Decimal("0.00")
    else:
        reconciliation_rate = (
            Decimal(match_count)
            / Decimal(reconcilable_accounts)
            * Decimal("100")
        )

    return {
        "success": True,
        "total_accounts": len(results),
        "matches": match_count,
        "mismatches": mismatch_count,
        "no_ledger": no_ledger_count,
        "reconciliation_rate": (
            reconciliation_rate.quantize(
                Decimal("0.01")
            )
        ),
        "total_difference": total_difference,
        "accounts": results,
    }
