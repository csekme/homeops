import { QueryClient } from '@tanstack/react-query';

/** Single QueryClient for the mobile app. Mirrors the web app's defaults (plan §3.12). */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});
