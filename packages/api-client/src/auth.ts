/**
 * Auth API functions + TanStack Query hooks.
 *
 * INTERIM (Phase 0, plan §3.11): hand-written with the hook shapes orval will emit
 * (`useLogin`, `useMe`, …). When codegen lands, these are replaced by the generated
 * hooks; the `apiFetch` mutator and token store stay.
 */

import type {
  ActivateRequest,
  LoginRequest,
  LoginResponse,
  MessageResponse,
  RegisterRequest,
  User,
} from '@homeops/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from './http';
import { clearAccessToken, loadRefreshToken, saveRefreshToken, setSession } from './token-store';

export async function login(body: LoginRequest): Promise<LoginResponse> {
  const result = await apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body,
    skipAuthRetry: true,
  });
  // 2FA case: no session yet — only a challenge token. The caller routes to the verify
  // step; the access token is set later by `useTotpVerify`.
  // The `refresh_token` is only present for mobile clients; on web it is undefined and
  // `setSession` collapses to setting just the in-memory access token (cookie holds refresh).
  if (result.access_token) {
    setSession({ access: result.access_token, refresh: result.refresh_token ?? undefined });
  }
  return result;
}

export function register(body: RegisterRequest): Promise<MessageResponse> {
  return apiFetch('/auth/register', { method: 'POST', body, skipAuthRetry: true });
}

export function activate(body: ActivateRequest): Promise<MessageResponse> {
  return apiFetch('/auth/activate', { method: 'POST', body, skipAuthRetry: true });
}

export function fetchMe(): Promise<User> {
  return apiFetch('/auth/me');
}

export async function logout(): Promise<void> {
  // Mobile revokes by the body refresh token (no cookie); on web `loadRefreshToken`
  // returns null → no body, identical to the previous cookie-only request.
  const refreshToken = await loadRefreshToken();
  try {
    await apiFetch('/auth/logout', {
      method: 'POST',
      body: refreshToken ? { refresh_token: refreshToken } : undefined,
      skipAuthRetry: true,
    });
  } finally {
    clearAccessToken();
    await saveRefreshToken(null);
  }
}

export const meQueryKey = ['auth', 'me'] as const;

export function useMe(options?: { enabled?: boolean }) {
  return useQuery({ queryKey: meQueryKey, queryFn: fetchMe, retry: false, ...options });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: login,
    // Only seed the cache on a full login; the mfa-required response carries no user.
    onSuccess: (data) => {
      if (data.user) queryClient.setQueryData(meQueryKey, data.user);
    },
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
