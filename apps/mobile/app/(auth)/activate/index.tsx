import { zodResolver } from '@hookform/resolvers/zod';
import { activateSchema, type ActivateInput } from '@homeops/validation';
import { Link, useRouter } from 'expo-router';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { AuthShell } from '@/components/auth-shell';
import { FormField } from '@/components/form-field';
import { Button, ButtonText } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

/**
 * Manual token-entry fallback (plan §8.5): the Mailpit activation link points at the web
 * origin, so in dev we paste the token here, then route to the deep-link screen to activate.
 */
export default function ActivateManualScreen() {
  const { t } = useTranslation('auth');
  const router = useRouter();
  const form = useForm<ActivateInput>({
    resolver: zodResolver(activateSchema),
    defaultValues: { token: '' },
  });

  const onSubmit = form.handleSubmit(({ token }) => {
    router.replace({ pathname: '/activate/[token]', params: { token } });
  });

  return (
    <AuthShell title={t('activate.title')}>
      <VStack space="lg">
        <FormField
          control={form.control}
          name="token"
          label={t('activate.title')}
          errorMessage={form.formState.errors.token?.message}
          icon="key-outline"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Button size="lg" className="rounded-xl" onPress={onSubmit}>
          <ButtonText>{t('login.submit')}</ButtonText>
        </Button>
        <Link href="/login" className="items-center">
          <Text className="font-semibold text-primary">{t('login.title')}</Text>
        </Link>
      </VStack>
    </AuthShell>
  );
}
