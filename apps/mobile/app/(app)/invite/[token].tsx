import { useGetMe } from '@homeops/api-client';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Alert, AlertIcon, AlertText } from '@/components/ui/alert';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { AlertCircleIcon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useAcceptInvite, useInvitePreview } from '@/features/households/use-accept-invite';

/**
 * Invitation deep-link landing (`homeops://invite/<token>`). Requires auth (lives under the
 * (app) group), so an unauthenticated open routes through login first. The accepting user's
 * email must match the invited address (the backend enforces this; we surface a clear note).
 */
export default function AcceptInviteScreen() {
  const { t } = useTranslation('households');
  const { token } = useLocalSearchParams<{ token: string }>();
  const { preview, isLoading, isError } = useInvitePreview(token);
  const { data: user } = useGetMe();
  const { onAccept, isPending, isError: acceptError, errorKey } = useAcceptInvite(token);

  const matches = user && preview && user.email?.toLowerCase() === preview.email?.toLowerCase();

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <VStack space="lg" className="flex-1 p-4">
          <Heading size="2xl">{t('accept.title')}</Heading>

          {isLoading ? (
            <Spinner />
          ) : isError || !preview ? (
            <Alert variant="destructive">
              <AlertIcon as={AlertCircleIcon} />
              <AlertText>{t('errors.invalidInvite')}</AlertText>
            </Alert>
          ) : (
            <VStack space="md">
              <Text className="text-muted-foreground">
                {t('accept.previewDescription', {
                  household: preview.household_name,
                  role: t(`roles.${preview.role}`),
                })}
              </Text>

              {acceptError ? (
                <Alert variant="destructive">
                  <AlertIcon as={AlertCircleIcon} />
                  <AlertText>{t(errorKey)}</AlertText>
                </Alert>
              ) : null}

              {matches ? (
                <Button onPress={onAccept} isDisabled={isPending}>
                  {isPending ? <ButtonSpinner /> : null}
                  <ButtonText>{t('accept.accept')}</ButtonText>
                </Button>
              ) : (
                <Alert variant="destructive">
                  <AlertIcon as={AlertCircleIcon} />
                  <AlertText>{t('accept.wrongAccount', { email: preview.email })}</AlertText>
                </Alert>
              )}
            </VStack>
          )}
        </VStack>
      </SafeAreaView>
    </View>
  );
}
