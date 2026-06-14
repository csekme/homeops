/**
 * Auth API functions + TanStack Query hooks.
 *
 * INTERIM (Phase 0, plan §3.11): hand-written with the hook shapes orval will emit
 * (`useLogin`, `useMe`, …). When codegen lands, these are replaced by the generated
 * hooks; the `apiFetch` mutator and token store stay.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './http';
import { clearAccessToken, setAccessToken } from './token-store';
export async function login(body) {
    const result = await apiFetch('/auth/login', {
        method: 'POST',
        body,
        skipAuthRetry: true,
    });
    setAccessToken(result.access_token);
    return result;
}
export function register(body) {
    return apiFetch('/auth/register', { method: 'POST', body, skipAuthRetry: true });
}
export function activate(body) {
    return apiFetch('/auth/activate', { method: 'POST', body, skipAuthRetry: true });
}
export function fetchMe() {
    return apiFetch('/auth/me');
}
export async function logout() {
    try {
        await apiFetch('/auth/logout', { method: 'POST', skipAuthRetry: true });
    }
    finally {
        clearAccessToken();
    }
}
export const meQueryKey = ['auth', 'me'];
export function useMe(options) {
    return useQuery({ queryKey: meQueryKey, queryFn: fetchMe, retry: false, ...options });
}
export function useLogin() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: login,
        onSuccess: (data) => queryClient.setQueryData(meQueryKey, data.user),
    });
}
export function useRegister() {
    return useMutation({ mutationFn: register });
}
export function useActivate() {
    return useMutation({ mutationFn: activate });
}
export function useLogout() {
    const queryClient = useQueryClient();
    return useMutation({ mutationFn: logout, onSuccess: () => queryClient.clear() });
}
