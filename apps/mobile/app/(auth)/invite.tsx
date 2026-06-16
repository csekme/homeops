import { Link, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AuthShell } from '@/components/auth-shell';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

/**
 * Invite acceptance placeholder (plan §U1 / §M.10). The household-invite flow is completed
 * in Phase 1; Phase 0 only reserves the deep-link route `homeops://invite/<token>`.
 */
export default function InviteScreen() {
  const { t } = useTranslation('auth');
  const { token } = useLocalSearchParams<{ token?: string }>();

  return (
    <AuthShell title={t('register.title')}>
      <VStack space="lg">
        <Card>
          <VStack space="xs">
            <Text className="text-typography-900">
              {token ? `Invite token: ${token}` : 'No invite token.'}
            </Text>
            <Text className="text-typography-500">
              Household invites are completed in Phase 1.
            </Text>
          </VStack>
        </Card>
        <Link href="/login" className="items-center">
          <Text className="font-semibold text-primary-600">{t('login.title')}</Text>
        </Link>
      </VStack>
    </AuthShell>
  );
}
