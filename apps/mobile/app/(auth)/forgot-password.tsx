import { Link, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AuthShell } from '@/components/auth-shell';
import { TextField } from '@/components/text-field';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Center } from '@/components/ui/center';
import { HStack } from '@/components/ui/hstack';
import { CheckCircleIcon, Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useForgotPasswordForm } from '@/features/auth/use-forgot-password-form';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation('auth');
  const router = useRouter();
  const { form, onSubmit, isPending, isSuccess } = useForgotPasswordForm();
  const { errors } = form.formState;

  if (isSuccess) {
    return (
      <AuthShell title={t('forgotPassword.title')}>
        <VStack space="lg">
          <Center>
            <VStack space="md" className="items-center">
              <Icon as={CheckCircleIcon} className="h-10 w-10 text-primary" />
              <Text className="text-center text-muted-foreground">
                {t('forgotPassword.checkEmail')}
              </Text>
            </VStack>
          </Center>
          <Button variant="outline" onPress={() => router.replace('/login')}>
            <ButtonText>{t('forgotPassword.backToLogin')}</ButtonText>
          </Button>
        </VStack>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={t('forgotPassword.title')}
      description={t('forgotPassword.description')}
      footer={
        <HStack space="xs" className="items-center">
          <Link href="/login">
            <Text className="font-medium text-primary">{t('forgotPassword.backToLogin')}</Text>
          </Link>
        </HStack>
      }
    >
      <VStack space="lg">
        <TextField
          control={form.control}
          name="email"
          label={t('forgotPassword.email')}
          errorMessage={errors.email?.message}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
        />

        <Button onPress={onSubmit} isDisabled={isPending}>
          {isPending ? <ButtonSpinner /> : null}
          <ButtonText>{t('forgotPassword.submit')}</ButtonText>
        </Button>
      </VStack>
    </AuthShell>
  );
}
