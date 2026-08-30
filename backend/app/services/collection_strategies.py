from dataclasses import dataclass


@dataclass(frozen=True)
class CollectionStrategy:
    code: str
    name: str
    description: str
    recommended_actions: tuple[str, ...]
    follow_up_days: int
    escalation_days: int


STRATEGIES: dict[str, CollectionStrategy] = {
    "INTENSIVE_RECOVERY": CollectionStrategy(
        code="INTENSIVE_RECOVERY",
        name="Intensive Recovery",
        description=(
            "High-risk account requiring immediate and "
            "persistent collection activity."
        ),
        recommended_actions=(
            "CALL_CUSTOMER",
            "SEND_PAYMENT_REMINDER",
            "REQUEST_PAYMENT_COMMITMENT",
            "ESCALATE_IF_NO_RESPONSE",
        ),
        follow_up_days=1,
        escalation_days=3,
    ),

    "ACTIVE_RECOVERY": CollectionStrategy(
        code="ACTIVE_RECOVERY",
        name="Active Recovery",
        description=(
            "High-value or materially overdue account "
            "requiring structured collection activity."
        ),
        recommended_actions=(
            "CALL_CUSTOMER",
            "SEND_PAYMENT_REMINDER",
            "REQUEST_PAYMENT_COMMITMENT",
        ),
        follow_up_days=3,
        escalation_days=7,
    ),

    "STANDARD_RECOVERY": CollectionStrategy(
        code="STANDARD_RECOVERY",
        name="Standard Recovery",
        description=(
            "Account requiring normal collection "
            "follow-up."
        ),
        recommended_actions=(
            "SEND_PAYMENT_REMINDER",
            "CALL_CUSTOMER",
            "REQUEST_PAYMENT_COMMITMENT",
        ),
        follow_up_days=7,
        escalation_days=14,
    ),

    "LIGHT_TOUCH": CollectionStrategy(
        code="LIGHT_TOUCH",
        name="Light Touch",
        description=(
            "Lower-risk account suitable for lower-cost "
            "collection communication."
        ),
        recommended_actions=(
            "SEND_PAYMENT_REMINDER",
            "MONITOR_RESPONSE",
        ),
        follow_up_days=14,
        escalation_days=30,
    ),

    "MONITOR": CollectionStrategy(
        code="MONITOR",
        name="Monitor",
        description=(
            "Account currently presenting limited "
            "collection risk."
        ),
        recommended_actions=(
            "MONITOR_ACCOUNT",
        ),
        follow_up_days=30,
        escalation_days=60,
    ),
}


def get_strategy(
    strategy_code: str,
) -> CollectionStrategy | None:

    return STRATEGIES.get(
        strategy_code.upper()
    )
