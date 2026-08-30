from decimal import Decimal, ROUND_HALF_UP

VALID_FREQUENCIES = {
    "WEEKLY",
    "FORTNIGHTLY",
    "MONTHLY",
}

VALID_PLAN_STATUSES = {
    "ACTIVE",
    "COMPLETED",
    "BROKEN",
    "CANCELLED",
}

VALID_PROMISE_STATUSES = {
    "PENDING",
    "KEPT",
    "BROKEN",
    "CANCELLED",
}


def calculate_remaining_balance(
    arrears: Decimal,
    deposit_amount: Decimal,
) -> Decimal:
    remaining = arrears - deposit_amount
    if remaining < Decimal("0.00"):
        remaining = Decimal("0.00")
    return remaining.quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )


def calculate_installment_count(
    remaining_balance: Decimal,
    installment_amount: Decimal,
) -> int:
    if installment_amount <= 0:
        raise ValueError(
            "Installment amount must be greater than zero."
        )

    if remaining_balance <= 0:
        return 0

    count = (
        remaining_balance / installment_amount
    ).quantize(
        Decimal("1"),
        rounding=ROUND_HALF_UP,
    )

    return max(1, int(count))


def validate_frequency(
    frequency: str,
) -> str:
    frequency = frequency.upper()
    if frequency not in VALID_FREQUENCIES:
        raise ValueError(
            f"Invalid frequency: {frequency}"
        )
    return frequency


def validate_promise_status(
    status: str,
) -> str:
    status = status.upper()
    if status not in VALID_PROMISE_STATUSES:
        raise ValueError(
            f"Invalid promise status: {status}"
        )
    return status


def validate_plan_status(
    status: str,
) -> str:
    status = status.upper()
    if status not in VALID_PLAN_STATUSES:
        raise ValueError(
            f"Invalid payment plan status: {status}"
        )
    return status
