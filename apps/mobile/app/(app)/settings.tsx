import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { Heading } from '@/components/ui/heading';
import { TwoFactorCard } from '@/features/security/two-factor-card';

/** Settings → Security (plan §U3). Profile tab is a Phase-1 placeholder; Security is live. */
export default function SettingsScreen() {
  const { t } = useTranslation('settings');

  return (
    <ScrollView className="flex-1 bg-background-0" contentContainerClassName="gap-4 p-4">
      <Heading size="2xl">{t('title')}</Heading>
      <TwoFactorCard />
    </ScrollView>
  );
}
