/**
 * API-client configuration for mobile (phase0-mobile §4/§6).
 *
 * The shared `@homeops/api-client` is transport-agnostic; here we select the BEARER
 * transport: the refresh token rides in the request body (not a cookie) and is stored
 * in the OS keychain via `secureRefreshStore`. Imported once for side-effects from the
 * root layout, before any screen renders.
 */
import {
  clearAccessToken,
  configureApiClient,
  getGetMeQueryKey,
  setOnSessionExpired,
} from '@homeops/api-client';

import { queryClient } from './query';
import { secureRefreshStore } from './secure-refresh-store';

/**
 * Absolute API origin. A device/emulator can't reach the web app's relative `/api`, so
 * this must point at the backend behind the dev reverse proxy. Override per environment
 * with `EXPO_PUBLIC_API_URL` (e.g. the LAN IP, or `http://10.0.2.2/api` for the Android
 * emulator). See `apps/mobile/README.md`.
 */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://homeops.localhost/api';

configureApiClient({
  baseUrl: API_BASE_URL,
  // Bearer transport: no cookies, no CSRF; the refresh token is body-borne and lives in
  // expo-secure-store. `apiFetch` sends `X-Auth-Transport: bearer` on every request.
  includeCredentials: false,
  authTransport: 'bearer',
  readCsrfToken: () => null,
  refreshTokenStore: secureRefreshStore,
});

// When a refresh ultimately fails, drop the session: wipe the in-memory access token and
// the keychain refresh token, then mark `me` as null so the route guard redirects to the
// login stack. Setting (not removing) the cache keeps it fresh and avoids a refetch loop.
setOnSessionExpired(() => {
  clearAccessToken();
  void secureRefreshStore.clear();
  queryClient.setQueryData(getGetMeQueryKey(), null);
});
