/**
 * Role and permission helpers, mirrored from the backend RBAC model.
 *
 * The backend is the source of truth (`require_permission` in the service
 * layer); these helpers let the client hide UI it cannot use. They are NOT a
 * security boundary.
 */

export type Role = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER" | "CHILD";

export const ROLES: readonly Role[] = ["OWNER", "ADMIN", "MEMBER", "VIEWER", "CHILD"] as const;

/** Fine-grained permission strings used across the product. */
export const PERMISSIONS = {
  EXPENSE_READ: "expense.read",
  EXPENSE_WRITE: "expense.write",
  OBLIGATION_READ: "obligation.read",
  OBLIGATION_WRITE: "obligation.write",
  DOCUMENT_READ: "document.read",
  DOCUMENT_DELETE: "document.delete",
  CONNECTOR_MANAGE: "connector.manage",
  MEMBER_INVITE: "member.invite",
  MEMBER_MANAGE: "member.manage",
  HOUSEHOLD_DELETE: "household.delete",
  BILLING_MANAGE: "billing.manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Whether a permission set grants a specific permission.
 *
 * `permissions` is the flat list attached to a membership's role.
 */
export function can(permissions: string[], perm: string): boolean {
  if (!Array.isArray(permissions)) return false;
  return permissions.includes(perm);
}

/**
 * Whether financial information should be visible to a role. CHILD and VIEWER
 * never see money (no `expense.read`); everyone else does.
 */
export function isFinancialVisible(role: Role): boolean {
  return role !== "CHILD" && role !== "VIEWER";
}
