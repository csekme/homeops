import { useTranslation } from 'react-i18next';

import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

/** Phase-0 placeholder screen body (mirrors the web placeholder). */
export function Placeholder({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation('common');
  return (
    <VStack space="xs" className="flex-1 items-center justify-center bg-background-0 px-6">
      <Heading size="xl">{t(titleKey)}</Heading>
      <Text className="text-typography-500">{t('loading')}</Text>
    </VStack>
  );
}
