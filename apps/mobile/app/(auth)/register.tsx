import { Link, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AuthShell } from '@/components/auth-shell';
import { TextField } from '@/components/text-field';
import { Alert, AlertIcon, AlertText } from '@/components/ui/alert';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Center } from '@/components/ui/center';
import { HStack } from '@/components/ui/hstack';
import { AlertCircleIcon, CheckCircleIcon, Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useRegisterForm } from '@/features/auth/use-register-form';

export default function RegisterScreen() {
  const { t } = useTranslation('auth');
  const router = useRouter();
  const { form, onSubmit, isPending, isError, isSuccess } = useRegisterForm();
  const { errors } = form.formState;

  if (isSuccess) {
    return (
      <AuthShell title={t('register.title')}>
        <VStack space="lg">
          <Center>
            <VStack space="md" className="items-center">
              <Icon as={CheckCircleIcon} className="h-10 w-10 text-primary" />
              <Text className="text-center text-muted-foreground">{t('register.checkEmail')}</Text>
            </VStack>
          </Center>
          <Button variant="outline" onPress={() => router.replace('/login')}>
            <ButtonText>{t('register.loginLink')}</ButtonText>
          </Button>
        </VStack>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={t('register.title')}
      footer={
        <HStack space="xs" className="items-center">
          <Text className="text-muted-foreground">{t('register.hasAccount')}</Text>
          <Link href="/login">
            <Text className="font-medium text-primary">{t('register.loginLink')}</Text>
          </Link>
        </HStack>
      }
    >
      <VStack space="lg">
        {isError ? (
          <Alert variant="destructive">
            <AlertIcon as={AlertCircleIcon} />
            <AlertText>{t('errors.generic')}</AlertText>
          </Alert>
        ) : null}

        <TextField
          control={form.control}
          name="displayName"
          label={t('register.displayName')}
          errorMessage={errors.displayName?.message}
          autoComplete="name"
          textContentType="name"
        />

        <TextField
          control={form.control}
          name="email"
          label={t('register.email')}
          errorMessage={errors.email?.message}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
        />

        <TextField
          control={form.control}
          name="password"
          label={t('register.password')}
          errorMessage={errors.password?.message}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
        />

        <TextField
          control={form.control}
          name="confirmPassword"
          label={t('register.confirmPassword')}
          errorMessage={errors.confirmPassword?.message}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
        />

        <Button onPress={onSubmit} isDisabled={isPending}>
          {isPending ? <ButtonSpinner /> : null}
          <ButtonText>{t('register.submit')}</ButtonText>
        </Button>
      </VStack>
    </AuthShell>
  );
}
