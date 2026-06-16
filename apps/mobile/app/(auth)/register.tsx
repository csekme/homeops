import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AuthShell } from '@/components/auth-shell';
import { FormField } from '@/components/form-field';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useRegisterForm } from '@/features/auth/use-register-form';

export default function RegisterScreen() {
  const { t } = useTranslation('auth');
  const { form, onSubmit, isPending, isSuccess } = useRegisterForm();
  const { errors } = form.formState;

  if (isSuccess) {
    return (
      <AuthShell title={t('register.title')}>
        <VStack space="lg">
          <Card>
            <Text className="text-center text-typography-700">{t('register.checkEmail')}</Text>
          </Card>
          <Link href="/login" className="items-center">
            <Text className="font-semibold text-primary-600">{t('register.loginLink')}</Text>
          </Link>
        </VStack>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t('register.title')}>
      <VStack space="lg">
        <FormField
          control={form.control}
          name="displayName"
          label={t('register.displayName')}
          errorMessage={errors.displayName?.message}
        />
        <FormField
          control={form.control}
          name="email"
          label={t('register.email')}
          errorMessage={errors.email?.message}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <FormField
          control={form.control}
          name="password"
          label={t('register.password')}
          errorMessage={errors.password?.message}
          type="password"
          autoComplete="password-new"
        />

        <Button onPress={onSubmit} isDisabled={isPending}>
          {isPending ? <ButtonSpinner /> : <ButtonText>{t('register.submit')}</ButtonText>}
        </Button>

        <HStack space="xs" className="justify-center">
          <Text className="text-typography-500">{t('register.hasAccount')}</Text>
          <Link href="/login">
            <Text className="font-semibold text-primary-600">{t('register.loginLink')}</Text>
          </Link>
        </HStack>
      </VStack>
    </AuthShell>
  );
}
