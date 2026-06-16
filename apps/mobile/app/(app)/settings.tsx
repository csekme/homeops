import { useTranslation } from 'react-i18next';

import { Screen, ScreenTitle } from '@/components/screen';
import { TwoFactorCard } from '@/features/security/two-factor-card';

/** Settings → Security (plan §U3). Profile tab is a Phase-1 placeholder; Security is live. */
export default function SettingsScreen() {
  const { t } = useTranslation('settings');

  return (
    <Screen>
      <ScreenTitle title={t('title')} />
      <TwoFactorCard />
    </Screen>
  );
}
