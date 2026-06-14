/**
 * Theme provider (plan §3.12). Toggles the `dark` class on <html> and persists
 * the user's choice in localStorage. Theme *preferences* may be persisted; only
 * the design TOKENS must never be stored client-side — those live in CSS.
 */
export type Theme = 'light' | 'dark' | 'system';
interface ThemeContextValue {
    theme: Theme;
    resolvedTheme: 'light' | 'dark';
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
}
export declare function ThemeProvider({ children }: {
    children: React.ReactNode;
}): import("react").JSX.Element;
export declare function useTheme(): ThemeContextValue;
export {};
