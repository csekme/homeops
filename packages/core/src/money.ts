/**
 * Money value object.
 *
 * Stores amounts as integer minor units (e.g. cents/fillér) and an ISO-4217
 * currency code. All arithmetic happens on integers — never floats — so there
 * is no representation drift. Multiplication uses banker's rounding (round
 * half to even) when the result lands between two minor units.
 */

const CURRENCY_RE = /^[A-Z]{3}$/;

/** Base class for all Money-related errors. */
export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

/** Thrown when an amount or currency code is not a valid value. */
export class InvalidMoneyError extends MoneyError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidMoneyError";
  }
}

/** Thrown when two Money values of different currencies are combined. */
export class CurrencyMismatchError extends MoneyError {
  constructor(a: string, b: string) {
    super(`Currency mismatch: ${a} vs ${b}`);
    this.name = "CurrencyMismatchError";
  }
}

/**
 * Round a number to the nearest integer using banker's rounding
 * (round half to even). Pure integer/float-edge logic, no storage in float.
 */
export function bankersRound(value: number): number {
  const floor = Math.floor(value);
  const diff = value - floor;
  if (diff < 0.5) return floor;
  if (diff > 0.5) return floor + 1;
  // Exactly halfway: round to the even neighbour.
  return floor % 2 === 0 ? floor : floor + 1;
}

export class Money {
  /** Amount in integer minor units. */
  readonly amount: number;
  /** ISO-4217 currency code (3 uppercase letters). */
  readonly currency: string;

  constructor(minorAmount: number, currency: string) {
    if (typeof minorAmount !== "number" || !Number.isFinite(minorAmount)) {
      throw new InvalidMoneyError(`Amount must be a finite number, got ${minorAmount}`);
    }
    if (!Number.isInteger(minorAmount)) {
      throw new InvalidMoneyError(`Amount must be an integer number of minor units, got ${minorAmount}`);
    }
    if (!Number.isSafeInteger(minorAmount)) {
      throw new InvalidMoneyError(`Amount exceeds safe integer range: ${minorAmount}`);
    }
    if (typeof currency !== "string" || !CURRENCY_RE.test(currency)) {
      throw new InvalidMoneyError(`Invalid ISO-4217 currency code: ${String(currency)}`);
    }
    this.amount = minorAmount;
    this.currency = currency;
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new CurrencyMismatchError(this.currency, other.currency);
    }
  }

  /** Add another Money of the same currency. */
  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount + other.amount, this.currency);
  }

  /** Subtract another Money of the same currency. */
  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount - other.amount, this.currency);
  }

  /**
   * Multiply by an integer or rational factor. The product is rounded to the
   * nearest minor unit using banker's rounding.
   */
  multiply(factor: number): Money {
    if (typeof factor !== "number" || !Number.isFinite(factor)) {
      throw new InvalidMoneyError(`Multiplier must be a finite number, got ${factor}`);
    }
    const product = this.amount * factor;
    const rounded = bankersRound(product);
    if (!Number.isSafeInteger(rounded)) {
      throw new InvalidMoneyError(`Multiplication result exceeds safe integer range: ${rounded}`);
    }
    return new Money(rounded, this.currency);
  }

  /** Raw integer minor units. */
  toMinor(): number {
    return this.amount;
  }

  /**
   * Major-unit representation as a number. NOTE: intended for display only —
   * never re-store this value as the canonical amount.
   */
  toMajor(): number {
    return this.amount / minorPerMajor(this.currency);
  }

  /** Locale-aware currency formatting via Intl.NumberFormat. */
  format(locale = "hu-HU"): string {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: this.currency,
    }).format(this.toMajor());
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.amount === other.amount;
  }

  toString(): string {
    return `${this.amount} ${this.currency}`;
  }

  /**
   * Build a Money from a major-unit amount (e.g. 12.34 EUR). The major amount
   * is converted to minor units with banker's rounding.
   */
  static fromMajor(major: number, currency: string): Money {
    if (typeof major !== "number" || !Number.isFinite(major)) {
      throw new InvalidMoneyError(`Major amount must be a finite number, got ${major}`);
    }
    if (typeof currency !== "string" || !CURRENCY_RE.test(currency)) {
      throw new InvalidMoneyError(`Invalid ISO-4217 currency code: ${String(currency)}`);
    }
    const minor = bankersRound(major * minorPerMajor(currency));
    return new Money(minor, currency);
  }
}

/**
 * Number of minor units per major unit for a currency. Defaults to 100 (two
 * decimal places); a few zero-decimal currencies are special-cased.
 */
function minorPerMajor(currency: string): number {
  const zeroDecimal = new Set([
    "JPY",
    "KRW",
    "HUF",
    "ISK",
    "CLP",
    "VND",
    "XOF",
    "XAF",
    "XPF",
    "BIF",
    "DJF",
    "GNF",
    "KMF",
    "PYG",
    "RWF",
    "UGX",
    "VUV",
    "XAG",
  ]);
  const threeDecimal = new Set(["BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND"]);
  if (zeroDecimal.has(currency)) return 1;
  if (threeDecimal.has(currency)) return 1000;
  return 100;
}
