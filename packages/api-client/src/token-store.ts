/**
 * In-memory access-token holder (spec §5.4, plan §3.12).
 *
 * The access token lives ONLY in module memory — never localStorage/sessionStorage
 * (XSS exfiltration risk). It is lost on full page reload; the app rehydrates it with a
 * silent refresh on boot (the refresh token is in an HttpOnly cookie).
 *
 * We also remember the token's `exp` so the HTTP layer can refresh *proactively* (just
 * before expiry) instead of always waiting for a 401, and we expose a session-expired
 * seam so the host app (web/mobile) can redirect/log out when a refresh ultimately fails.
 */

/** Refresh this many ms before the real expiry to absorb clock skew / in-flight latency. */
const EXPIRY_SKEW_MS = 30_000;

let accessToken: string | null = null;
let accessTokenExpiresAt: number | null = null; // epoch ms, or null when unknown

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
  accessTokenExpiresAt = token ? readJwtExpiryMs(token) : null;
}

export function clearAccessToken(): void {
  accessToken = null;
  accessTokenExpiresAt = null;
}

/**
 * True when the current access token is within `EXPIRY_SKEW_MS` of expiring (or already
 * past). Returns false when there is no token or its expiry can't be read — in that case
 * the reactive 401 path remains the safety net, so we never block a request on a guess.
 */
export function isAccessTokenExpiring(now: number = Date.now()): boolean {
  if (accessToken === null || accessTokenExpiresAt === null) return false;
  return now >= accessTokenExpiresAt - EXPIRY_SKEW_MS;
}

function readJwtExpiryMs(token: string): number | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(atob(base64UrlToBase64(parts[1]!))) as { exp?: unknown };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function base64UrlToBase64(value: string): string {
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const remainder = b64.length % 4;
  return remainder ? b64 + '='.repeat(4 - remainder) : b64;
}

/* ---------------------------------------------------------------------------------- */
/* Session-expired seam                                                                */
/* The host app registers a handler (e.g. clear cache + redirect to /login). The HTTP  */
/* layer calls it when a refresh fails for an authenticated request.                   */
/* ---------------------------------------------------------------------------------- */

/** Context passed to the session-expired handler. */
export interface SessionExpiredInfo {
  /**
   * True when the failed request actually carried a session (so the user was logged in
   * and got kicked out). False for first-visit / boot probes where there was never a
   * token — the host can then redirect silently instead of showing a "logged out" notice.
   */
  wasAuthenticated: boolean;
}

type SessionExpiredHandler = (info: SessionExpiredInfo) => void;

let sessionExpiredHandler: SessionExpiredHandler | null = null;

export function setOnSessionExpired(handler: SessionExpiredHandler | null): void {
  sessionExpiredHandler = handler;
}

export function notifySessionExpired(info: SessionExpiredInfo): void {
  sessionExpiredHandler?.(info);
}

/* ---------------------------------------------------------------------------------- */
/* Refresh-token persistence seam (plan §5.1)                                          */
/* Web stores the refresh token in an HttpOnly cookie → registers NO adapter (no-op).  */
/* Mobile has no cookie jar → registers an `expo-secure-store` adapter so the refresh   */
/* token survives a cold start and feeds the body-refresh strategy.                     */
/* ---------------------------------------------------------------------------------- */

/** Host-supplied persistence for the refresh token (mobile: Keychain/Keystore). */
export interface SessionPersistence {
  loadRefreshToken(): Promise<string | null>;
  saveRefreshToken(token: string | null): Promise<void>;
}

let sessionPersistence: SessionPersistence | null = null;

export function setSessionPersistence(persistence: SessionPersistence | null): void {
  sessionPersistence = persistence;
}

/** Read the persisted refresh token, or null when no adapter is registered (web). */
export function loadRefreshToken(): Promise<string | null> {
  return sessionPersistence ? sessionPersistence.loadRefreshToken() : Promise.resolve(null);
}

/** Persist (or clear with `null`) the refresh token; no-op when no adapter (web). */
export function saveRefreshToken(token: string | null): Promise<void> {
  return sessionPersistence ? sessionPersistence.saveRefreshToken(token) : Promise.resolve();
}

/**
 * Set the full session at once: the access token goes to memory; the refresh token (when
 * present) goes to the persistence adapter. On web the backend never returns a body
 * `refresh_token`, so `refresh` is undefined and this collapses to `setAccessToken`.
 */
export function setSession(session: { access: string | null; refresh?: string | null }): void {
  setAccessToken(session.access);
  if (session.refresh !== undefined) {
    void saveRefreshToken(session.refresh);
  }
}
