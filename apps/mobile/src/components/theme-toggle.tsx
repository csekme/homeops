import { useTranslation } from 'react-i18next';

import { Button, ButtonText } from '@/components/ui/button';
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
      <ButtonText>{resolvedTheme === 'dark' ? '☀️' : '🌙'}</ButtonText>
    </Button>
  );
}
