import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AuthShell } from '@/components/auth-shell';
import { IconBadge } from '@/components/icon-badge';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useActivation } from '@/features/auth/use-activation';

/** Runs token activation and renders the derived status (mirrors the web activate page). */
export function ActivationView({ token }: { token: string }) {
  const { t } = useTranslation('auth');
  const status = useActivation(token);

  return (
    <AuthShell title={t('activate.title')}>
      <VStack space="lg" className="items-center">
        {status === 'pending' ? (
          <>
            <Spinner size="large" />
            <Text className="text-center text-muted-foreground">{t('activate.pending')}</Text>
          </>
        ) : null}

        {status === 'success' ? (
          <>
            <IconBadge name="checkmark-circle-outline" tone="success" size="lg" />
            <Text className="text-center text-muted-foreground">{t('activate.success')}</Text>
          </>
        ) : null}

        {status === 'error' ? (
          <>
            <IconBadge name="alert-circle-outline" tone="error" size="lg" />
            <Text className="text-center text-muted-foreground">{t('activate.error')}</Text>
          </>
        ) : null}

        {status !== 'pending' ? (
          <Link href="/login">
            <Text className="font-semibold text-primary">{t('login.title')}</Text>
          </Link>
        ) : null}
      </VStack>
    </AuthShell>
  );
}
