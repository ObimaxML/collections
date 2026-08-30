from dataclasses import dataclass
from decimal import Decimal


@dataclass
class CollectionAssessment:
    score: int
    priority: int
    priority_label: str
    strategy_code: str
    reasons: list[str]


def assess_collection_case(
    *,
    arrears: Decimal,
    days_in_arrears: int,
    account_status: str,
    broken_promises: int = 0,
    payment_count: int = 0,
) -> CollectionAssessment:

    score = 0
    reasons: list[str] = []

    # ---------------------------------------------------------
    # Arrears amount
    # ---------------------------------------------------------

    if arrears >= Decimal("100000"):
        score += 40
        reasons.append("Arrears exceed R100,000")

    elif arrears >= Decimal("50000"):
        score += 30
        reasons.append("Arrears exceed R50,000")

    elif arrears >= Decimal("20000"):
        score += 20
        reasons.append("Arrears exceed R20,000")

    elif arrears >= Decimal("10000"):
        score += 10
        reasons.append("Arrears exceed R10,000")

    # ---------------------------------------------------------
    # Days in arrears
    # ---------------------------------------------------------

    if days_in_arrears >= 180:
        score += 30
        reasons.append("Account is more than 180 days in arrears")

    elif days_in_arrears >= 120:
        score += 25
        reasons.append("Account is more than 120 days in arrears")

    elif days_in_arrears >= 90:
        score += 20
        reasons.append("Account is more than 90 days in arrears")

    elif days_in_arrears >= 60:
        score += 10
        reasons.append("Account is more than 60 days in arrears")

    elif days_in_arrears >= 30:
        score += 5
        reasons.append("Account is more than 30 days in arrears")

    # ---------------------------------------------------------
    # Account status
    # ---------------------------------------------------------

    normalized_status = (
        account_status or ""
    ).upper()

    if normalized_status in {
        "DEFAULT",
        "DELINQUENT",
        "DISCONNECTED",
    }:
        score += 15
        reasons.append(
            f"Account status is {normalized_status}"
        )

    # ---------------------------------------------------------
    # Broken promises
    # ---------------------------------------------------------

    if broken_promises >= 3:
        score += 15
        reasons.append(
            "Three or more broken promises"
        )

    elif broken_promises >= 1:
        score += 10
        reasons.append(
            "Previous promise to pay was broken"
        )

    # ---------------------------------------------------------
    # Payment history
    # ---------------------------------------------------------

    if payment_count == 0:
        score += 10
        reasons.append(
            "No recorded payment history"
        )

    # ---------------------------------------------------------
    # Cap score
    # ---------------------------------------------------------

    score = min(score, 100)

    # ---------------------------------------------------------
    # Priority and strategy
    # ---------------------------------------------------------

    if score >= 80:
        priority = 1
        priority_label = "CRITICAL"
        strategy_code = "INTENSIVE_RECOVERY"

    elif score >= 60:
        priority = 2
        priority_label = "HIGH"
        strategy_code = "ACTIVE_RECOVERY"

    elif score >= 40:
        priority = 3
        priority_label = "MEDIUM"
        strategy_code = "STANDARD_RECOVERY"

    elif score >= 20:
        priority = 4
        priority_label = "LOW"
        strategy_code = "LIGHT_TOUCH"

    else:
        priority = 5
        priority_label = "MONITOR"
        strategy_code = "MONITOR"

    if not reasons:
        reasons.append(
            "No significant collection risk indicators"
        )

    return CollectionAssessment(
        score=score,
        priority=priority,
        priority_label=priority_label,
        strategy_code=strategy_code,
        reasons=reasons,
    )
