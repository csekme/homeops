import { fallbackLng, i18nConfig, supportedLngs } from '@homeops/i18n';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
/**
 * react-i18next initialised from the shared @homeops/i18n config (plan §3.12).
 * HU is default + fallback; the user's choice is persisted in localStorage.
 */
const STORAGE_KEY = 'homeops.lang';
function initialLanguage() {
    if (typeof window === 'undefined')
        return fallbackLng;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored && supportedLngs.includes(stored) ? stored : fallbackLng;
}
void i18n.use(initReactI18next).init({
    ...i18nConfig,
    lng: initialLanguage(),
});
i18n.on('languageChanged', (lng) => {
    if (typeof window !== 'undefined')
        window.localStorage.setItem(STORAGE_KEY, lng);
    if (typeof document !== 'undefined')
        document.documentElement.lang = lng;
});
export default i18n;
