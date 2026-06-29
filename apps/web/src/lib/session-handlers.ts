/**
 * Wires the api-client session seams to the app's QueryClient (plan §3.12).
 *
 * Extracted from `main.tsx` so the behaviour is unit-testable: the route guard's
 * "don't bounce a just-logged-in user" rule lives entirely in the session-established
 * handler below, and a regression there is caught by `login-guard.test.tsx`.
 */
import {
  clearAccessToken,
  getGetMeQueryKey,
  setOnSessionEstablished,
  setOnSessionExpired,
  type SessionExpiredInfo,
} from '@homeops/api-client';
import type { QueryClient } from '@tanstack/react-query';

interface Options {
  /** Side effect for a *lost* session (e.g. a toast). The cache update is handled here. */
  onExpired?: (info: SessionExpiredInfo) => void;
}

export function installSessionHandlers(queryClient: QueryClient, { onExpired }: Options = {}): void {
  // A refresh ultimately failed → drop the session. Caching `me = null` (rather than
  // removing it) keeps it "fresh" so <RequireAuth> redirects without a refetch loop.
  setOnSessionExpired((info) => {
    clearAccessToken();
    queryClient.setQueryData(getGetMeQueryKey(), null);
    onExpired?.(info);
  });

  // A fresh login / 2FA-verify minted a session. The expiry handler above may have cached a
  // stale `me = null` (still "fresh" for staleTime) that would otherwise make the guard
  // bounce the just-authenticated user back to /login. Drop a null `me` so the guard
  // refetches (Splash → app); refetch a real cached user in the background (e.g. on a
  // household switch) without flashing the splash.
  setOnSessionEstablished(() => {
    const key = getGetMeQueryKey();
    if (queryClient.getQueryData(key)) {
      void queryClient.invalidateQueries({ queryKey: key });
    } else {
      queryClient.removeQueries({ queryKey: key });
    }
  });
}
