import { useTranslation } from 'react-i18next';

import { AppIcon } from '@/components/app-icon';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/lib/theme';

/** Light ⇄ dark toggle (mirrors web). */
export function ThemeToggle() {
  const { t } = useTranslation('common');
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <Button
      variant="outline"
      action="secondary"
      size="sm"
      accessibilityLabel={t('themeToggle')}
      onPress={toggleTheme}
    >
      <AppIcon
        name={resolvedTheme === 'dark' ? 'sunny-outline' : 'moon-outline'}
        size={18}
        className="text-muted-foreground"
      />
    </Button>
  );
}
