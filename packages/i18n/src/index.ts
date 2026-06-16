/**
 * i18next configuration and translation bundles for HomeOps.
 *
 * HU is the default and fallback language; EN is the secondary language. This
 * package is framework-agnostic — `react-i18next` lives in the web app, not
 * here. Pass `i18nConfig` straight to `i18next.init`.
 */
import type { InitOptions } from "i18next";

import huCommon from "./locales/hu/common.json" with { type: "json" };
import huAuth from "./locales/hu/auth.json" with { type: "json" };
import huSettings from "./locales/hu/settings.json" with { type: "json" };
import huDashboard from "./locales/hu/dashboard.json" with { type: "json" };
import huObligations from "./locales/hu/obligations.json" with { type: "json" };
import huExpenses from "./locales/hu/expenses.json" with { type: "json" };
import huServices from "./locales/hu/services.json" with { type: "json" };
import huDocuments from "./locales/hu/documents.json" with { type: "json" };
import huValidation from "./locales/hu/validation.json" with { type: "json" };

import enCommon from "./locales/en/common.json" with { type: "json" };
import enAuth from "./locales/en/auth.json" with { type: "json" };
import enSettings from "./locales/en/settings.json" with { type: "json" };
import enDashboard from "./locales/en/dashboard.json" with { type: "json" };
import enObligations from "./locales/en/obligations.json" with { type: "json" };
import enExpenses from "./locales/en/expenses.json" with { type: "json" };
import enServices from "./locales/en/services.json" with { type: "json" };
import enDocuments from "./locales/en/documents.json" with { type: "json" };
import enValidation from "./locales/en/validation.json" with { type: "json" };

export const supportedLngs = ["hu", "en"] as const;
export type SupportedLanguage = (typeof supportedLngs)[number];

export const fallbackLng = "hu" as const;

export const ns = [
  "common",
  "auth",
  "settings",
  "dashboard",
  "obligations",
  "expenses",
  "services",
  "documents",
  "validation",
] as const;
export type Namespace = (typeof ns)[number];

export const defaultNS = "common" as const satisfies Namespace;

/** Translation bundles, grouped by language → namespace. */
export const resources = {
  hu: {
    common: huCommon,
    auth: huAuth,
    settings: huSettings,
    dashboard: huDashboard,
    obligations: huObligations,
    expenses: huExpenses,
    services: huServices,
    documents: huDocuments,
    validation: huValidation,
  },
  en: {
    common: enCommon,
    auth: enAuth,
    settings: enSettings,
    dashboard: enDashboard,
    obligations: enObligations,
    expenses: enExpenses,
    services: enServices,
    documents: enDocuments,
    validation: enValidation,
  },
} as const;

export type Resources = typeof resources;

/** Ready-to-init i18next config. */
export const i18nConfig: InitOptions = {
  resources,
  lng: fallbackLng,
  fallbackLng,
  supportedLngs: [...supportedLngs],
  defaultNS,
  ns: [...ns],
  interpolation: {
    // React already escapes output; other consumers can override.
    escapeValue: false,
  },
  returnNull: false,
};

export default i18nConfig;
