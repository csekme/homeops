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
    constructor(message) {
        super(message);
        this.name = "MoneyError";
    }
}
/** Thrown when an amount or currency code is not a valid value. */
export class InvalidMoneyError extends MoneyError {
    constructor(message) {
        super(message);
        this.name = "InvalidMoneyError";
    }
}
/** Thrown when two Money values of different currencies are combined. */
export class CurrencyMismatchError extends MoneyError {
    constructor(a, b) {
        super(`Currency mismatch: ${a} vs ${b}`);
        this.name = "CurrencyMismatchError";
    }
}
/**
 * Round a number to the nearest integer using banker's rounding
 * (round half to even).
 *
 * The halfway check is epsilon-tolerant on purpose: a mathematically-exact `.5`
 * produced by float arithmetic often lands a few ULPs off (e.g. `25 * 0.1` is
 * `2.5000000000000004`). A naive `diff > 0.5` would then skip the round-to-even
 * branch and round the wrong way, so we treat anything within a magnitude-scaled
 * epsilon of `.5` as exactly halfway.
 */
export function bankersRound(value) {
    const floor = Math.floor(value);
    const diff = value - floor;
    const eps = Math.abs(value) * Number.EPSILON * 4 + Number.EPSILON;
    if (Math.abs(diff - 0.5) <= eps) {
        // Halfway: round to the even neighbour.
        return floor % 2 === 0 ? floor : floor + 1;
    }
    return diff < 0.5 ? floor : floor + 1;
}
export class Money {
    /** Amount in integer minor units. */
    amount;
    /** ISO-4217 currency code (3 uppercase letters). */
    currency;
    constructor(minorAmount, currency) {
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
    assertSameCurrency(other) {
        if (this.currency !== other.currency) {
            throw new CurrencyMismatchError(this.currency, other.currency);
        }
    }
    /** Add another Money of the same currency. */
    add(other) {
        this.assertSameCurrency(other);
        return new Money(this.amount + other.amount, this.currency);
    }
    /** Subtract another Money of the same currency. */
    subtract(other) {
        this.assertSameCurrency(other);
        return new Money(this.amount - other.amount, this.currency);
    }
    /**
     * Multiply by an integer or rational factor. The product is rounded to the
     * nearest minor unit using banker's rounding.
     */
    multiply(factor) {
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
    toMinor() {
        return this.amount;
    }
    /**
     * Major-unit representation as a number. NOTE: intended for display only —
     * never re-store this value as the canonical amount.
     */
    toMajor() {
        return this.amount / minorPerMajor(this.currency);
    }
    /** Locale-aware currency formatting via Intl.NumberFormat. */
    format(locale = "hu-HU") {
        return new Intl.NumberFormat(locale, {
            style: "currency",
            currency: this.currency,
        }).format(this.toMajor());
    }
    equals(other) {
        return this.currency === other.currency && this.amount === other.amount;
    }
    toString() {
        return `${this.amount} ${this.currency}`;
    }
    /**
     * Build a Money from a major-unit amount (e.g. 12.34 EUR). The major amount
     * is converted to minor units with banker's rounding.
     */
    static fromMajor(major, currency) {
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
function minorPerMajor(currency) {
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
    if (zeroDecimal.has(currency))
        return 1;
    if (threeDecimal.has(currency))
        return 1000;
    return 100;
}
