/**
 * In-memory access-token holder (spec §5.4, plan §3.12).
 *
 * The access token lives ONLY in module memory — never localStorage/sessionStorage
 * (XSS exfiltration risk). It is lost on full page reload; the app rehydrates it with a
 * silent refresh on boot (the refresh token is in an HttpOnly cookie).
 */

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function clearAccessToken(): void {
  accessToken = null;
}
