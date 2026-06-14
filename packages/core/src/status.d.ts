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
export type ObligationStatus = "UPCOMING" | "DUE" | "DONE" | "OVERDUE" | "SKIPPED";
export interface DeriveStatusInput {
    /** When the obligation is due. */
    dueDate: Date;
    /** When it was completed, if at all. */
    completedAt?: Date | null;
    /** Whether it was explicitly skipped. */
    skipped?: boolean;
    /** Reference point for the derivation (defaults to current time). */
    now?: Date;
    /** Days before dueDate at which the obligation becomes DUE. */
    leadTimeDays?: number;
}
/**
 * Derive the display status of an obligation.
 *
 * Precedence: SKIPPED → DONE → (time-based) OVERDUE / DUE / UPCOMING.
 */
export declare function deriveStatus(input: DeriveStatusInput): ObligationStatus;
