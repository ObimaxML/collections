from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.financial import (
    get_account_financials,
    get_portfolio_financials,
)


router = APIRouter(
    prefix="/financial",
    tags=["Financial"],
)


@router.get("/accounts/{account_id}")
def account_financials(
    account_id: UUID,
    db: Session = Depends(get_db),
):
    try:
        financials = get_account_financials(
            db=db,
            account_id=account_id,
        )

        return {
            "success": True,
            "financials": financials,
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        ) from exc


@router.get("/portfolio")
def portfolio_financials(
    db: Session = Depends(get_db),
):
    financials = get_portfolio_financials(
        db=db,
    )

    return {
        "success": True,
        "financials": financials,
    }
