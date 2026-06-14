import { describe, it, expect } from "vitest";
import {
  Money,
  InvalidMoneyError,
  CurrencyMismatchError,
  bankersRound,
} from "./money.js";

describe("Money construction", () => {
  it("accepts integer minor units and a valid currency", () => {
    const m = new Money(1234, "EUR");
    expect(m.toMinor()).toBe(1234);
    expect(m.currency).toBe("EUR");
  });

  it("rejects non-integer (float) minor amounts", () => {
    expect(() => new Money(12.34, "EUR")).toThrow(InvalidMoneyError);
  });

  it("rejects NaN / Infinity", () => {
    expect(() => new Money(NaN, "EUR")).toThrow(InvalidMoneyError);
    expect(() => new Money(Infinity, "EUR")).toThrow(InvalidMoneyError);
  });

  it("rejects malformed currency codes", () => {
    expect(() => new Money(100, "eur")).toThrow(InvalidMoneyError);
    expect(() => new Money(100, "EU")).toThrow(InvalidMoneyError);
    expect(() => new Money(100, "EURO")).toThrow(InvalidMoneyError);
    expect(() => new Money(100, "12A")).toThrow(InvalidMoneyError);
  });
});

describe("Money arithmetic", () => {
  it("adds same-currency amounts", () => {
    expect(new Money(100, "EUR").add(new Money(50, "EUR")).toMinor()).toBe(150);
  });

  it("subtracts same-currency amounts", () => {
    expect(new Money(100, "EUR").subtract(new Money(30, "EUR")).toMinor()).toBe(70);
  });

  it("throws on cross-currency add", () => {
    expect(() => new Money(100, "EUR").add(new Money(50, "USD"))).toThrow(
      CurrencyMismatchError,
    );
  });

  it("throws on cross-currency subtract", () => {
    expect(() => new Money(100, "EUR").subtract(new Money(50, "USD"))).toThrow(
      CurrencyMismatchError,
    );
  });
});

describe("Money multiply with banker's rounding", () => {
  it("rounds half to even (down)", () => {
    // 25 * 1.1 = 27.5 -> nearest even is 28
    expect(new Money(25, "EUR").multiply(1.1).toMinor()).toBe(28);
  });

  it("rounds 2.5 -> 2 (even) and 3.5 -> 4 (even)", () => {
    // 5 * 0.5 = 2.5 -> 2
    expect(new Money(5, "EUR").multiply(0.5).toMinor()).toBe(2);
    // 7 * 0.5 = 3.5 -> 4
    expect(new Money(7, "EUR").multiply(0.5).toMinor()).toBe(4);
  });

  it("multiplies by an integer exactly", () => {
    expect(new Money(199, "EUR").multiply(3).toMinor()).toBe(597);
  });

  it("rounds half-to-even even when the float product carries dust", () => {
    // 25 * 0.1 = 2.5 mathematically, but lands at 2.5000000000000004 in float.
    // Half-to-even must give 2 (even), not 3 — a naive `diff > 0.5` would round up.
    expect(new Money(25, "EUR").multiply(0.1).toMinor()).toBe(2);
    // 35 * 0.1 = 3.5 -> 4 (even).
    expect(new Money(35, "EUR").multiply(0.1).toMinor()).toBe(4);
  });

  it("rejects non-finite multipliers", () => {
    expect(() => new Money(100, "EUR").multiply(NaN)).toThrow(InvalidMoneyError);
  });
});

describe("bankersRound", () => {
  it("rounds halves to the nearest even integer", () => {
    expect(bankersRound(0.5)).toBe(0);
    expect(bankersRound(1.5)).toBe(2);
    expect(bankersRound(2.5)).toBe(2);
    expect(bankersRound(3.5)).toBe(4);
    expect(bankersRound(-0.5)).toBe(0);
    expect(bankersRound(-1.5)).toBe(-2);
  });

  it("rounds non-halves normally", () => {
    expect(bankersRound(2.4)).toBe(2);
    expect(bankersRound(2.6)).toBe(3);
  });
});

describe("minor <-> major round trip", () => {
  it("round trips a two-decimal currency", () => {
    const m = Money.fromMajor(12.34, "EUR");
    expect(m.toMinor()).toBe(1234);
    expect(m.toMajor()).toBe(12.34);
  });

  it("round trips a zero-decimal currency (HUF)", () => {
    const m = Money.fromMajor(1500, "HUF");
    expect(m.toMinor()).toBe(1500);
    expect(m.toMajor()).toBe(1500);
  });

  it("fromMajor applies banker's rounding to sub-minor input", () => {
    // 1.005 * 100 = 100.5 -> 100 (even)
    expect(Money.fromMajor(1.005, "EUR").toMinor()).toBe(100);
  });
});

describe("Money formatting", () => {
  it("formats with Intl.NumberFormat", () => {
    const formatted = new Money(123456, "EUR").format("en-US");
    expect(formatted).toMatch(/1,234\.56/);
    expect(formatted).toMatch(/€|EUR/);
  });
});

describe("Money equality and string", () => {
  it("compares value and currency", () => {
    expect(new Money(100, "EUR").equals(new Money(100, "EUR"))).toBe(true);
    expect(new Money(100, "EUR").equals(new Money(100, "USD"))).toBe(false);
  });

  it("stringifies as amount + currency", () => {
    expect(new Money(100, "EUR").toString()).toBe("100 EUR");
  });
});
