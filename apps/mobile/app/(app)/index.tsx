import { useMe } from '@homeops/api-client';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { Card } from '@/components/ui/card';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

/** Dashboard placeholder (plan §U2 / §1) — business widgets land in Phase 1. */
export default function DashboardScreen() {
  const { t } = useTranslation('common');
  const { data } = useMe();

  return (
    <ScrollView className="flex-1 bg-background-0" contentContainerClassName="gap-4 p-4">
      <Heading size="2xl">{t('nav.dashboard')}</Heading>
      <Card>
        <VStack space="xs">
          <Heading size="md">{data?.display_name ?? data?.email ?? ''}</Heading>
          <Text className="text-typography-500">{t('loading')}</Text>
        </VStack>
      </Card>
    </ScrollView>
  );
}
