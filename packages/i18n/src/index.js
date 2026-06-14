import huCommon from "./locales/hu/common.json" with { type: "json" };
import huAuth from "./locales/hu/auth.json" with { type: "json" };
import huDashboard from "./locales/hu/dashboard.json" with { type: "json" };
import huObligations from "./locales/hu/obligations.json" with { type: "json" };
import huExpenses from "./locales/hu/expenses.json" with { type: "json" };
import huServices from "./locales/hu/services.json" with { type: "json" };
import huValidation from "./locales/hu/validation.json" with { type: "json" };
import enCommon from "./locales/en/common.json" with { type: "json" };
import enAuth from "./locales/en/auth.json" with { type: "json" };
import enDashboard from "./locales/en/dashboard.json" with { type: "json" };
import enObligations from "./locales/en/obligations.json" with { type: "json" };
import enExpenses from "./locales/en/expenses.json" with { type: "json" };
import enServices from "./locales/en/services.json" with { type: "json" };
import enValidation from "./locales/en/validation.json" with { type: "json" };
export const supportedLngs = ["hu", "en"];
export const fallbackLng = "hu";
export const ns = [
    "common",
    "auth",
    "dashboard",
    "obligations",
    "expenses",
    "services",
    "validation",
];
export const defaultNS = "common";
/** Translation bundles, grouped by language → namespace. */
export const resources = {
    hu: {
        common: huCommon,
        auth: huAuth,
        dashboard: huDashboard,
        obligations: huObligations,
        expenses: huExpenses,
        services: huServices,
        validation: huValidation,
    },
    en: {
        common: enCommon,
        auth: enAuth,
        dashboard: enDashboard,
        obligations: enObligations,
        expenses: enExpenses,
        services: enServices,
        validation: enValidation,
    },
};
/** Ready-to-init i18next config. */
export const i18nConfig = {
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
