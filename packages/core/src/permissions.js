/**
 * Role and permission helpers, mirrored from the backend RBAC model.
 *
 * The backend is the source of truth (`require_permission` in the service
 * layer); these helpers let the client hide UI it cannot use. They are NOT a
 * security boundary.
 */
export const ROLES = ["OWNER", "ADMIN", "MEMBER", "VIEWER", "CHILD"];
/** Fine-grained permission strings used across the product. */
export const PERMISSIONS = {
    EXPENSE_READ: "expense.read",
    EXPENSE_WRITE: "expense.write",
    OBLIGATION_READ: "obligation.read",
    OBLIGATION_WRITE: "obligation.write",
    DOCUMENT_DELETE: "document.delete",
    CONNECTOR_MANAGE: "connector.manage",
    MEMBER_INVITE: "member.invite",
    HOUSEHOLD_DELETE: "household.delete",
    BILLING_MANAGE: "billing.manage",
};
/**
 * Whether a permission set grants a specific permission.
 *
 * `permissions` is the flat list attached to a membership's role.
 */
export function can(permissions, perm) {
    if (!Array.isArray(permissions))
        return false;
    return permissions.includes(perm);
}
/**
 * Whether financial information should be visible to a role. CHILD and VIEWER
 * never see money (no `expense.read`); everyone else does.
 */
export function isFinancialVisible(role) {
    return role !== "CHILD" && role !== "VIEWER";
}
