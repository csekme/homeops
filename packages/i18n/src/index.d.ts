/**
 * i18next configuration and translation bundles for HomeOps.
 *
 * HU is the default and fallback language; EN is the secondary language. This
 * package is framework-agnostic — `react-i18next` lives in the web app, not
 * here. Pass `i18nConfig` straight to `i18next.init`.
 */
import type { InitOptions } from "i18next";
export declare const supportedLngs: readonly ["hu", "en"];
export type SupportedLanguage = (typeof supportedLngs)[number];
export declare const fallbackLng: "hu";
export declare const ns: readonly ["common", "auth", "dashboard", "obligations", "expenses", "services", "validation"];
export type Namespace = (typeof ns)[number];
export declare const defaultNS: "common";
/** Translation bundles, grouped by language → namespace. */
export declare const resources: {
    readonly hu: {
        readonly common: {
            appName: string;
            loading: string;
            save: string;
            cancel: string;
            logout: string;
            languageToggle: string;
            themeToggle: string;
            households: string;
            nav: {
                dashboard: string;
                obligations: string;
                expenses: string;
                services: string;
                documents: string;
                settings: string;
            };
        };
        readonly auth: {
            login: {
                title: string;
                email: string;
                password: string;
                submit: string;
                noAccount: string;
                registerLink: string;
            };
            register: {
                title: string;
                email: string;
                password: string;
                displayName: string;
                submit: string;
                checkEmail: string;
                hasAccount: string;
                loginLink: string;
            };
            activate: {
                title: string;
                success: string;
                pending: string;
                error: string;
            };
            errors: {
                invalidCredentials: string;
                notActivated: string;
                generic: string;
            };
        };
        readonly dashboard: {
            title: string;
            greeting: string;
            upcoming: string;
            overdue: string;
            monthlySpend: string;
            noUpcoming: string;
            financialHidden: string;
        };
        readonly obligations: {
            title: string;
            new: string;
            fields: {
                name: string;
                category: string;
                dueDate: string;
                recurrence: string;
                assignee: string;
                estimatedAmount: string;
                leadTime: string;
            };
            status: {
                upcoming: string;
                due: string;
                done: string;
                overdue: string;
                skipped: string;
            };
            actions: {
                complete: string;
                skip: string;
            };
            empty: string;
        };
        readonly expenses: {
            title: string;
            new: string;
            fields: {
                amount: string;
                currency: string;
                occurredOn: string;
                category: string;
                service: string;
            };
            summary: {
                total: string;
                thisMonth: string;
            };
            empty: string;
        };
        readonly services: {
            title: string;
            new: string;
            fields: {
                providerName: string;
                fee: string;
                currency: string;
                billingCycle: string;
                contractEnd: string;
                cancellationDeadline: string;
            };
            billingCycle: {
                weekly: string;
                monthly: string;
                quarterly: string;
                yearly: string;
                oneTime: string;
            };
            empty: string;
        };
        readonly validation: {
            required: string;
            email: string;
            minLength: string;
            maxLength: string;
            currency: string;
            integer: string;
            date: string;
            invalid: string;
        };
    };
    readonly en: {
        readonly common: {
            appName: string;
            loading: string;
            save: string;
            cancel: string;
            logout: string;
            languageToggle: string;
            themeToggle: string;
            households: string;
            nav: {
                dashboard: string;
                obligations: string;
                expenses: string;
                services: string;
                documents: string;
                settings: string;
            };
        };
        readonly auth: {
            login: {
                title: string;
                email: string;
                password: string;
                submit: string;
                noAccount: string;
                registerLink: string;
            };
            register: {
                title: string;
                email: string;
                password: string;
                displayName: string;
                submit: string;
                checkEmail: string;
                hasAccount: string;
                loginLink: string;
            };
            activate: {
                title: string;
                success: string;
                pending: string;
                error: string;
            };
            errors: {
                invalidCredentials: string;
                notActivated: string;
                generic: string;
            };
        };
        readonly dashboard: {
            title: string;
            greeting: string;
            upcoming: string;
            overdue: string;
            monthlySpend: string;
            noUpcoming: string;
            financialHidden: string;
        };
        readonly obligations: {
            title: string;
            new: string;
            fields: {
                name: string;
                category: string;
                dueDate: string;
                recurrence: string;
                assignee: string;
                estimatedAmount: string;
                leadTime: string;
            };
            status: {
                upcoming: string;
                due: string;
                done: string;
                overdue: string;
                skipped: string;
            };
            actions: {
                complete: string;
                skip: string;
            };
            empty: string;
        };
        readonly expenses: {
            title: string;
            new: string;
            fields: {
                amount: string;
                currency: string;
                occurredOn: string;
                category: string;
                service: string;
            };
            summary: {
                total: string;
                thisMonth: string;
            };
            empty: string;
        };
        readonly services: {
            title: string;
            new: string;
            fields: {
                providerName: string;
                fee: string;
                currency: string;
                billingCycle: string;
                contractEnd: string;
                cancellationDeadline: string;
            };
            billingCycle: {
                weekly: string;
                monthly: string;
                quarterly: string;
                yearly: string;
                oneTime: string;
            };
            empty: string;
        };
        readonly validation: {
            required: string;
            email: string;
            minLength: string;
            maxLength: string;
            currency: string;
            integer: string;
            date: string;
            invalid: string;
        };
    };
};
export type Resources = typeof resources;
/** Ready-to-init i18next config. */
export declare const i18nConfig: InitOptions;
export default i18nConfig;
