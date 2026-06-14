import { describe, it, expect } from "vitest";
import { deriveStatus } from "./status.js";
const DAY = 24 * 60 * 60 * 1000;
describe("deriveStatus", () => {
    const due = new Date(Date.UTC(2026, 5, 20, 12, 0, 0));
    it("is UPCOMING well before the lead window", () => {
        const now = new Date(due.getTime() - 10 * DAY);
        expect(deriveStatus({ dueDate: due, now, leadTimeDays: 3 })).toBe("UPCOMING");
    });
    it("becomes DUE inside the lead window", () => {
        const now = new Date(due.getTime() - 2 * DAY);
        expect(deriveStatus({ dueDate: due, now, leadTimeDays: 3 })).toBe("DUE");
    });
    it("is DUE exactly at the start of the lead window", () => {
        const now = new Date(due.getTime() - 3 * DAY);
        expect(deriveStatus({ dueDate: due, now, leadTimeDays: 3 })).toBe("DUE");
    });
    it("is DUE at the due moment", () => {
        expect(deriveStatus({ dueDate: due, now: due, leadTimeDays: 3 })).toBe("DUE");
    });
    it("becomes OVERDUE after the due date", () => {
        const now = new Date(due.getTime() + 1 * DAY);
        expect(deriveStatus({ dueDate: due, now, leadTimeDays: 3 })).toBe("OVERDUE");
    });
    it("is DONE when completed (overrides time)", () => {
        const now = new Date(due.getTime() + 5 * DAY);
        expect(deriveStatus({ dueDate: due, now, completedAt: new Date(), leadTimeDays: 3 })).toBe("DONE");
    });
    it("is SKIPPED when skipped (overrides everything)", () => {
        const now = new Date(due.getTime() + 5 * DAY);
        expect(deriveStatus({
            dueDate: due,
            now,
            skipped: true,
            completedAt: new Date(),
        })).toBe("SKIPPED");
    });
    it("with zero lead time only becomes DUE at the due moment", () => {
        const now = new Date(due.getTime() - 1 * DAY);
        expect(deriveStatus({ dueDate: due, now, leadTimeDays: 0 })).toBe("UPCOMING");
        expect(deriveStatus({ dueDate: due, now: due, leadTimeDays: 0 })).toBe("DUE");
    });
    it("throws on an invalid dueDate", () => {
        expect(() => deriveStatus({ dueDate: new Date("nope") })).toThrow(TypeError);
    });
});
