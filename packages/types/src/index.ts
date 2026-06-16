/**
 * API DTOs.
 *
 * INTERIM (Phase 0, plan §3.11): hand-written to mirror the backend's OpenAPI schemas
 * exactly. Once the backend contract is stable, orval regenerates these into
 * `src/generated/` from `openapi.snapshot.json` and this file re-exports them.
 */

export type UserStatus = 'PENDING' | 'ACTIVE' | 'DISABLED';
export type Role = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' | 'CHILD';

export interface Membership {
  household_id: string;
  household_name: string;
  role: Role | string;
}

export interface User {
  id: string;
  email: string;
  display_name: string;
  status: UserStatus | string;
  memberships: Membership[];
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  display_name: string;
  locale?: string;
}

export interface ActivateRequest {
  token: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
  /** Present (and true) when the account has 2FA enabled and step 2 is required. */
  mfa_required?: boolean;
  /** Short-lived token to echo back to `/auth/totp/verify` when `mfa_required`. */
  challenge_token?: string;
}

/* ------------------------------------------------------------------ */
/* Two-factor authentication (TOTP)                                    */
/* ------------------------------------------------------------------ */

export interface TotpSetupResponse {
  /** `otpauth://` URI the client renders as a QR code. */
  provisioning_uri: string;
  /** Base32 secret, for manual entry into an authenticator app. */
  secret: string;
}

export interface TotpStatusResponse {
  enabled: boolean;
  recovery_codes_remaining: number;
}

export interface RecoveryCodesResponse {
  codes: string[];
}

export interface TotpConfirmRequest {
  code: string;
}

export interface TotpVerifyRequest {
  challenge_token: string;
  code: string;
}

export interface TotpDisableRequest {
  password: string;
}

export interface RecoveryRegenerateRequest {
  password: string;
}

export interface RefreshResponse {
  access_token: string;
  token_type: string;
}

export interface MessageResponse {
  message: string;
}

export interface ApiError {
  error: {
    code: number;
    message: string;
    detail?: unknown;
  };
}
