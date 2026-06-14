/** Base class for recurrence errors. */
export declare class RecurrenceError extends Error {
    constructor(message: string);
}
/**
 * Return the next occurrence strictly after `after`, or `null` if the rule has
 * no further occurrences.
 *
 * `rrule` accepts either a bare rule (`FREQ=MONTHLY;BYMONTHDAY=15`) or a full
 * `RRULE:` line. When the rule has no `DTSTART`, `after` is used as the anchor
 * so the recurrence is evaluated relative to the query point.
 *
 * Dates are treated in UTC to stay DST-stable: BYMONTHDAY=31 in a 30-day month
 * is skipped by the standard (not clamped), which matches iCal semantics.
 *
 * Contract: recurrence is evaluated purely in UTC. Occurrences keep the same UTC
 * wall time across DST boundaries (no local-time hour drift) — see the DST test in
 * `recurrence.test.ts`. Local-time / `TZID`-anchored rules are out of scope for now.
 */
export declare function nextOccurrence(rrule: string, after: Date): Date | null;
