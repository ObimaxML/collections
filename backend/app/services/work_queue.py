from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import CollectionCase, MunicipalAccount


def calculate_priority(account: MunicipalAccount, has_mobile: bool = False) -> int:
    """
    Calculate a collection priority score from 1-100.

    Higher score = higher collection priority.
    Heavily weighs highest arrears value and presence of reachable mobile contact.
    """

    score = 0

    # Mobile Contact Boost (reachable debtor phone = immediate actionable collector priority)
    if has_mobile:
        score += 30

    # Arrears value (highest recovery yields)
    if account.arrears >= 500000:
        score += 45
    elif account.arrears >= 100000:
        score += 35
    elif account.arrears >= 50000:
        score += 25
    elif account.arrears >= 20000:
        score += 18
    elif account.arrears >= 5000:
        score += 10
    elif account.arrears > 0:
        score += 5

    # Days in arrears (DPD aging)
    if account.days_in_arrears >= 180:
        score += 15
    elif account.days_in_arrears >= 90:
        score += 12
    elif account.days_in_arrears >= 60:
        score += 8
    elif account.days_in_arrears >= 30:
        score += 5
    elif account.days_in_arrears > 0:
        score += 2

    # Account balance
    if account.balance >= 100000:
        score += 10
    elif account.balance >= 50000:
        score += 7
    elif account.balance > 0:
        score += 3

    return min(score, 100)


def get_work_queue(
    db: Session,
    tenant_id=None,
    limit: int = 100,
):
    from app.models import Customer

    query = (
        select(
            CollectionCase,
            MunicipalAccount,
            Customer,
        )
        .join(
            MunicipalAccount,
            CollectionCase.account_id == MunicipalAccount.id,
        )
        .outerjoin(
            Customer,
            MunicipalAccount.customer_id == Customer.id,
        )
        .where(
            CollectionCase.status.notin_(
                ["PAID", "CLOSED"]
            )
        )
        .order_by(
            CollectionCase.priority.desc(),
            MunicipalAccount.arrears.desc(),
        )
        .limit(limit)
    )

    if tenant_id:
        query = query.where(
            CollectionCase.tenant_id == tenant_id
        )

    results = db.execute(query).all()

    queue = []

    for case, account, customer in results:
        cust_name = None
        cust_mobile = None
        if customer:
            name_parts = [p for p in [customer.first_name, customer.last_name] if p]
            cust_name = " ".join(name_parts) if name_parts else (customer.first_name or customer.last_name)
            cust_mobile = customer.mobile

        queue.append(
            {
                "case_id": str(case.id),
                "account_id": str(account.id),
                "account_number": account.account_number,
                "customer_name": cust_name,
                "mobile": cust_mobile,
                "status": case.status,
                "priority": case.priority,
                "calculated_priority": calculate_priority(
                    account
                ),
                "balance": float(account.balance),
                "arrears": float(account.arrears),
                "days_in_arrears": account.days_in_arrears,
                "assigned_to": case.assigned_to,
                "strategy_code": case.strategy_code,
                "opened_at": case.opened_at,
            }
        )

    return queue


def refresh_case_priorities(
    db: Session,
    tenant_id=None,
):
    query = select(
        CollectionCase,
        MunicipalAccount,
    ).join(
        MunicipalAccount,
        CollectionCase.account_id
        == MunicipalAccount.id,
    )

    if tenant_id:
        query = query.where(
            CollectionCase.tenant_id == tenant_id
        )

    results = db.execute(query).all()

    updated = 0

    for case, account in results:
        new_priority = calculate_priority(account)

        if case.priority != new_priority:
            case.priority = new_priority
            updated += 1

    db.commit()

    return updated


def calculate_priority_score(case: CollectionCase, account: MunicipalAccount, promise=None, has_mobile: bool = False) -> int:
    return calculate_priority(account, has_mobile=has_mobile)


def determine_next_action(case: CollectionCase, promise=None) -> str:
    if case.status == "NEW":
        return "VALIDATE_ACCOUNT"
    if case.status == "VALIDATED":
        return "CONTACT_CUSTOMER"
    if case.status == "CONTACT_ATTEMPTED":
        return "FOLLOW_UP_CONTACT"
    if case.status == "ENGAGED":
        return "SECURE_PROMISE"
    if case.status == "PROMISE_TO_PAY":
        return "MONITOR_PROMISE"
    if case.status == "ARRANGEMENT":
        return "MONITOR_PAYMENT_PLAN"
    if case.status == "PAYING":
        return "MONITOR_PAYMENTS"
    if case.status == "BROKEN_PROMISE":
        return "RECONTACT_CUSTOMER"
    if case.status == "ESCALATED":
        return "ESCALATION_REVIEW"
    if case.status == "DISPUTED":
        return "RESOLVE_DISPUTE"
    if case.status == "PAID":
        return "CLOSE_CASE"
    if case.status == "CLOSED":
        return "NO_ACTION"
    return "REVIEW_CASE"

