import { createSessionMutationCache } from '@homeops/api-client';
import { QueryClient } from '@tanstack/react-query';

/** Single QueryClient for the mobile app. Mirrors the web app's defaults (plan §3.12).
 * The session MutationCache persists tokens for the generated hooks (login/totp/switch/
 * create/accept seed the in-memory + secure-store tokens; logout clears them). */
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
