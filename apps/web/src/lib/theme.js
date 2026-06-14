import { createContext, useContext, useEffect, useMemo, useState } from 'react';
const STORAGE_KEY = 'homeops.theme';
const ThemeContext = createContext(null);
function readStoredTheme() {
    if (typeof window === 'undefined')
        return 'system';
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
}
function systemPrefersDark() {
    return (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
}
export function ThemeProvider({ children }) {
    const [theme, setThemeState] = useState(() => readStoredTheme());
    const [systemDark, setSystemDark] = useState(() => systemPrefersDark());
    useEffect(() => {
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const onChange = (event) => setSystemDark(event.matches);
        media.addEventListener('change', onChange);
        return () => media.removeEventListener('change', onChange);
    }, []);
    const resolvedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
    useEffect(() => {
        const root = document.documentElement;
        root.classList.toggle('dark', resolvedTheme === 'dark');
    }, [resolvedTheme]);
    const value = useMemo(() => {
        const setTheme = (next) => {
            window.localStorage.setItem(STORAGE_KEY, next);
            setThemeState(next);
        };
        return {
            theme,
            resolvedTheme,
            setTheme,
            toggleTheme: () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'),
        };
    }, [theme, resolvedTheme]);
    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx)
        throw new Error('useTheme must be used within ThemeProvider');
    return ctx;
}
