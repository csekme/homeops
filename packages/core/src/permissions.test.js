import { describe, it, expect } from "vitest";
import { can, isFinancialVisible, PERMISSIONS, ROLES } from "./permissions.js";
describe("can", () => {
    it("returns true when the permission is present", () => {
        expect(can([PERMISSIONS.EXPENSE_READ, PERMISSIONS.EXPENSE_WRITE], "expense.read")).toBe(true);
    });
    it("returns false when absent", () => {
        expect(can([PERMISSIONS.OBLIGATION_READ], "expense.write")).toBe(false);
    });
    it("returns false for non-array input", () => {
        // @ts-expect-error testing defensive runtime behaviour
        expect(can(null, "expense.read")).toBe(false);
    });
});
describe("isFinancialVisible", () => {
    const expected = {
        OWNER: true,
        ADMIN: true,
        MEMBER: true,
        VIEWER: false,
        CHILD: false,
    };
    for (const role of ROLES) {
        it(`returns ${expected[role]} for ${role}`, () => {
            expect(isFinancialVisible(role)).toBe(expected[role]);
        });
    }
});
describe("PERMISSIONS constants", () => {
    it("exposes the expected fine-grained strings", () => {
        expect(Object.values(PERMISSIONS)).toEqual([
            "expense.read",
            "expense.write",
            "obligation.read",
            "obligation.write",
            "document.delete",
            "connector.manage",
            "member.invite",
            "household.delete",
            "billing.manage",
        ]);
    });
});
