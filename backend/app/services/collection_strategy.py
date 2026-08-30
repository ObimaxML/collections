from decimal import Decimal


def calculate_priority(
    arrears: Decimal,
    days_in_arrears: int,
    balance: Decimal,
) -> tuple[int, str, str, list[str]]:
    """
    Calculate a deterministic collection priority.

    Returns:
        priority_score
        risk_band
        strategy_code
        reasons
    """

    score = 0
    reasons: list[str] = []

    # ---------------------------------------------------------
    # Arrears value
    # ---------------------------------------------------------

    if arrears >= Decimal("100000"):
        score += 40
        reasons.append("Very high arrears")

    elif arrears >= Decimal("50000"):
        score += 30
        reasons.append("High arrears")

    elif arrears >= Decimal("20000"):
        score += 20
        reasons.append("Material arrears")

    elif arrears > Decimal("0"):
        score += 10
        reasons.append("Account has arrears")

    # ---------------------------------------------------------
    # Days in arrears
    # ---------------------------------------------------------

    if days_in_arrears >= 180:
        score += 30
        reasons.append("More than 180 days in arrears")

    elif days_in_arrears >= 90:
        score += 20
        reasons.append("More than 90 days in arrears")

    elif days_in_arrears >= 60:
        score += 15
        reasons.append("More than 60 days in arrears")

    elif days_in_arrears >= 30:
        score += 10
        reasons.append("More than 30 days in arrears")

    elif days_in_arrears > 0:
        score += 5
        reasons.append("Recently entered arrears")

    # ---------------------------------------------------------
    # Overall balance
    # ---------------------------------------------------------

    if balance >= Decimal("200000"):
        score += 20
        reasons.append("Very high account balance")

    elif balance >= Decimal("100000"):
        score += 15
        reasons.append("High account balance")

    elif balance >= Decimal("50000"):
        score += 10
        reasons.append("Elevated account balance")

    # ---------------------------------------------------------
    # Risk band
    # ---------------------------------------------------------

    if score >= 70:
        risk_band = "CRITICAL"

    elif score >= 50:
        risk_band = "HIGH"

    elif score >= 30:
        risk_band = "MEDIUM"

    else:
        risk_band = "LOW"

    # ---------------------------------------------------------
    # Collection strategy
    # ---------------------------------------------------------

    if risk_band == "CRITICAL":
        strategy_code = "ESCALATED_COLLECTION"

    elif risk_band == "HIGH":
        strategy_code = "ACTIVE_COLLECTION"

    elif risk_band == "MEDIUM":
        strategy_code = "EARLY_INTERVENTION"

    else:
        strategy_code = "MONITOR"

    return score, risk_band, strategy_code, reasons


def recommended_action(strategy_code: str) -> str:

    actions = {
        "ESCALATED_COLLECTION": (
            "Immediate collector intervention and escalation"
        ),
        "ACTIVE_COLLECTION": (
            "Contact customer and negotiate payment arrangement"
        ),
        "EARLY_INTERVENTION": (
            "Send reminder and attempt customer contact"
        ),
        "MONITOR": (
            "Monitor account and issue routine reminder"
        ),
    }

    return actions.get(
        strategy_code,
        "Review account",
    )
