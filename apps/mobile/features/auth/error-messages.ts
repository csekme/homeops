/**
 * Maps an API error to a stable i18n key in the `auth` namespace. Centralized so every
 * auth screen surfaces the same localized, generic (non-enumerating) messages. Identical
 * to the web app's mapper.
 */
import { ApiRequestError } from '@homeops/api-client';

export function authErrorKey(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 401) return 'errors.invalidCredentials';
    if (error.status === 403) return 'errors.notActivated';
  }
  return 'errors.generic';
}

/** Reset-password failures are token-validity problems (400) → a clear "request a new link". */
export function resetPasswordErrorKey(error: unknown): string {
  if (error instanceof ApiRequestError && error.status === 400) {
    return 'errors.invalidResetToken';
  }
  return 'errors.generic';
}
