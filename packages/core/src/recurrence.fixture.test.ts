import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { nextOccurrence } from "./recurrence.js";

// Shared drift fixture, also consumed by the backend pytest suite
// (app.domain.recurrence). Keeps the TS and Python recurrence math in
// lockstep — see HomeOps plan §4.1.
const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(here, "../../../tests/fixtures/recurrence_cases.json");

interface Case {
  name: string;
  rrule: string;
  after: string;
  expected: string | null;
}

const cases: Case[] = JSON.parse(readFileSync(fixturePath, "utf-8")).next_occurrence;

function isoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

describe("nextOccurrence shared fixture (parity with backend)", () => {
  it.each(cases)("$name", (c) => {
    const after = new Date(`${c.after}T00:00:00Z`);
    const result = nextOccurrence(c.rrule, after);
    if (c.expected === null) {
      expect(result).toBeNull();
    } else {
      expect(result).not.toBeNull();
      expect(isoDate(result!)).toBe(c.expected);
    }
  });
});
