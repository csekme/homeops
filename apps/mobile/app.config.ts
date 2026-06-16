import type { ExpoConfig } from 'expo/config';

/**
 * Expo app config (plan §M.1, §M.9). Custom scheme `homeops://` powers the activation /
 * invite deep links (`homeops://activate/:token`). `expo-router` owns navigation; the
 * `expo-secure-store` plugin wires Keychain/Keystore for the refresh token.
 */
const config: ExpoConfig = {
  name: 'HomeOps',
  slug: 'homeops',
  scheme: 'homeops',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'app.homeops.mobile',
  },
  android: {
    package: 'app.homeops.mobile',
  },
  plugins: ['expo-router', 'expo-secure-store', 'expo-font', 'expo-localization'],
  experiments: {
    typedRoutes: true,
  },
};

export default config;
