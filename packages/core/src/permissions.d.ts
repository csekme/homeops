/**
 * Role and permission helpers, mirrored from the backend RBAC model.
 *
 * The backend is the source of truth (`require_permission` in the service
 * layer); these helpers let the client hide UI it cannot use. They are NOT a
 * security boundary.
 */
export type Role = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER" | "CHILD";
export declare const ROLES: readonly Role[];
/** Fine-grained permission strings used across the product. */
export declare const PERMISSIONS: {
    readonly EXPENSE_READ: "expense.read";
    readonly EXPENSE_WRITE: "expense.write";
    readonly OBLIGATION_READ: "obligation.read";
    readonly OBLIGATION_WRITE: "obligation.write";
    readonly DOCUMENT_DELETE: "document.delete";
    readonly CONNECTOR_MANAGE: "connector.manage";
    readonly MEMBER_INVITE: "member.invite";
    readonly HOUSEHOLD_DELETE: "household.delete";
    readonly BILLING_MANAGE: "billing.manage";
};
export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
/**
 * Whether a permission set grants a specific permission.
 *
 * `permissions` is the flat list attached to a membership's role.
 */
export declare function can(permissions: string[], perm: string): boolean;
/**
 * Whether financial information should be visible to a role. CHILD and VIEWER
 * never see money (no `expense.read`); everyone else does.
 */
export declare function isFinancialVisible(role: Role): boolean;
