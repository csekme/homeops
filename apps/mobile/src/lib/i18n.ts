/**
 * react-i18next init from the shared `@homeops/i18n` config (plan §M2), the RN counterpart
 * of `apps/web/src/lib/i18n.ts`. The chosen language is persisted in AsyncStorage (the
 * language is a preference, not a secret, so secure-store is unnecessary). Boot loads the
 * stored language asynchronously; until then the fallback (HU) is used.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fallbackLng, i18nConfig, supportedLngs } from '@homeops/i18n';
import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const STORAGE_KEY = 'homeops.lang';

function deviceLanguage(): string {
  const tag = Localization.getLocales()[0]?.languageCode ?? fallbackLng;
  return (supportedLngs as readonly string[]).includes(tag) ? tag : fallbackLng;
}

void i18n.use(initReactI18next).init({
  ...i18nConfig,
  lng: fallbackLng,
});

i18n.on('languageChanged', (lng) => {
  void AsyncStorage.setItem(STORAGE_KEY, lng);
});

/** Resolve the persisted (or device) language and apply it. Call once during boot. */
export async function loadStoredLanguage(): Promise<void> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  const lng =
    stored && (supportedLngs as readonly string[]).includes(stored) ? stored : deviceLanguage();
  if (lng !== i18n.resolvedLanguage) {
    await i18n.changeLanguage(lng);
  }
}

export default i18n;
