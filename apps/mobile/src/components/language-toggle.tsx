import { useTranslation } from 'react-i18next';

import { Button, ButtonText } from '@/components/ui/button';

/** HU ⇄ EN toggle (mirrors web); persists via i18n's languageChanged hook. */
export function LanguageToggle() {
  const { i18n, t } = useTranslation('common');
  const current = i18n.resolvedLanguage ?? i18n.language;
  const next = current === 'hu' ? 'en' : 'hu';

  return (
    <Button
      variant="outline"
      action="secondary"
      size="sm"
      accessibilityLabel={t('languageToggle')}
      onPress={() => void i18n.changeLanguage(next)}
    >
      <ButtonText className="uppercase">{current}</ButtonText>
    </Button>
  );
}
