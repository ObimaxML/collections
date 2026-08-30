from decimal import Decimal, ROUND_HALF_UP


def money(value: Decimal) -> Decimal:
    return value.quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )


def apply_payment_to_account(
    balance: Decimal,
    arrears: Decimal,
    payment_amount: Decimal,
):
    if payment_amount <= 0:
        raise ValueError(
            "Payment amount must be greater than zero."
        )

    payment_amount = money(payment_amount)

    new_balance = max(
        Decimal("0.00"),
        balance - payment_amount,
    )

    new_arrears = max(
        Decimal("0.00"),
        arrears - payment_amount,
    )

    return (
        money(new_balance),
        money(new_arrears),
    )


def payment_fully_clears_arrears(
    arrears: Decimal,
) -> bool:
    return arrears <= Decimal("0.00")
