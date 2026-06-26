/**
 * Maps household/invitation API errors to stable i18n keys in the `households` namespace.
 * Centralized so every household screen surfaces consistent, localized messages.
 */
import { ApiRequestError } from '@homeops/api-client';

export function householdErrorKey(error: unknown): string {
  if (error instanceof ApiRequestError) {
    switch (error.status) {
      case 403:
        return 'errors.forbidden';
      case 404:
        return 'errors.notFound';
      case 409:
        // The backend message disambiguates (last owner / already member / pending invite),
        // but a single localized 409 message keeps the UI simple and non-leaky.
        return 'errors.conflict';
      case 400:
        return 'errors.invalidInvite';
    }
  }
  return 'errors.generic';
}

/** Invite-acceptance specific mapping (email mismatch is a 403 with a distinct meaning). */
export function acceptErrorKey(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 403) return 'errors.emailMismatch';
    if (error.status === 400) return 'errors.invalidInvite';
  }
  return 'errors.generic';
}
