import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AuthShell } from '@/components/auth-shell';
import { FormField } from '@/components/form-field';
import { IconBadge } from '@/components/icon-badge';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Center } from '@/components/ui/center';
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
        <VStack space="lg" className="items-center">
          <IconBadge name="mail-unread-outline" tone="success" size="lg" />
          <Text className="text-center text-muted-foreground">{t('register.checkEmail')}</Text>
          <Link href="/login" asChild>
            <Center>
              <Text className="font-semibold text-primary">{t('register.loginLink')}</Text>
            </Center>
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
          icon="person-outline"
        />
        <FormField
          control={form.control}
          name="email"
          label={t('register.email')}
          errorMessage={errors.email?.message}
          icon="mail-outline"
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
          icon="lock-closed-outline"
          autoComplete="password-new"
        />

        <Button size="lg" className="rounded-xl" onPress={onSubmit} isDisabled={isPending}>
          {isPending ? <ButtonSpinner /> : <ButtonText>{t('register.submit')}</ButtonText>}
        </Button>

        <HStack space="xs" className="justify-center">
          <Text className="text-muted-foreground">{t('register.hasAccount')}</Text>
          <Link href="/login">
            <Text className="font-semibold text-primary">{t('register.loginLink')}</Text>
          </Link>
        </HStack>
      </VStack>
    </AuthShell>
  );
}
