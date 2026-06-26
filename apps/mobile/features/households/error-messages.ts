/** Maps household/invitation API errors to i18n keys in the `households` namespace (mobile). */
import { ApiRequestError } from '@homeops/api-client';

export function householdErrorKey(error: unknown): string {
  if (error instanceof ApiRequestError) {
    switch (error.status) {
      case 403:
        return 'errors.forbidden';
      case 404:
        return 'errors.notFound';
      case 409:
        return 'errors.conflict';
      case 400:
        return 'errors.invalidInvite';
    }
  }
  return 'errors.generic';
}

export function acceptErrorKey(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 403) return 'errors.emailMismatch';
    if (error.status === 400) return 'errors.invalidInvite';
  }
  return 'errors.generic';
}
