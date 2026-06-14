/**
 * Money value object.
 *
 * Stores amounts as integer minor units (e.g. cents/fillér) and an ISO-4217
 * currency code. All arithmetic happens on integers — never floats — so there
 * is no representation drift. Multiplication uses banker's rounding (round
 * half to even) when the result lands between two minor units.
 */
/** Base class for all Money-related errors. */
export declare class MoneyError extends Error {
    constructor(message: string);
}
/** Thrown when an amount or currency code is not a valid value. */
export declare class InvalidMoneyError extends MoneyError {
    constructor(message: string);
}
/** Thrown when two Money values of different currencies are combined. */
export declare class CurrencyMismatchError extends MoneyError {
    constructor(a: string, b: string);
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
export declare function bankersRound(value: number): number;
export declare class Money {
    /** Amount in integer minor units. */
    readonly amount: number;
    /** ISO-4217 currency code (3 uppercase letters). */
    readonly currency: string;
    constructor(minorAmount: number, currency: string);
    private assertSameCurrency;
    /** Add another Money of the same currency. */
    add(other: Money): Money;
    /** Subtract another Money of the same currency. */
    subtract(other: Money): Money;
    /**
     * Multiply by an integer or rational factor. The product is rounded to the
     * nearest minor unit using banker's rounding.
     */
    multiply(factor: number): Money;
    /** Raw integer minor units. */
    toMinor(): number;
    /**
     * Major-unit representation as a number. NOTE: intended for display only —
     * never re-store this value as the canonical amount.
     */
    toMajor(): number;
    /** Locale-aware currency formatting via Intl.NumberFormat. */
    format(locale?: string): string;
    equals(other: Money): boolean;
    toString(): string;
    /**
     * Build a Money from a major-unit amount (e.g. 12.34 EUR). The major amount
     * is converted to minor units with banker's rounding.
     */
    static fromMajor(major: number, currency: string): Money;
}
