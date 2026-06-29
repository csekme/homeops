/**
 * Session token side-effects for the generated client.
 *
 * The generated react-query hooks are pure data calls — they don't touch the token store.
 * Rather than wrap each auth mutation, we centralize token persistence in a `MutationCache`
 * `onSuccess`: any response carrying an `access_token` (login, totp verify, household
 * create/switch, invite accept) seeds the in-memory token (and, on bearer transport, the
 * refresh-token store); logout clears them. Refresh-on-401 and session-expiry stay in
 * `http.ts`. Hosts pass this cache when constructing their `QueryClient`.
 */

import { MutationCache } from '@tanstack/react-query';

import { getApiConfig } from './config';
import { clearAccessToken, notifySessionEstablished, setAccessToken } from './token-store';

interface MaybeSession {
  access_token?: string;
  refresh_token?: string;
  device_id?: string;
  device_trust?: string;
}

export function createSessionMutationCache(): MutationCache {
  return new MutationCache({
    onSuccess: (data, _variables, _context, mutation) => {
      const key = mutation.options.mutationKey?.[0];

      if (key === 'logout') {
        clearAccessToken();
        void getApiConfig().refreshTokenStore?.clear();
        return;
      }

      const body = data as MaybeSession | undefined;
      if (body && typeof body === 'object' && body.access_token) {
        setAccessToken(body.access_token);
        const cfg = getApiConfig();
        // Bearer transport (mobile): persist the rotated refresh token; web uses a cookie.
        if (body.refresh_token) void cfg.refreshTokenStore?.save(body.refresh_token);
        // Device secrets (feature plan §Device): persist a newly minted identity and any
        // granted/rotated trust so subsequent logins can skip 2FA. Web gets HttpOnly cookies.
        if (body.device_id) void cfg.deviceIdStore?.save(body.device_id);
        if (body.device_trust) void cfg.deviceTrustStore?.save(body.device_trust);
        // A fresh session: let the host drop any stale logged-out `me` so the route guard
        // refetches instead of bouncing the just-authenticated user back to /login.
        notifySessionEstablished();
      }
    },
  });
}
