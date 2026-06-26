/**
 * Refresh-token store backed by expo-secure-store (phase0-mobile §6).
 *
 * On mobile the refresh token is our long-lived credential (there is no HttpOnly
 * cookie), so it lives in the OS keychain/keystore — never in AsyncStorage or
 * memory-only. This adapter plugs into `configureApiClient({ refreshTokenStore })`;
 * the api-client persists the rotated token here after every login/refresh and
 * clears it on logout / session expiry.
 */
import type { RefreshTokenStore } from '@homeops/api-client';
import * as SecureStore from 'expo-secure-store';

const REFRESH_KEY = 'homeops.refresh_token';

export const secureRefreshStore: RefreshTokenStore = {
  async load(): Promise<string | null> {
    return (await SecureStore.getItemAsync(REFRESH_KEY)) ?? null;
  },
  async save(token: string): Promise<void> {
    await SecureStore.setItemAsync(REFRESH_KEY, token);
  },
  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  },
};
