/**
 * Refresh-token persistence backed by `expo-secure-store` (iOS Keychain / Android Keystore),
 * plan §M.4 / §8.1. This is the mobile implementation of the api-client `SessionPersistence`
 * seam: the access token stays in memory, the refresh token lives ONLY here — never
 * AsyncStorage, never a log.
 */
import type { SessionPersistence } from '@homeops/api-client';
import * as SecureStore from 'expo-secure-store';

const REFRESH_KEY = 'homeops.refresh';

export const secureStorePersistence: SessionPersistence = {
  async loadRefreshToken() {
    return SecureStore.getItemAsync(REFRESH_KEY);
  },
  async saveRefreshToken(token) {
    // eslint-disable-next-line security/detect-possible-timing-attacks -- null check, not a secret comparison
    if (token === null) {
      await SecureStore.deleteItemAsync(REFRESH_KEY);
    } else {
      await SecureStore.setItemAsync(REFRESH_KEY, token);
    }
  },
};
