import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';

/** Full-screen boot splash shown while the silent refresh is in flight (phase0-mobile §6). */
export function Splash() {
  const { t } = useTranslation();
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-background">
      <Spinner size="large" />
      <Text className="text-sm text-muted-foreground">{t('loading')}</Text>
    </View>
  );
}
