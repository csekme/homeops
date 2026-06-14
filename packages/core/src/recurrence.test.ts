import { describe, it, expect } from "vitest";
import { nextOccurrence, RecurrenceError } from "./recurrence.js";

describe("nextOccurrence", () => {
  it("returns the next YEARLY occurrence strictly after `after`", () => {
    const dtstart = new Date(Date.UTC(2024, 0, 15, 9, 0, 0));
    const rule = `DTSTART:20240115T090000Z\nRRULE:FREQ=YEARLY`;
    const next = nextOccurrence(rule, new Date(Date.UTC(2024, 5, 1)));
    expect(next).not.toBeNull();
    expect(next!.getUTCFullYear()).toBe(2025);
    expect(next!.getUTCMonth()).toBe(0);
    expect(next!.getUTCDate()).toBe(15);
    // sanity: dtstart anchor preserved
    expect(dtstart.getUTCDate()).toBe(15);
  });

  it("handles FREQ=MONTHLY;BYMONTHDAY=15", () => {
    const after = new Date(Date.UTC(2024, 2, 16)); // March 16
    const next = nextOccurrence("FREQ=MONTHLY;BYMONTHDAY=15", after);
    expect(next).not.toBeNull();
    // March 15 already passed -> April 15
    expect(next!.getUTCMonth()).toBe(3);
    expect(next!.getUTCDate()).toBe(15);
  });

  it("returns a date strictly after `after` even when after === an occurrence", () => {
    const after = new Date(Date.UTC(2024, 2, 15)); // exactly the 15th
    const next = nextOccurrence("FREQ=MONTHLY;BYMONTHDAY=15", after);
    expect(next).not.toBeNull();
    // strictly after -> next month's 15th
    expect(next!.getUTCMonth()).toBe(3);
    expect(next!.getUTCDate()).toBe(15);
  });

  it("skips months without day 31 for BYMONTHDAY=31 (iCal semantics)", () => {
    // After Jan 31, the next 31 is March 31 (February has no 31st).
    const after = new Date(Date.UTC(2024, 0, 31)); // Jan 31 2024
    const next = nextOccurrence("FREQ=MONTHLY;BYMONTHDAY=31", after);
    expect(next).not.toBeNull();
    expect(next!.getUTCMonth()).toBe(2); // March
    expect(next!.getUTCDate()).toBe(31);
  });

  it("returns null when a COUNT-bounded rule is exhausted", () => {
    const rule = `DTSTART:20240101T000000Z\nRRULE:FREQ=YEARLY;COUNT=1`;
    const next = nextOccurrence(rule, new Date(Date.UTC(2025, 0, 1)));
    expect(next).toBeNull();
  });

  it("throws on empty rule", () => {
    expect(() => nextOccurrence("", new Date())).toThrow(RecurrenceError);
  });

  it("throws on invalid `after`", () => {
    expect(() => nextOccurrence("FREQ=YEARLY", new Date("nope"))).toThrow(
      RecurrenceError,
    );
  });
});
