/**
 * In-memory access-token holder (spec §5.4, plan §3.12).
 *
 * The access token lives ONLY in module memory — never localStorage/sessionStorage
 * (XSS exfiltration risk). It is lost on full page reload; the app rehydrates it with a
 * silent refresh on boot (the refresh token is in an HttpOnly cookie).
 */
let accessToken = null;
export function getAccessToken() {
    return accessToken;
}
export function setAccessToken(token) {
    accessToken = token;
}
export function clearAccessToken() {
    accessToken = null;
}
