import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AuthShell } from '@/components/auth-shell';
import { TextField } from '@/components/text-field';
import { Alert, AlertIcon, AlertText } from '@/components/ui/alert';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { AlertCircleIcon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useLoginForm } from '@/features/auth/use-login-form';

export default function LoginScreen() {
  const { t } = useTranslation('auth');
  const { form, onSubmit, isPending, isError, errorKey } = useLoginForm();
  const { errors } = form.formState;

  return (
    <AuthShell
      title={t('login.title')}
      footer={
        <HStack space="xs" className="items-center">
          <Text className="text-muted-foreground">{t('login.noAccount')}</Text>
          <Link href="/register">
            <Text className="font-medium text-primary">{t('login.registerLink')}</Text>
          </Link>
        </HStack>
      }
    >
      <VStack space="lg">
        {isError ? (
          <Alert variant="destructive">
            <AlertIcon as={AlertCircleIcon} />
            <AlertText>{t(errorKey)}</AlertText>
          </Alert>
        ) : null}

        <TextField
          control={form.control}
          name="email"
          label={t('login.email')}
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
          label={t('login.password')}
          errorMessage={errors.password?.message}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
        />

        <Button onPress={onSubmit} isDisabled={isPending}>
          {isPending ? <ButtonSpinner /> : null}
          <ButtonText>{t('login.submit')}</ButtonText>
        </Button>
      </VStack>
    </AuthShell>
  );
}
