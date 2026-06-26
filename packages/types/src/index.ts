/**
 * API DTOs — generated from the backend OpenAPI snapshot (spec §5.9, plan §3.11).
 *
 * The single source of truth is `openapi.snapshot.json`; `pnpm codegen` (orval) regenerates
 * `./generated`. This barrel re-exports the generated types and adds a small set of
 * semantic aliases (`User`, `LoginResponse`, `Household`, …) so call sites read naturally
 * and stay stable even if the underlying schema names change.
 */

export * from './generated';

export type {
  ActivateIn as ActivateRequest,
  HouseholdOut as Household,
  InvitationOut as Invitation,
  InvitationPreviewOut as InvitationPreview,
  LoginIn as LoginRequest,
  LoginOut as LoginResponse,
  MemberOut as Member,
  MembershipOut as Membership,
  MessageOut as MessageResponse,
  RefreshOut as RefreshResponse,
  RegisterIn as RegisterRequest,
  SwitchOut as SwitchResponse,
  UserOut as User,
} from './generated';

/** RBAC role — the enum value type generated for role-bearing request bodies. */
export type { ChangeRoleInRole as Role } from './generated';

/** User lifecycle status (the backend constrains `status` to these values). */
export type UserStatus = 'PENDING' | 'ACTIVE' | 'DISABLED';

/** Unified error envelope returned by the backend (app/errors.py). */
export interface ApiError {
  error: {
    code: number;
    message: string;
    detail?: unknown;
  };
}
