import { Link, Redirect } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AuthShell } from '@/components/auth-shell';
import { TextField } from '@/components/text-field';
import { Alert, AlertIcon, AlertText } from '@/components/ui/alert';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { AlertCircleIcon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { getPendingChallenge } from '@/features/security/challenge-store';
import { useTotpChallenge } from '@/features/security/use-totp-challenge';

export default function LoginVerifyScreen() {
  const pending = getPendingChallenge();

  // No pending challenge (direct visit / app restart) → restart login. Like the web app,
  // the challenge token is never part of the navigable URL.
  if (!pending) {
    return <Redirect href="/login" />;
  }

  return <ChallengeForm challengeToken={pending.challengeToken} redirectTo={pending.redirectTo} />;
}

function ChallengeForm({
  challengeToken,
  redirectTo,
}: {
  challengeToken: string;
  redirectTo: string;
}) {
  const { t } = useTranslation('settings');
  const { form, onSubmit, isPending, isError, errorKey } = useTotpChallenge(
    challengeToken,
    redirectTo,
  );
  const { errors } = form.formState;

  return (
    <AuthShell
      title={t('twofactor.challenge.title')}
      footer={
        <Link href="/login">
          <Text className="font-medium text-primary">{t('twofactor.challenge.back')}</Text>
        </Link>
      }
    >
      <VStack space="lg">
        <Text className="text-muted-foreground">{t('twofactor.challenge.instruction')}</Text>

        {isError ? (
          <Alert variant="destructive">
            <AlertIcon as={AlertCircleIcon} />
            <AlertText>{t(errorKey)}</AlertText>
          </Alert>
        ) : null}

        <TextField
          control={form.control}
          name="code"
          label={t('twofactor.challenge.codeLabel')}
          errorMessage={errors.code?.message}
          keyboardType="number-pad"
          autoCapitalize="none"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          autoFocus
        />

        <Button onPress={onSubmit} isDisabled={isPending}>
          {isPending ? <ButtonSpinner /> : null}
          <ButtonText>{t('twofactor.challenge.submit')}</ButtonText>
        </Button>
      </VStack>
    </AuthShell>
  );
}
