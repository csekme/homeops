/**
 * API-client configuration + transport-adapter seam (phase0-mobile §4).
 *
 * One module of mutable, host-supplied config so the SAME hooks/`apiFetch` serve both:
 *   • Web (default): same-origin `/api`, `credentials: 'include'` so the browser carries the
 *     HttpOnly refresh cookie, CSRF read from the `csrf_token` cookie. Refresh has no token
 *     store — the cookie IS the store.
 *   • Mobile: absolute `baseUrl`, `authTransport: 'bearer'` (sends `X-Auth-Transport: bearer`
 *     on every request), no credentials, no CSRF, and a `refreshTokenStore` backed by
 *     expo-secure-store. The refresh token travels in the body instead of a cookie.
 *
 * Hosts call `configureApiClient()` once at boot; nothing else in the package reaches for
 * platform globals directly.
 */

/** Where the refresh token lives on a bearer-transport client (e.g. expo-secure-store). */
export interface RefreshTokenStore {
  load(): Promise<string | null> | string | null;
  save(token: string): Promise<void> | void;
  clear(): Promise<void> | void;
}

/**
 * Persistence for a device secret on a bearer-transport client (feature plan §Device).
 * Same shape as the refresh store; web leaves these `null` because the equivalent secrets
 * ride as HttpOnly cookies the browser manages for us.
 */
export type DeviceSecretStore = RefreshTokenStore;

export type AuthTransport = 'cookie' | 'bearer';

export type DevicePlatform = 'web' | 'ios' | 'android';

export interface ApiClientConfig {
  /** API origin/prefix, e.g. `/api` (web) or `https://homeops.localhost/api` (mobile). */
  baseUrl: string;
  /** Send `credentials: 'include'` so the browser attaches the HttpOnly cookies (web only). */
  includeCredentials: boolean;
  /** `bearer` adds the `X-Auth-Transport` header and switches refresh to the body path. */
  authTransport: AuthTransport;
  /** Reads the double-submit CSRF token (web: the `csrf_token` cookie; mobile: null). */
  readCsrfToken: () => string | null;
  /** Refresh-token persistence for bearer transport. `null` ⇒ cookie transport (web). */
  refreshTokenStore: RefreshTokenStore | null;
  /** Device-identity secret store (bearer transport). `null` ⇒ web (HttpOnly cookie). */
  deviceIdStore: DeviceSecretStore | null;
  /** Device 2FA-bypass secret store (bearer transport). `null` ⇒ web (HttpOnly cookie). */
  deviceTrustStore: DeviceSecretStore | null;
  /** Reported to the backend as `X-Device-Platform` (bearer transport). `null` ⇒ web. */
  devicePlatform: DevicePlatform | null;
}

/** Header a bearer-transport client sends so the backend skips Set-Cookie + CSRF. */
export const AUTH_TRANSPORT_HEADER = 'X-Auth-Transport';

/** Default CSRF reader: the non-HttpOnly `csrf_token` cookie (web double-submit). */
function readCsrfCookie(): string | null {
  if (typeof document === 'undefined') return null;
  for (const part of document.cookie.split('; ')) {
    const eq = part.indexOf('=');
    if (eq > -1 && part.slice(0, eq) === 'csrf_token') {
      return decodeURIComponent(part.slice(eq + 1));
    }
  }
  return null;
}

// Web-shaped defaults: a fresh import behaves exactly as before the seam existed.
const config: ApiClientConfig = {
  baseUrl: '/api',
  includeCredentials: true,
  authTransport: 'cookie',
  readCsrfToken: readCsrfCookie,
  refreshTokenStore: null,
  deviceIdStore: null,
  deviceTrustStore: null,
  devicePlatform: null,
};

/** Override any subset of the config (host app, once at boot). */
export function configureApiClient(options: Partial<ApiClientConfig>): void {
  Object.assign(config, options);
}

/** Live config read by `http.ts`, `auth.ts`, `totp.ts`. */
export function getApiConfig(): Readonly<ApiClientConfig> {
  return config;
}
