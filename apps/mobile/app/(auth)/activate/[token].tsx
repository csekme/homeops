import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AuthShell } from '@/components/auth-shell';
import { Button, ButtonText } from '@/components/ui/button';
import { Center } from '@/components/ui/center';
import { CheckCircleIcon, CloseCircleIcon, Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useActivation } from '@/features/auth/use-activation';

/**
 * Account activation (phase0-mobile §7/§11). Reached via the deep link
 * `homeops://activate/<token>` from the activation email; runs the activation once and
 * renders the derived status.
 */
export default function ActivateScreen() {
  const { t } = useTranslation('auth');
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();
  const status = useActivation(token);

  if (status === 'pending') {
    return (
      <AuthShell title={t('activate.title')}>
        <Center>
          <VStack space="md" className="items-center py-4">
            <Spinner size="large" />
            <Text className="text-muted-foreground">{t('activate.pending')}</Text>
          </VStack>
        </Center>
      </AuthShell>
    );
  }

  const ok = status === 'success';
  return (
    <AuthShell title={t('activate.title')}>
      <VStack space="lg">
        <Center>
          <VStack space="md" className="items-center">
            <Icon
              as={ok ? CheckCircleIcon : CloseCircleIcon}
              className={ok ? 'h-10 w-10 text-primary' : 'h-10 w-10 text-destructive'}
            />
            <Text className="text-center text-muted-foreground">
              {ok ? t('activate.success') : t('activate.error')}
            </Text>
          </VStack>
        </Center>
        <Button variant={ok ? 'default' : 'outline'} onPress={() => router.replace('/login')}>
          <ButtonText>{t('login.submit')}</ButtonText>
        </Button>
      </VStack>
    </AuthShell>
  );
}
