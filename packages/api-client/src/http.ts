/**
 * Fetch mutator (plan §3.11/§3.12, phase0-mobile §4): base URL + transport behaviour come
 * from `config.ts` so the same `apiFetch` serves web (cookie transport) and mobile (bearer
 * transport). It always carries `Authorization: Bearer <memory token>` and single-flights a
 * refresh on 401 → retry once.
 *
 * Web: `credentials: 'include'` (HttpOnly refresh cookie) + CSRF header. Mobile: the
 * `X-Auth-Transport: bearer` header, no credentials/CSRF, refresh token via the body store.
 *
 * This is the seam orval's generated client will plug into; the token store and refresh
 * logic stay put when the typed hooks replace the hand-written ones.
 */

import type { ApiError, RefreshResponse } from '@homeops/types';

import { AUTH_TRANSPORT_HEADER, getApiConfig } from './config';

/** Cookie-less (bearer) device secret + platform headers — web uses HttpOnly cookies. */
const DEVICE_ID_HEADER = 'X-Device-Id';
const DEVICE_TRUST_HEADER = 'X-Device-Trust';
const DEVICE_PLATFORM_HEADER = 'X-Device-Platform';
import {
  clearAccessToken,
  getAccessToken,
  isAccessTokenExpiring,
  notifySessionExpired,
  setAccessToken,
} from './token-store';

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
    const cfg = getApiConfig();
    const bearer = cfg.authTransport === 'bearer';
    try {
      const headers: Record<string, string> = {};
      let body: string | undefined;

      if (bearer) {
        // Mobile: the refresh token is our credential — pull it from the secure store and
        // present it in the body. Nothing to refresh with ⇒ treat as a dead session.
        const stored = (await cfg.refreshTokenStore?.load()) ?? null;
        if (!stored) {
          clearAccessToken();
          return null;
        }
        headers[AUTH_TRANSPORT_HEADER] = 'bearer';
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify({ refresh_token: stored });
        // A trusted device rotates its 2FA-bypass secret on every refresh — present the
        // current one so the backend can verify + rotate it (feature plan §Device).
        const trust = (await cfg.deviceTrustStore?.load()) ?? null;
        if (trust) headers[DEVICE_TRUST_HEADER] = trust;
      } else {
        // Web: the HttpOnly cookie travels automatically; echo the double-submit CSRF token.
        const csrf = cfg.readCsrfToken();
        if (csrf) headers['X-CSRF-Token'] = csrf;
      }

      const response = await fetch(`${cfg.baseUrl}/auth/refresh`, {
        method: 'POST',
        ...(cfg.includeCredentials ? { credentials: 'include' as const } : {}),
        headers,
        body,
      });
      if (!response.ok) {
        clearAccessToken();
        if (bearer) await cfg.refreshTokenStore?.clear();
        return null;
      }
      const data = (await response.json()) as RefreshResponse;
      if (!data.access_token) {
        clearAccessToken();
        if (bearer) await cfg.refreshTokenStore?.clear();
        return null;
      }
      setAccessToken(data.access_token);
      // Rotation: persist the new refresh token (bearer only; web rotates the cookie).
      if (bearer && data.refresh_token) await cfg.refreshTokenStore?.save(data.refresh_token);
      // Trust rotation: persist the rotated 2FA-bypass secret when the backend returns one.
      if (bearer && data.device_trust) await cfg.deviceTrustStore?.save(data.device_trust);
      return data.access_token;
    } catch {
      clearAccessToken();
      if (bearer) await cfg.refreshTokenStore?.clear();
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

type ApiConfig = ReturnType<typeof getApiConfig>;

/** Bearer-transport device headers, scoped to the endpoints that actually need each secret. */
async function resolveDeviceHeaders(
  path: string,
  cfg: ApiConfig,
): Promise<Record<string, string>> {
  if (cfg.authTransport !== 'bearer') return {};
  // Trust secret is only meaningful where a session is (re)established under 2FA.
  const needsTrust = path.startsWith('/auth/login') || path.startsWith('/auth/totp/verify');
  // Identity also tags the device-management calls so the backend can mark "this device".
  const needsId = needsTrust || path.startsWith('/auth/devices');
  const headers: Record<string, string> = {};
  if (needsTrust && cfg.devicePlatform) headers[DEVICE_PLATFORM_HEADER] = cfg.devicePlatform;
  if (needsId) {
    const id = (await cfg.deviceIdStore?.load()) ?? null;
    if (id) headers[DEVICE_ID_HEADER] = id;
  }
  if (needsTrust) {
    const trust = (await cfg.deviceTrustStore?.load()) ?? null;
    if (trust) headers[DEVICE_TRUST_HEADER] = trust;
  }
  return headers;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const cfg = getApiConfig();
  // Bearer transport carries device secrets in headers (web uses HttpOnly cookies). The
  // 2FA-bypass secret only goes to the endpoints that consume it (login/2FA-verify); the
  // identity also tags the device-management calls so the backend can mark "this device".
  const deviceHeaders = await resolveDeviceHeaders(path, cfg);
  const send = async (): Promise<Response> => {
    const headers: Record<string, string> = { ...deviceHeaders };
    const token = getAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    // Bearer transport: flag every request so the auth endpoints answer in body-token mode.
    if (cfg.authTransport === 'bearer') headers[AUTH_TRANSPORT_HEADER] = 'bearer';
    return fetch(`${cfg.baseUrl}${path}`, {
      method: options.method ?? 'GET',
      ...(cfg.includeCredentials ? { credentials: 'include' as const } : {}),
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
