from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import CollectionCase, MunicipalAccount


def calculate_priority(account: MunicipalAccount) -> int:
    """
    Calculate a collection priority score from 1-100.

    Higher score = higher collection priority.
    """

    score = 0

    # Arrears value
    if account.arrears >= 100000:
        score += 40
    elif account.arrears >= 50000:
        score += 30
    elif account.arrears >= 20000:
        score += 20
    elif account.arrears >= 5000:
        score += 10
    elif account.arrears > 0:
        score += 5

    # Days in arrears
    if account.days_in_arrears >= 180:
        score += 30
    elif account.days_in_arrears >= 90:
        score += 20
    elif account.days_in_arrears >= 60:
        score += 15
    elif account.days_in_arrears >= 30:
        score += 10
    elif account.days_in_arrears > 0:
        score += 5

    # Account balance
    if account.balance >= 100000:
        score += 20
    elif account.balance >= 50000:
        score += 15
    elif account.balance >= 20000:
        score += 10
    elif account.balance > 0:
        score += 5

    return min(score, 100)


def get_work_queue(
    db: Session,
    tenant_id=None,
    limit: int = 100,
):
    query = (
        select(
            CollectionCase,
            MunicipalAccount,
        )
        .join(
            MunicipalAccount,
            CollectionCase.account_id
            == MunicipalAccount.id,
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

    for case, account in results:
        queue.append(
            {
                "case_id": str(case.id),
                "account_id": str(account.id),
                "account_number": account.account_number,
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


def calculate_priority_score(case: CollectionCase, account: MunicipalAccount, promise=None) -> int:
    return calculate_priority(account)


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

