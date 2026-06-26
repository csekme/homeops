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

import { getApiConfig } from './config';
import { apiFetch } from './http';
import { clearAccessToken, setAccessToken } from './token-store';

/**
 * Persist a body-borne refresh token (bearer transport / mobile). No-op on web, where the
 * refresh token is an HttpOnly cookie and never appears in the response body.
 */
export async function persistRefreshToken(token: string | undefined): Promise<void> {
  if (token) await getApiConfig().refreshTokenStore?.save(token);
}

export async function login(body: LoginRequest): Promise<LoginResponse> {
  const result = await apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body,
    skipAuthRetry: true,
  });
  // 2FA case: no session yet — only a challenge token. The caller routes to the verify
  // step; the access (and refresh) token is set later by `useTotpVerify`.
  if (result.access_token) {
    setAccessToken(result.access_token);
    await persistRefreshToken(result.refresh_token);
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
  const store = getApiConfig().refreshTokenStore;
  try {
    // Mobile presents the refresh token in the body (no cookie); web sends nothing and the
    // server reads the cookie. Either way the family is revoked server-side.
    const stored = (await store?.load()) ?? null;
    await apiFetch('/auth/logout', {
      method: 'POST',
      body: stored ? { refresh_token: stored } : undefined,
      skipAuthRetry: true,
    });
  } finally {
    clearAccessToken();
    await store?.clear();
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
