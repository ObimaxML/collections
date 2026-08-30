from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import CollectionCase, Customer, MunicipalAccount, Property


ACTIVE_STATUSES = [
    "NEW",
    "VALIDATED",
    "CONTACT_ATTEMPTED",
    "ENGAGED",
    "PROMISE_TO_PAY",
    "ARRANGEMENT",
    "PAYING",
    "BROKEN_PROMISE",
    "ESCALATED",
    "DISPUTED",
]


def get_case_worklist(
    db: Session,
    *,
    status: str | None = None,
    assigned_to: str | None = None,
    limit: int = 100,
    offset: int = 0,
):
    """
    Return collection cases ordered by operational priority.

    Highest priority:
      1. Case priority
      2. Arrears
      3. Days in arrears
    """

    stmt = (
        select(
            CollectionCase,
            MunicipalAccount,
            Customer,
            Property,
        )
        .join(
            MunicipalAccount,
            CollectionCase.account_id
            == MunicipalAccount.id,
        )
        .outerjoin(
            Customer,
            MunicipalAccount.customer_id
            == Customer.id,
        )
        .outerjoin(
            Property,
            MunicipalAccount.property_id
            == Property.id,
        )
        .where(
            CollectionCase.status.in_(
                ACTIVE_STATUSES
            )
        )
    )

    if status:
        stmt = stmt.where(
            CollectionCase.status == status
        )

    if assigned_to:
        stmt = stmt.where(
            CollectionCase.assigned_to
            == assigned_to
        )

    stmt = (
        stmt
        .order_by(
            CollectionCase.priority.desc(),
            MunicipalAccount.arrears.desc(),
            MunicipalAccount.days_in_arrears.desc(),
            CollectionCase.opened_at.asc(),
        )
        .offset(offset)
        .limit(limit)
    )

    rows = db.execute(stmt).all()

    results = []

    for case, account, customer, property_ in rows:
        results.append(
            {
                "case_id": case.id,
                "account_id": account.id,
                "account_number": account.account_number,
                "case_status": case.status,
                "priority": case.priority,
                "strategy_code": case.strategy_code,
                "assigned_to": case.assigned_to,
                "opened_at": case.opened_at,
                "closed_at": case.closed_at,

                "customer": {
                    "id": customer.id if customer else None,
                    "first_name": (
                        customer.first_name
                        if customer
                        else None
                    ),
                    "last_name": (
                        customer.last_name
                        if customer
                        else None
                    ),
                    "mobile": (
                        customer.mobile
                        if customer
                        else None
                    ),
                    "email": (
                        customer.email
                        if customer
                        else None
                    ),
                },

                "property": {
                    "id": (
                        property_.id
                        if property_
                        else None
                    ),
                    "reference": (
                        property_.property_reference
                        if property_
                        else None
                    ),
                    "address": (
                        property_.address
                        if property_
                        else None
                    ),
                },

                "financial": {
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
            }
        )

    return results
