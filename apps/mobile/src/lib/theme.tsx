import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Appearance } from 'react-native';

/**
 * Theme provider (plan §M2) — the RN port of `apps/web/src/lib/theme.tsx`. The web toggles
 * a `dark` class on <html> + persists in localStorage; here we drive NativeWind's color
 * scheme (which flips the `dark:` CSS variables) off the `Appearance` API and persist the
 * preference in AsyncStorage. Only the PREFERENCE is stored — design tokens never are.
 */
export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'homeops.theme';

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [systemDark, setSystemDark] = useState<boolean>(
    () => Appearance.getColorScheme() === 'dark',
  );

  // Load the stored preference once.
  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setThemeState(stored);
      }
    });
  }, []);

  // Follow OS appearance changes (only matters while theme === 'system').
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemDark(colorScheme === 'dark');
    });
    return () => sub.remove();
  }, []);

  const resolvedTheme: 'light' | 'dark' =
    theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  // NativeWind's color scheme is driven by GluestackUIProvider (mode={theme}); this context
  // owns the persisted preference + the resolved value used for the status bar.

  const value = useMemo<ThemeContextValue>(() => {
    const setTheme = (next: Theme) => {
      void AsyncStorage.setItem(STORAGE_KEY, next);
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

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
