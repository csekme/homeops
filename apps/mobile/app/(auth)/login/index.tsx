import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AuthShell } from '@/components/auth-shell';
import { FormAlert } from '@/components/form-alert';
import { FormField } from '@/components/form-field';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useLoginForm } from '@/features/auth/use-login-form';

export default function LoginScreen() {
  const { t } = useTranslation('auth');
  const { form, onSubmit, isPending, isError, errorKey } = useLoginForm();
  const { errors } = form.formState;

  return (
    <AuthShell title={t('login.title')}>
      <VStack space="lg">
        <FormField
          control={form.control}
          name="email"
          label={t('login.email')}
          errorMessage={errors.email?.message}
          icon="mail-outline"
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
        />
        <FormField
          control={form.control}
          name="password"
          label={t('login.password')}
          errorMessage={errors.password?.message}
          type="password"
          icon="lock-closed-outline"
          autoComplete="password"
          textContentType="password"
        />

        {isError ? <FormAlert message={t(errorKey)} /> : null}

        <Button size="lg" className="rounded-xl" onPress={onSubmit} isDisabled={isPending}>
          {isPending ? <ButtonSpinner /> : <ButtonText>{t('login.submit')}</ButtonText>}
        </Button>

        <HStack space="xs" className="justify-center">
          <Text className="text-muted-foreground">{t('login.noAccount')}</Text>
          <Link href="/register">
            <Text className="font-semibold text-primary">{t('login.registerLink')}</Text>
          </Link>
        </HStack>
      </VStack>
    </AuthShell>
  );
}
