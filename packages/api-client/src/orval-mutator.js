/**
 * orval custom mutator (plan §3.11). orval's generated react-query hooks call this with
 * `{ url, method, params, data, headers, signal }`; it reuses the same memory-token +
 * `/api` base + `credentials: 'include'` + 401-refresh behaviour as the hand-written
 * `apiFetch`. Referenced by `orval.config.ts`; activated when codegen replaces the stub.
 */
import { apiFetch } from './http';
export function customInstance(config) {
    const query = config.params
        ? '?' + new URLSearchParams(config.params).toString()
        : '';
    return apiFetch(`${config.url}${query}`, {
        method: config.method.toUpperCase(),
        body: config.data,
    });
}
export default customInstance;
