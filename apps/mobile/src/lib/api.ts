/**
 * api-client configuration for mobile (plan §M2). One shared `@homeops/api-client`, here
 * wired to the BODY refresh strategy:
 *  - access token in memory, refresh token in `expo-secure-store` (no cookie jar),
 *  - `X-Client-Type: mobile` so the backend returns the refresh token in the body,
 *  - `credentials: 'omit'` (nothing ambient to send) → no CSRF (plan §M.5).
 *
 * The session-expired seam clears the cache, wipes the persisted refresh, and bounces to
 * the login route — with a toast only when the user was actually signed in (a silent boot
 * probe must not flash "session expired").
 */
import { configureApiClient, setOnSessionExpired, setSessionPersistence } from '@homeops/api-client';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { toast } from 'sonner-native';

import i18n from './i18n';
import { queryClient } from './query';
import { secureStorePersistence } from './secure-store';

function resolveBaseUrl(): string {
  const origin =
    process.env.EXPO_PUBLIC_API_BASE ??
    (Constants.expoConfig?.extra?.apiBase as string | undefined) ??
    '';
  const trimmed = origin.replace(/\/+$/, '');
  return `${trimmed}/api`;
}

let configured = false;

/** Configure the api-client + persistence + session-expired handler. Call once at boot. */
export function configureApi(): void {
  if (configured) return;
  configured = true;

  configureApiClient({
    baseUrl: resolveBaseUrl(),
    credentials: 'omit',
    refreshStrategy: 'body',
    extraHeaders: { 'X-Client-Type': 'mobile' },
  });

  setSessionPersistence(secureStorePersistence);

  setOnSessionExpired(({ wasAuthenticated }) => {
    queryClient.clear();
    void secureStorePersistence.saveRefreshToken(null);
    if (wasAuthenticated) {
      toast.error(i18n.t('sessionExpired', { ns: 'common' }));
    }
    router.replace('/login');
  });
}
