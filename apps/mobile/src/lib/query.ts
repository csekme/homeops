import { QueryClient } from '@tanstack/react-query';

/**
 * Single QueryClient for the app — same options as the web (`apps/web/src/lib/query.ts`),
 * so server-state behaviour (no retry, 30s stale) is identical across platforms. There is
 * no window-focus refetch on RN; the option is harmless and kept for parity.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});
