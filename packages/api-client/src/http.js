/**
 * Fetch mutator (plan §3.11/§3.12): `/api` base, `credentials: 'include'` (so the
 * browser carries the HttpOnly refresh cookie), `Authorization: Bearer <memory token>`,
 * and single-flight refresh on 401 → retry once.
 *
 * This is the seam orval's generated client will plug into; the token store and refresh
 * logic stay put when the typed hooks replace the hand-written ones.
 */
import { clearAccessToken, getAccessToken, setAccessToken } from './token-store';
let apiBaseUrl = '/api';
export function configureApiClient(options) {
    if (options.baseUrl)
        apiBaseUrl = options.baseUrl;
}
export class ApiRequestError extends Error {
    status;
    detail;
    constructor(status, message, detail) {
        super(message);
        this.status = status;
        this.detail = detail;
        this.name = 'ApiRequestError';
    }
}
function readCookie(name) {
    if (typeof document === 'undefined')
        return null;
    for (const part of document.cookie.split('; ')) {
        const eq = part.indexOf('=');
        if (eq > -1 && part.slice(0, eq) === name) {
            return decodeURIComponent(part.slice(eq + 1));
        }
    }
    return null;
}
async function parse(response) {
    const text = await response.text();
    const body = text ? JSON.parse(text) : undefined;
    if (!response.ok) {
        const err = body;
        throw new ApiRequestError(response.status, err?.error?.message ?? response.statusText, err?.error?.detail);
    }
    return body;
}
let refreshInFlight = null;
/** Single-flight: concurrent 401s share one refresh round-trip. */
export function refreshAccessToken() {
    if (refreshInFlight)
        return refreshInFlight;
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
            const data = (await response.json());
            setAccessToken(data.access_token);
            return data.access_token;
        }
        catch {
            clearAccessToken();
            return null;
        }
        finally {
            refreshInFlight = null;
        }
    })();
    return refreshInFlight;
}
export async function apiFetch(path, options = {}) {
    const send = async () => {
        const headers = {};
        const token = getAccessToken();
        if (token)
            headers['Authorization'] = `Bearer ${token}`;
        if (options.body !== undefined)
            headers['Content-Type'] = 'application/json';
        return fetch(`${apiBaseUrl}${path}`, {
            method: options.method ?? 'GET',
            credentials: 'include',
            headers,
            body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        });
    };
    let response = await send();
    if (response.status === 401 && !options.skipAuthRetry) {
        const refreshed = await refreshAccessToken();
        if (refreshed)
            response = await send();
    }
    return parse(response);
}
