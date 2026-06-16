from decimal import Decimal

import pytest

from app.domain.money import CurrencyMismatch, InvalidMoney, Money


def test_rejects_float_amount() -> None:
    with pytest.raises(InvalidMoney):
        Money(10.5, "EUR")  # type: ignore[arg-type]


def test_rejects_bool_amount() -> None:
    # bool is an int subclass; it must not masquerade as an amount.
    with pytest.raises(InvalidMoney):
        Money(True, "EUR")  # type: ignore[arg-type]


@pytest.mark.parametrize("bad", ["eur", "EU", "EURO", "E1R", "", "123"])
def test_rejects_bad_currency(bad: str) -> None:
    with pytest.raises(InvalidMoney):
        Money(100, bad)


def test_add_same_currency() -> None:
    assert Money(100, "EUR").add(Money(50, "EUR")) == Money(150, "EUR")


def test_subtract_same_currency() -> None:
    assert Money(100, "EUR").subtract(Money(30, "EUR")) == Money(70, "EUR")


def test_add_cross_currency_raises() -> None:
    with pytest.raises(CurrencyMismatch):
        Money(100, "EUR").add(Money(100, "USD"))


def test_subtract_cross_currency_raises() -> None:
    with pytest.raises(CurrencyMismatch):
        Money(100, "EUR").subtract(Money(100, "HUF"))


def test_minor_to_major_two_decimal() -> None:
    assert Money(1234, "EUR").to_major() == Decimal("12.34")


def test_minor_to_major_zero_decimal() -> None:
    # HUF has no minor unit: minor == major.
    assert Money(1234, "HUF").to_major() == Decimal("1234")


def test_minor_to_major_three_decimal() -> None:
    assert Money(1234, "KWD").to_major() == Decimal("1.234")


@pytest.mark.parametrize(
    ("major", "currency", "expected_minor"),
    [
        (Decimal("12.34"), "EUR", 1234),
        ("0.005", "EUR", 0),  # banker's rounding: half to even -> 0
        ("0.015", "EUR", 2),  # half to even -> 2
        (Decimal("1234"), "HUF", 1234),
        ("1.234", "KWD", 1234),
        (100, "EUR", 10000),
    ],
)
def test_from_major_roundtrip(
    major: Decimal | str | int, currency: str, expected_minor: int
) -> None:
    assert Money.from_major(major, currency) == Money(expected_minor, currency)


def test_from_major_rejects_float() -> None:
    with pytest.raises(InvalidMoney):
        Money.from_major(12.34, "EUR")  # type: ignore[arg-type]


def test_equality_and_hash() -> None:
    assert Money(100, "EUR") == Money(100, "EUR")
    assert Money(100, "EUR") != Money(100, "USD")
    assert Money(100, "EUR") != Money(101, "EUR")
    assert hash(Money(100, "EUR")) == hash(Money(100, "EUR"))
    assert len({Money(100, "EUR"), Money(100, "EUR")}) == 1


def test_immutable_slots() -> None:
    m = Money(100, "EUR")
    with pytest.raises(AttributeError):
        m.amount_minor = 200  # type: ignore[misc]
