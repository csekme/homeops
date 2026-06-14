/**
 * Recurrence helpers built on the iCal RRULE standard.
 *
 * Obligations may recur on an RRULE schedule (e.g. `FREQ=YEARLY`,
 * `FREQ=MONTHLY;BYMONTHDAY=15`). We mirror the backend's
 * `next_occurrence(rrule, after)` so web/mobile can preview upcoming dates
 * without a round trip.
 */
import { RRule, rrulestr } from "rrule";
/** Base class for recurrence errors. */
export class RecurrenceError extends Error {
    constructor(message) {
        super(message);
        this.name = "RecurrenceError";
    }
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
export function nextOccurrence(rrule, after) {
    if (typeof rrule !== "string" || rrule.trim() === "") {
        throw new RecurrenceError("RRULE string must be a non-empty string");
    }
    if (!(after instanceof Date) || Number.isNaN(after.getTime())) {
        throw new RecurrenceError("`after` must be a valid Date");
    }
    let rule;
    try {
        const parsed = rrulestr(normalize(rrule), { forceset: false });
        // rrulestr may return an RRuleSet; both expose `.after`.
        if (hasDtstart(parsed)) {
            rule = parsed;
        }
        else {
            // No DTSTART in the rule: re-parse with `after` as the anchor so the
            // schedule is evaluated relative to the query point.
            rule = new RRule({
                ...parsed.origOptions,
                dtstart: after,
            });
        }
    }
    catch (err) {
        throw new RecurrenceError(`Failed to parse RRULE "${rrule}": ${err.message}`);
    }
    // `after(date, false)` = strictly after.
    const next = rule.after(after, false);
    return next ?? null;
}
function normalize(rrule) {
    const trimmed = rrule.trim();
    // rrulestr understands both "FREQ=..." and "RRULE:FREQ=...".
    return trimmed;
}
function hasDtstart(parsed) {
    const opts = parsed.origOptions;
    return Boolean(opts && opts.dtstart);
}
