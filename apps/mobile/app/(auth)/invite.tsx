import { Link, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AuthShell } from '@/components/auth-shell';
import { IconBadge } from '@/components/icon-badge';
import { Badge, BadgeText } from '@/components/ui/badge';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

/**
 * Invite acceptance placeholder (plan §U1 / §M.10). The household-invite flow is completed in
 * Phase 1; Phase 0 only reserves the deep-link route `homeops://invite/<token>` and shows a
 * friendly "coming soon" surface.
 */
export default function InviteScreen() {
  const { t } = useTranslation(['auth', 'common']);
  const { token } = useLocalSearchParams<{ token?: string }>();

  return (
    <AuthShell title={t('common:households')}>
      <VStack space="lg" className="items-center">
        <IconBadge name="people-outline" size="lg" />
        <Badge action="info" variant="solid" className="rounded-full">
          <BadgeText>{t('common:comingSoon')}</BadgeText>
        </Badge>
        <Text className="text-center text-muted-foreground">
          {token
            ? 'Your household invite is ready. Accepting invites lands in Phase 1.'
            : 'Household invites are completed in Phase 1.'}
        </Text>
        <Link href="/login">
          <Text className="font-semibold text-primary">{t('auth:login.title')}</Text>
        </Link>
      </VStack>
    </AuthShell>
  );
}
