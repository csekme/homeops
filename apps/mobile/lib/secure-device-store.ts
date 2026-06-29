/**
 * Device-secret stores backed by expo-secure-store (feature plan §Device registration).
 *
 * Two separate secrets, mirroring the web's two HttpOnly cookies: a stable device IDENTITY
 * (recognises this device for the session list) and a rotating 2FA-bypass TRUST secret. Both
 * live in the OS keychain/keystore — never AsyncStorage. They deliberately OUTLIVE a logout
 * (so a still-trusted device can skip 2FA on the next sign-in); only revoking *this* device
 * clears them via `clearDeviceSecrets`.
 */
import type { DeviceSecretStore } from '@homeops/api-client';
import * as SecureStore from 'expo-secure-store';

const DEVICE_ID_KEY = 'homeops.device_id';
const DEVICE_TRUST_KEY = 'homeops.device_trust';

function secureStore(key: string): DeviceSecretStore {
  return {
    async load(): Promise<string | null> {
      return (await SecureStore.getItemAsync(key)) ?? null;
    },
    async save(token: string): Promise<void> {
      await SecureStore.setItemAsync(key, token);
    },
    async clear(): Promise<void> {
      await SecureStore.deleteItemAsync(key);
    },
  };
}

export const secureDeviceIdStore = secureStore(DEVICE_ID_KEY);
export const secureDeviceTrustStore = secureStore(DEVICE_TRUST_KEY);

/** Forget this device entirely (used when the user revokes the current device). */
export async function clearDeviceSecrets(): Promise<void> {
  await Promise.all([secureDeviceIdStore.clear(), secureDeviceTrustStore.clear()]);
}
