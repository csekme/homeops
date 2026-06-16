/**
 * Maps an API error to a stable i18n key in the `auth` namespace (mirrors the web mapper).
 * Generic, non-enumerating messages shared across every auth screen.
 */
import { ApiRequestError } from '@homeops/api-client';

export function authErrorKey(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 401) return 'errors.invalidCredentials';
    if (error.status === 403) return 'errors.notActivated';
  }
  return 'errors.generic';
}
