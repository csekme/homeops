/**
 * Two-factor (TOTP) API functions + TanStack Query hooks (feature plan §Frontend.3).
 *
 * Mirrors the hand-written `auth.ts` shape (INTERIM, Phase 0). `useTotpVerify` completes
 * login step 2: on success it stores the access token and seeds the `me` cache, exactly
 * like `useLogin` does for the single-step path.
 */

import type {
  LoginResponse,
  RecoveryCodesResponse,
  RecoveryRegenerateRequest,
  TotpConfirmRequest,
  TotpDisableRequest,
  TotpSetupResponse,
  TotpStatusResponse,
  TotpVerifyRequest,
} from '@homeops/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { meQueryKey } from './auth';
import { apiFetch } from './http';
import { setAccessToken } from './token-store';

export function totpSetup(): Promise<TotpSetupResponse> {
  return apiFetch('/auth/totp/setup', { method: 'POST' });
}

export function totpConfirm(body: TotpConfirmRequest): Promise<RecoveryCodesResponse> {
  return apiFetch('/auth/totp/confirm', { method: 'POST', body });
}

export function totpDisable(body: TotpDisableRequest): Promise<void> {
  return apiFetch('/auth/totp/disable', { method: 'POST', body });
}

export function regenerateRecovery(
  body: RecoveryRegenerateRequest,
): Promise<RecoveryCodesResponse> {
  return apiFetch('/auth/totp/recovery/regenerate', { method: 'POST', body });
}

export function fetchTotpStatus(): Promise<TotpStatusResponse> {
  return apiFetch('/auth/totp/status');
}

export async function totpVerify(body: TotpVerifyRequest): Promise<LoginResponse> {
  // Unauthenticated like login: the challenge token in the body is the credential.
  const result = await apiFetch<LoginResponse>('/auth/totp/verify', {
    method: 'POST',
    body,
    skipAuthRetry: true,
  });
  if (result.access_token) setAccessToken(result.access_token);
  return result;
}

export const totpStatusQueryKey = ['auth', 'totp', 'status'] as const;

export function useTotpStatus(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: totpStatusQueryKey,
    queryFn: fetchTotpStatus,
    retry: false,
    ...options,
  });
}

export function useTotpSetup() {
  return useMutation({ mutationFn: totpSetup });
}

export function useTotpConfirm() {
  // NOTE: intentionally does NOT invalidate the status query here. Doing so would flip
  // `enabled` to true and unmount the enrollment dialog before its recovery-codes step
  // can render. The wizard refreshes the status when its dialog closes instead.
  return useMutation({ mutationFn: totpConfirm });
}

export function useTotpDisable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: totpDisable,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: totpStatusQueryKey }),
  });
}

export function useRegenerateRecovery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: regenerateRecovery,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: totpStatusQueryKey }),
  });
}

export function useTotpVerify() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: totpVerify,
    onSuccess: (data) => {
      if (data.user) queryClient.setQueryData(meQueryKey, data.user);
    },
  });
}
