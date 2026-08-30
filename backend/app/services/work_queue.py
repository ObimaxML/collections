from app.models import CollectionCase, MunicipalAccount, Promise


def calculate_priority_score(
    case: CollectionCase,
    account: MunicipalAccount,
    promise: Promise | None = None,
) -> int:
    score = 0

    # -----------------------------------------------------
    # Case priority
    # -----------------------------------------------------
    score += (case.priority or 0) * 10

    # -----------------------------------------------------
    # Days in arrears
    # -----------------------------------------------------
    if account.days_in_arrears >= 180:
        score += 40
    elif account.days_in_arrears >= 120:
        score += 30
    elif account.days_in_arrears >= 90:
        score += 20
    elif account.days_in_arrears >= 60:
        score += 10

    # -----------------------------------------------------
    # Arrears value
    # -----------------------------------------------------
    if account.arrears >= 100000:
        score += 40
    elif account.arrears >= 50000:
        score += 30
    elif account.arrears >= 20000:
        score += 20
    elif account.arrears >= 10000:
        score += 10

    # -----------------------------------------------------
    # Broken promise
    # -----------------------------------------------------
    if case.status == "BROKEN_PROMISE":
        score += 50

    # -----------------------------------------------------
    # Active PTP
    # -----------------------------------------------------
    if promise and promise.status == "PENDING":
        score += 20

    # -----------------------------------------------------
    # Escalated
    # -----------------------------------------------------
    if case.status == "ESCALATED":
        score += 50

    return score


def determine_next_action(
    case: CollectionCase,
    promise: Promise | None = None,
) -> str:
    if case.status == "NEW":
        return "VALIDATE_ACCOUNT"

    if case.status == "VALIDATED":
        return "CONTACT_CUSTOMER"

    if case.status == "CONTACT_ATTEMPTED":
        return "FOLLOW_UP_CONTACT"

    if case.status == "ENGAGED":
        return "SECURE_PROMISE"

    if case.status == "PROMISE_TO_PAY":
        if promise and promise.status == "PENDING":
            return "MONITOR_PROMISE"
        return "FOLLOW_UP_PROMISE"

    if case.status == "PAYMENT_ARRANGEMENT":
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
