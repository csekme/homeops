/**
 * Account activation (mirrors web): a query keyed by token so it runs once per token and is
 * cached. The token-keyed dedup is kept even though RN has no StrictMode double-mount, so the
 * behaviour matches web exactly.
 */
import { activate } from '@homeops/api-client';
import { useQuery } from '@tanstack/react-query';

export type ActivationStatus = 'pending' | 'success' | 'error';

export function useActivation(token: string | undefined): ActivationStatus {
  const query = useQuery({
    queryKey: ['auth', 'activate', token],
    queryFn: () => activate({ token: token as string }),
    enabled: Boolean(token),
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  if (!token || query.isError) return 'error';
  if (query.isSuccess) return 'success';
  return 'pending';
}
