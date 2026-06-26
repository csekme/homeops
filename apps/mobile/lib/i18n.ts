/**
 * react-i18next, initialised from the shared `@homeops/i18n` config (phase0-mobile §10).
 *
 * HU is the default + fallback; the initial language is detected from the device locale
 * via expo-localization. The user's in-session choice (LanguageToggle) is persisted to
 * the OS keychain so it survives restarts. Mirrors `apps/web/src/lib/i18n.ts`.
 */
import { fallbackLng, i18nConfig, supportedLngs } from '@homeops/i18n';
import { getLocales } from 'expo-localization';
import * as SecureStore from 'expo-secure-store';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const STORAGE_KEY = 'homeops.lang';

function deviceLanguage(): string {
  const code = getLocales()[0]?.languageCode ?? fallbackLng;
  return (supportedLngs as readonly string[]).includes(code) ? code : fallbackLng;
}

void i18n.use(initReactI18next).init({
  ...i18nConfig,
  lng: deviceLanguage(),
});

// Apply a previously persisted choice once it loads (async); overrides device detection.
void SecureStore.getItemAsync(STORAGE_KEY).then((stored) => {
  if (stored && (supportedLngs as readonly string[]).includes(stored) && stored !== i18n.language) {
    void i18n.changeLanguage(stored);
  }
});

i18n.on('languageChanged', (lng) => {
  void SecureStore.setItemAsync(STORAGE_KEY, lng);
});

export default i18n;
