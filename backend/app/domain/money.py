"""Money value object — backend mirror of ``packages/core/src/money.ts``.

Amounts are stored as integer **minor units** (cents/fillér) plus an ISO-4217
currency code. All arithmetic happens on integers via :class:`~decimal.Decimal`
— never ``float`` — so there is no representation drift between the TypeScript
``core`` package and the Python domain (drift is pinned by a shared fixture
set, plan §4.1).
"""

from __future__ import annotations

import re
from decimal import ROUND_HALF_EVEN, Decimal
from typing import Final

_CURRENCY_RE: Final = re.compile(r"^[A-Z]{3}$")

# Zero-decimal and three-decimal currencies; everything else has two decimals.
# Mirrors the sets in money.ts so ``from_major``/``to_major`` agree cross-stack.
_ZERO_DECIMAL: Final[frozenset[str]] = frozenset(
    {
        "JPY", "KRW", "HUF", "ISK", "CLP", "VND", "XOF", "XAF", "XPF",
        "BIF", "DJF", "GNF", "KMF", "PYG", "RWF", "UGX", "VUV", "XAG",
    }
)
_THREE_DECIMAL: Final[frozenset[str]] = frozenset(
    {"BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND"}
)


class MoneyError(Exception):
    """Base class for all Money-related errors."""


class InvalidMoney(MoneyError):
    """Raised when an amount or currency code is not a valid value."""


class CurrencyMismatch(MoneyError):
    """Raised when two Money values of different currencies are combined."""

    def __init__(self, a: str, b: str) -> None:
        super().__init__(f"Currency mismatch: {a} vs {b}")
        self.a = a
        self.b = b


def _minor_per_major(currency: str) -> int:
    if currency in _ZERO_DECIMAL:
        return 1
    if currency in _THREE_DECIMAL:
        return 1000
    return 100


def _validate_currency(currency: str) -> None:
    if not isinstance(currency, str) or not _CURRENCY_RE.match(currency):
        raise InvalidMoney(f"Invalid ISO-4217 currency code: {currency!r}")


class Money:
    """Immutable amount in integer minor units with an ISO-4217 currency.

    The constructor rejects ``float`` and non-integer amounts outright: callers
    must commit to minor units up front, exactly like the TS value object.
    """

    __slots__ = ("_amount_minor", "_currency")

    def __init__(self, amount_minor: int, currency: str) -> None:
        # ``bool`` is an ``int`` subclass — reject it explicitly so True/False
        # cannot masquerade as an amount.
        if isinstance(amount_minor, bool) or not isinstance(amount_minor, int):
            raise InvalidMoney(
                f"Amount must be an integer number of minor units, got {amount_minor!r}"
            )
        _validate_currency(currency)
        self._amount_minor = amount_minor
        self._currency = currency

    @property
    def amount_minor(self) -> int:
        """Raw integer minor units."""
        return self._amount_minor

    @property
    def currency(self) -> str:
        """ISO-4217 currency code (3 uppercase letters)."""
        return self._currency

    def _assert_same_currency(self, other: Money) -> None:
        if self._currency != other._currency:
            raise CurrencyMismatch(self._currency, other._currency)

    def add(self, other: Money) -> Money:
        """Add another Money of the same currency."""
        self._assert_same_currency(other)
        return Money(self._amount_minor + other._amount_minor, self._currency)

    def subtract(self, other: Money) -> Money:
        """Subtract another Money of the same currency."""
        self._assert_same_currency(other)
        return Money(self._amount_minor - other._amount_minor, self._currency)

    def to_major(self) -> Decimal:
        """Major-unit representation as an exact :class:`Decimal` (display only)."""
        return Decimal(self._amount_minor) / Decimal(_minor_per_major(self._currency))

    @classmethod
    def from_major(cls, major: Decimal | int | str, currency: str) -> Money:
        """Build Money from a major-unit amount.

        Accepts :class:`Decimal`, ``int`` or ``str`` — **never** ``float``,
        which carries representation error. The major amount is converted to
        minor units with banker's rounding (round half to even), matching the
        TS ``bankersRound``.
        """
        _validate_currency(currency)
        if isinstance(major, float):
            raise InvalidMoney(
                "from_major rejects float (lossy); pass Decimal, int or str"
            )
        try:
            major_dec = Decimal(major)
        except (ArithmeticError, ValueError, TypeError) as exc:
            raise InvalidMoney(f"Invalid major amount: {major!r}") from exc
        if not major_dec.is_finite():
            raise InvalidMoney(f"Major amount must be finite, got {major!r}")
        scale = Decimal(_minor_per_major(currency))
        minor = (major_dec * scale).quantize(Decimal(1), rounding=ROUND_HALF_EVEN)
        return cls(int(minor), currency)

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Money):
            return NotImplemented
        return self._amount_minor == other._amount_minor and self._currency == other._currency

    def __hash__(self) -> int:
        return hash((self._amount_minor, self._currency))

    def __repr__(self) -> str:
        return f"Money({self._amount_minor}, {self._currency!r})"

    def __str__(self) -> str:
        return f"{self._amount_minor} {self._currency}"
