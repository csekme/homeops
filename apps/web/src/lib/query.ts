import { createSessionMutationCache } from '@homeops/api-client';
import { QueryClient } from '@tanstack/react-query';

/** Single QueryClient for the app. Server state lives here (plan §3.12).
 *
 * The session MutationCache centralizes token side-effects for the generated hooks: any
 * mutation whose response carries an `access_token` (login, totp verify, household
 * create/switch, invite accept) seeds the in-memory token; logout clears it. */
export const queryClient = new QueryClient({
  mutationCache: createSessionMutationCache(),
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});
