/**
 * Fetch mutator (plan §3.11/§3.12): `/api` base, `credentials: 'include'` (so the
 * browser carries the HttpOnly refresh cookie), `Authorization: Bearer <memory token>`,
 * and single-flight refresh on 401 → retry once.
 *
 * This is the seam orval's generated client will plug into; the token store and refresh
 * logic stay put when the typed hooks replace the hand-written ones.
 */

import type { ApiError, RefreshResponse } from '@homeops/types';

import {
  clearAccessToken,
  getAccessToken,
  isAccessTokenExpiring,
  notifySessionExpired,
  setAccessToken,
} from './token-store';

let apiBaseUrl = '/api';

export function configureApiClient(options: { baseUrl?: string }): void {
  if (options.baseUrl) apiBaseUrl = options.baseUrl;
}

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  for (const part of document.cookie.split('; ')) {
    const eq = part.indexOf('=');
    if (eq > -1 && part.slice(0, eq) === name) {
      return decodeURIComponent(part.slice(eq + 1));
    }
  }
  return null;
}

async function parse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const body = text ? JSON.parse(text) : undefined;
  if (!response.ok) {
    const err = body as ApiError | undefined;
    throw new ApiRequestError(
      response.status,
      err?.error?.message ?? response.statusText,
      err?.error?.detail,
    );
  }
  return body as T;
}

let refreshInFlight: Promise<string | null> | null = null;

/** Single-flight: concurrent 401s share one refresh round-trip. */
export function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const csrf = readCookie('csrf_token');
      const response = await fetch(`${apiBaseUrl}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: csrf ? { 'X-CSRF-Token': csrf } : {},
      });
      if (!response.ok) {
        clearAccessToken();
        return null;
      }
      const data = (await response.json()) as RefreshResponse;
      setAccessToken(data.access_token);
      return data.access_token;
    } catch {
      clearAccessToken();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Skip the automatic 401→refresh→retry (used by login/refresh themselves). */
  skipAuthRetry?: boolean;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const send = async (): Promise<Response> => {
    const headers: Record<string, string> = {};
    const token = getAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    return fetch(`${apiBaseUrl}${path}`, {
      method: options.method ?? 'GET',
      credentials: 'include',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  };

  // Whether this request started with a session — drives the "logged out" vs silent
  // distinction when a refresh ultimately fails (boot/first-visit probes carry no token).
  const wasAuthenticated = getAccessToken() !== null;

  // Proactive: if the access token is about to expire, refresh it *before* sending so
  // the request doesn't waste a round-trip on a guaranteed 401 (single-flight shared).
  if (!options.skipAuthRetry && wasAuthenticated && isAccessTokenExpiring()) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      notifySessionExpired({ wasAuthenticated: true });
      throw new ApiRequestError(401, 'Session expired');
    }
  }

  let response = await send();

  // Reactive fallback: a 401 we didn't anticipate (e.g. server-side revocation, or an
  // unparseable expiry). Refresh once and retry; if that fails, the session is gone.
  if (response.status === 401 && !options.skipAuthRetry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await send();
    } else {
      notifySessionExpired({ wasAuthenticated });
    }
  }
  return parse<T>(response);
}
