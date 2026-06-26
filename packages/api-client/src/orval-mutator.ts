/**
 * orval custom mutator (plan §3.11). orval's generated react-query hooks call this with
 * `{ url, method, params, data, headers, signal }`; it routes through `apiFetch` so the
 * memory-token + base-URL + 401-refresh behaviour is shared with the rest of the client.
 *
 * Two adjustments bridge orval ↔ apiFetch:
 *  - Generated paths are absolute (`/api/...`); `apiFetch` re-adds `config.baseUrl` (`/api`),
 *    so we strip the leading `/api` to avoid doubling it.
 *  - The auth handshake + public endpoints opt out of the 401→refresh→retry, so a bad login
 *    or an expired invite preview never masquerades as a "session expired".
 */

import { apiFetch } from './http';

export interface OrvalRequestConfig {
  url: string;
  method: string;
  params?: Record<string, unknown>;
  data?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

const BASE_PREFIX = '/api';

// Endpoints that are the auth handshake itself or are unauthenticated — never retry via refresh.
const NO_RETRY_PATHS = ['/auth/login', '/auth/register', '/auth/activate', '/auth/refresh'];

function shouldSkipAuthRetry(path: string, method: string): boolean {
  if (NO_RETRY_PATHS.some((p) => path.startsWith(p))) return true;
  // Public invitation preview: GET /invitations/<token> (accept is POST and stays retryable).
  return method === 'GET' && path.startsWith('/invitations/');
}

export function customInstance<T>(config: OrvalRequestConfig): Promise<T> {
  const query = config.params
    ? '?' + new URLSearchParams(config.params as Record<string, string>).toString()
    : '';
  const stripped = config.url.startsWith(BASE_PREFIX)
    ? config.url.slice(BASE_PREFIX.length)
    : config.url;
  const path = `${stripped}${query}`;
  const method = config.method.toUpperCase();
  return apiFetch<T>(path, {
    method,
    body: config.data,
    skipAuthRetry: shouldSkipAuthRetry(stripped, method),
  });
}

export default customInstance;
