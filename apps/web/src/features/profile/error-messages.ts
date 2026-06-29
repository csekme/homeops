/**
 * Maps avatar API errors to stable i18n keys in the `settings` namespace (`profile.errors.*`).
 * The backend rejects oversized uploads with 413 and non-images with 400.
 */
import { ApiRequestError } from '@homeops/api-client';

export function avatarErrorKey(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 413) return 'profile.errors.tooLarge';
    if (error.status === 400) return 'profile.errors.invalidImage';
  }
  return 'profile.errors.generic';
}
