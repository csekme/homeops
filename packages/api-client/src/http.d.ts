/**
 * Fetch mutator (plan §3.11/§3.12): `/api` base, `credentials: 'include'` (so the
 * browser carries the HttpOnly refresh cookie), `Authorization: Bearer <memory token>`,
 * and single-flight refresh on 401 → retry once.
 *
 * This is the seam orval's generated client will plug into; the token store and refresh
 * logic stay put when the typed hooks replace the hand-written ones.
 */
export declare function configureApiClient(options: {
    baseUrl?: string;
}): void;
export declare class ApiRequestError extends Error {
    readonly status: number;
    readonly detail?: unknown;
    constructor(status: number, message: string, detail?: unknown);
}
/** Single-flight: concurrent 401s share one refresh round-trip. */
export declare function refreshAccessToken(): Promise<string | null>;
interface RequestOptions {
    method?: string;
    body?: unknown;
    /** Skip the automatic 401→refresh→retry (used by login/refresh themselves). */
    skipAuthRetry?: boolean;
}
export declare function apiFetch<T>(path: string, options?: RequestOptions): Promise<T>;
export {};
