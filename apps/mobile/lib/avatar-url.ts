/**
 * Resolve the backend's relative `avatar_url` (e.g. `/api/users/{id}/avatar?v=…`) to an
 * absolute URL the native `<Image>` can load. The web consumes the path same-origin; mobile
 * has no origin of its own, so we prefix the API origin (the configured base minus its
 * trailing `/api`). Returns null for users without an avatar.
 */
import { API_BASE_URL } from './api';

const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

export function resolveAvatarUrl(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl) return null;
  if (/^https?:\/\//.test(avatarUrl)) return avatarUrl;
  return `${API_ORIGIN}${avatarUrl}`;
}
