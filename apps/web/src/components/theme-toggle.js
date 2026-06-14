import { MoonIcon, SunIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/lib/theme';
/** Dark-mode toggle (plan §3.13). Swaps the resolved theme on click. */
export function ThemeToggle() {
    const { t } = useTranslation();
    const { resolvedTheme, toggleTheme } = useTheme();
    return (<Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={t('themeToggle')} title={t('themeToggle')}>
      {resolvedTheme === 'dark' ? (<SunIcon className="size-4"/>) : (<MoonIcon className="size-4"/>)}
    </Button>);
}
