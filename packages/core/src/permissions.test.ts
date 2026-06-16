import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { can, isFinancialVisible, PERMISSIONS, ROLES } from "./permissions.js";
import type { Role } from "./permissions.js";

describe("can", () => {
  it("returns true when the permission is present", () => {
    expect(can([PERMISSIONS.EXPENSE_READ, PERMISSIONS.EXPENSE_WRITE], "expense.read")).toBe(
      true,
    );
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
  const expected: Record<Role, boolean> = {
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

describe("PERMISSIONS catalogue parity (with backend ROLE_PERMISSIONS)", () => {
  // Shared catalogue, also consumed by the backend pytest suite
  // (test_rbac.py). Keeps the client-side UI gating in lockstep with the
  // backend authorization gate — see HomeOps plan §4.2/B2.
  const here = dirname(fileURLToPath(import.meta.url));
  const fixturePath = resolve(here, "../../../tests/fixtures/role_permissions.json");
  const roles: Record<string, string[]> = JSON.parse(readFileSync(fixturePath, "utf-8")).roles;
  const universe = new Set(Object.values(roles).flat());

  it("exposes exactly the permission strings used across all roles", () => {
    expect(new Set(Object.values(PERMISSIONS))).toEqual(universe);
  });
});
