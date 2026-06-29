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
  setOnSessionEstablished,
  setOnSessionExpired,
} from '@homeops/api-client';
import { Platform } from 'react-native';

import { queryClient } from './query';
import { secureDeviceIdStore, secureDeviceTrustStore } from './secure-device-store';
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
  // Device registration + "remember me" (feature plan §Device): the identity + 2FA-bypass
  // secrets ride in headers (web uses cookies) and persist in the keychain. The platform is
  // reported so the backend labels the device and applies the right CHECK.
  deviceIdStore: secureDeviceIdStore,
  deviceTrustStore: secureDeviceTrustStore,
  devicePlatform: Platform.OS === 'ios' ? 'ios' : 'android',
});

/**
 * Drop the local session: wipe the in-memory access token + keychain refresh token and mark
 * `me` as null so the route guard redirects to the login stack. Used both on refresh failure
 * and on explicit logout — the bearer transport keeps no cookie, so the client must clear
 * itself (the logout endpoint only revokes server-side). Setting (not removing) the cache
 * keeps it fresh and avoids a refetch loop.
 */
export function clearSession() {
  clearAccessToken();
  void secureRefreshStore.clear();
  queryClient.setQueryData(getGetMeQueryKey(), null);
}

setOnSessionExpired(clearSession);

// A fresh login / 2FA-verify minted a session. `clearSession` (above) may have cached a stale
// `me = null` that, while still "fresh" (staleTime), would bounce the just-authenticated user
// back to the login stack. Drop a null `me` so the guard refetches; refetch a cached user.
setOnSessionEstablished(() => {
  const key = getGetMeQueryKey();
  if (queryClient.getQueryData(key)) {
    void queryClient.invalidateQueries({ queryKey: key });
  } else {
    queryClient.removeQueries({ queryKey: key });
  }
});
