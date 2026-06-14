/**
 * orval custom mutator (plan §3.11). orval's generated react-query hooks call this with
 * `{ url, method, params, data, headers, signal }`; it reuses the same memory-token +
 * `/api` base + `credentials: 'include'` + 401-refresh behaviour as the hand-written
 * `apiFetch`. Referenced by `orval.config.ts`; activated when codegen replaces the stub.
 */
export interface OrvalRequestConfig {
    url: string;
    method: string;
    params?: Record<string, unknown>;
    data?: unknown;
    headers?: Record<string, string>;
    signal?: AbortSignal;
}
export declare function customInstance<T>(config: OrvalRequestConfig): Promise<T>;
export default customInstance;
