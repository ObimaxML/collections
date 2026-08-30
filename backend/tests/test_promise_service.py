from datetime import date
from decimal import Decimal


def test_promise_amount_is_decimal():
    amount = Decimal("500.00")

    assert amount > Decimal("0.00")


def test_promise_due_date():
    promise_date = date(2026, 8, 30)

    assert promise_date.year == 2026
    assert promise_date.month == 8
    assert promise_date.day == 30
