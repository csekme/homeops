/**
 * Obligation status derivation.
 *
 * The stored truth is the trio (dueDate, completedAt, skipped). The display
 * status is derived against "now" with an optional lead time:
 *
 *   SKIPPED   — explicitly skipped (terminal, wins over everything)
 *   DONE      — completed (terminal)
 *   OVERDUE   — past the due date and not done/skipped
 *   DUE       — within the lead-time window before the due date
 *   UPCOMING  — further out than the lead-time window
 */
const MS_PER_DAY = 24 * 60 * 60 * 1000;
/**
 * Derive the display status of an obligation.
 *
 * Precedence: SKIPPED → DONE → (time-based) OVERDUE / DUE / UPCOMING.
 */
export function deriveStatus(input) {
    const { dueDate, completedAt = null, skipped = false, now = new Date(), leadTimeDays = 0 } = input;
    if (!(dueDate instanceof Date) || Number.isNaN(dueDate.getTime())) {
        throw new TypeError("dueDate must be a valid Date");
    }
    // Terminal states first.
    if (skipped)
        return "SKIPPED";
    if (completedAt)
        return "DONE";
    const nowMs = now.getTime();
    const dueMs = dueDate.getTime();
    if (nowMs > dueMs)
        return "OVERDUE";
    const lead = Math.max(0, leadTimeDays) * MS_PER_DAY;
    const dueWindowStart = dueMs - lead;
    if (nowMs >= dueWindowStart)
        return "DUE";
    return "UPCOMING";
}
