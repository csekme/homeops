import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { AuthShell } from '@/components/auth-shell';
import { CodeInput } from '@/components/code-input';
import { FormField } from '@/components/form-field';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useTotpChallenge } from '@/features/security/use-totp-challenge';

export default function LoginVerifyScreen() {
  const { challengeToken } = useLocalSearchParams<{ challengeToken?: string }>();
  const router = useRouter();

  // The challenge token lives only in volatile router params (plan §8.2). On a reload /
  // direct visit it's gone → back to the login screen.
  if (!challengeToken) return <Redirect href="/login" />;

  return <VerifyForm challengeToken={challengeToken} onBack={() => router.replace('/login')} />;
}

function VerifyForm({ challengeToken, onBack }: { challengeToken: string; onBack: () => void }) {
  const { t } = useTranslation('settings');
  const [recoveryMode, setRecoveryMode] = useState(false);
  const { form, onSubmit, isPending, isError, errorKey } = useTotpChallenge(challengeToken);

  return (
    <AuthShell title={t('twofactor.challenge.title')}>
      <VStack space="lg">
        <Text className="text-center text-typography-500">
          {t('twofactor.challenge.instruction')}
        </Text>

        {recoveryMode ? (
          <FormField
            control={form.control}
            name="code"
            label={t('twofactor.challenge.codeLabel')}
            errorMessage={form.formState.errors.code?.message}
            autoCapitalize="none"
            autoCorrect={false}
          />
        ) : (
          <Controller
            control={form.control}
            name="code"
            render={({ field }) => (
              <CodeInput value={field.value} onChange={field.onChange} onComplete={onSubmit} />
            )}
          />
        )}

        {isError ? <Text className="text-center text-error-600">{t(errorKey)}</Text> : null}

        <Button onPress={onSubmit} isDisabled={isPending}>
          {isPending ? (
            <ButtonSpinner />
          ) : (
            <ButtonText>{t('twofactor.challenge.submit')}</ButtonText>
          )}
        </Button>

        <Pressable
          onPress={() => {
            form.reset({ code: '' });
            setRecoveryMode((v) => !v);
          }}
          className="items-center py-1"
        >
          <Text className="font-semibold text-primary-600">
            {recoveryMode ? t('twofactor.challenge.title') : t('twofactor.recovery.title')}
          </Text>
        </Pressable>

        <Pressable onPress={onBack} className="items-center py-1">
          <Text className="font-semibold text-primary-600">{t('twofactor.challenge.back')}</Text>
        </Pressable>
      </VStack>
    </AuthShell>
  );
}
