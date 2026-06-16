/**
 * Maps 2FA API errors to stable i18n keys in the `settings` namespace. The backend keeps
 * the login step-2 (`/verify`) failures generic (no enumeration), so the challenge mapper
 * collapses everything to a single "invalid code" message; the authenticated step-up
 * endpoints distinguish bad-password (401) from already-enabled (409).
 */
import { ApiRequestError } from '@homeops/api-client';

/** Login step 2 — any failure (bad code, reused code, expired challenge) reads the same. */
export function challengeErrorKey(): string {
  return 'errors.totpInvalid';
}

/** Enrollment confirmation. */
export function confirmErrorKey(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 409) return 'errors.totpAlreadyEnabled';
    if (error.status === 400) return 'errors.totpInvalid';
  }
  return 'errors.generic';
}

/** Password step-up (disable / regenerate recovery codes). */
export function passwordStepUpErrorKey(error: unknown): string {
  if (error instanceof ApiRequestError && error.status === 401) {
    return 'errors.invalidPassword';
  }
  return 'errors.generic';
}
