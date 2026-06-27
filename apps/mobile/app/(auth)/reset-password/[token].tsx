import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AuthShell } from '@/components/auth-shell';
import { TextField } from '@/components/text-field';
import { Alert, AlertIcon, AlertText } from '@/components/ui/alert';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Center } from '@/components/ui/center';
import { AlertCircleIcon, CheckCircleIcon, Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useResetPasswordForm } from '@/features/auth/use-reset-password-form';

/**
 * Password reset landing, reached via the deep link `homeops://reset-password/<token>` from
 * the reset email. On success the backend revokes all sessions, so the user signs in fresh.
 */
export default function ResetPasswordScreen() {
  const { t } = useTranslation('auth');
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();
  const { form, onSubmit, isPending, isError, isSuccess, errorKey } = useResetPasswordForm(token);
  const { errors } = form.formState;

  if (isSuccess) {
    return (
      <AuthShell title={t('resetPassword.title')}>
        <VStack space="lg">
          <Center>
            <VStack space="md" className="items-center">
              <Icon as={CheckCircleIcon} className="h-10 w-10 text-primary" />
              <Text className="text-center text-muted-foreground">
                {t('resetPassword.success')}
              </Text>
            </VStack>
          </Center>
          <Button onPress={() => router.replace('/login')}>
            <ButtonText>{t('resetPassword.backToLogin')}</ButtonText>
          </Button>
        </VStack>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t('resetPassword.title')} description={t('resetPassword.description')}>
      <VStack space="lg">
        {isError ? (
          <Alert variant="destructive">
            <AlertIcon as={AlertCircleIcon} />
            <AlertText>{t(errorKey)}</AlertText>
          </Alert>
        ) : null}

        <TextField
          control={form.control}
          name="password"
          label={t('resetPassword.password')}
          errorMessage={errors.password?.message}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
        />

        <TextField
          control={form.control}
          name="confirmPassword"
          label={t('resetPassword.confirmPassword')}
          errorMessage={errors.confirmPassword?.message}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
        />

        <Button onPress={onSubmit} isDisabled={isPending}>
          {isPending ? <ButtonSpinner /> : null}
          <ButtonText>{t('resetPassword.submit')}</ButtonText>
        </Button>
      </VStack>
    </AuthShell>
  );
}
