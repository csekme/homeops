import { useTranslation } from 'react-i18next';

import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { GlobeIcon } from '@/components/ui/icon';

/**
 * HU/EN language toggle (phase0-mobile §10). Only two languages are supported, so this
 * cycles between them on press via `i18n.changeLanguage` (persisted by `lib/i18n`).
 */
export function LanguageToggle() {
  const { t, i18n } = useTranslation();
  const current = i18n.resolvedLanguage ?? i18n.language;
  const next = current === 'hu' ? 'en' : 'hu';

  return (
    <Button
      variant="ghost"
      size="sm"
      onPress={() => void i18n.changeLanguage(next)}
      accessibilityLabel={t('languageToggle')}
    >
      <ButtonIcon as={GlobeIcon} />
      <ButtonText className="uppercase">{current}</ButtonText>
    </Button>
  );
}
