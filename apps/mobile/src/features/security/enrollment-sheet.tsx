import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import QRCode from 'react-native-qrcode-svg';

import { CodeInput } from '@/components/code-input';
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetScrollView,
} from '@/components/ui/actionsheet';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Center } from '@/components/ui/center';
import { Heading } from '@/components/ui/heading';
import { Pressable } from '@/components/ui/pressable';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useTotpEnrollment } from '@/features/security/use-totp-setup';
import { RecoveryCodes } from '@/features/security/recovery-codes';

/**
 * 2FA enrollment wizard (plan §U3) on a gluestack Actionsheet: the QR can't be scanned from
 * the same phone, so the primary path is copy-the-key → paste into the authenticator. The QR
 * remains for a second device. `useTotpConfirm` deliberately doesn't invalidate the status
 * query (would unmount mid-wizard); the card refreshes on close via `reset()`.
 */
export function EnrollmentSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const enrollment = useTotpEnrollment();

  useEffect(() => {
    if (visible) enrollment.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const close = () => {
    enrollment.reset();
    onClose();
  };

  return (
    <Actionsheet isOpen={visible} onClose={close} snapPoints={[90]}>
      <ActionsheetBackdrop />
      <ActionsheetContent>
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <ActionsheetScrollView
          contentContainerClassName="p-2"
          keyboardShouldPersistTaps="handled"
        >
          {enrollment.step === 'recovery' && enrollment.recoveryCodes ? (
            <RecoveryCodes codes={enrollment.recoveryCodes} onDone={close} />
          ) : (
            <ScanStep enrollment={enrollment} onCancel={close} />
          )}
        </ActionsheetScrollView>
      </ActionsheetContent>
    </Actionsheet>
  );
}

function ScanStep({
  enrollment,
  onCancel,
}: {
  enrollment: ReturnType<typeof useTotpEnrollment>;
  onCancel: () => void;
}) {
  const { t } = useTranslation('settings');
  const { provisioningUri, secret, form, onConfirm, isStarting, isConfirming, isError, errorKey } =
    enrollment;
  const [copied, setCopied] = useState(false);

  return (
    <VStack space="lg">
      <Heading size="lg">{t('twofactor.setup.title')}</Heading>
      <Text className="text-typography-500">{t('twofactor.setup.instruction')}</Text>

      {isStarting || !provisioningUri ? (
        <Spinner className="my-6" />
      ) : (
        <>
          <Center className="rounded-md bg-white p-4">
            <QRCode value={provisioningUri} size={180} />
          </Center>

          {secret ? (
            <VStack space="xs">
              <Text className="text-typography-500">{t('twofactor.setup.manualEntry')}</Text>
              <Pressable
                onPress={() => {
                  void Clipboard.setStringAsync(secret);
                  setCopied(true);
                }}
              >
                <Text className="text-center font-mono text-typography-900">{secret}</Text>
              </Pressable>
              <Text className="text-center text-xs text-typography-500">
                {copied ? t('twofactor.recovery.copied') : t('twofactor.setup.copyKey')}
              </Text>
            </VStack>
          ) : null}

          <Text className="font-medium">{t('twofactor.setup.codeLabel')}</Text>
          <Controller
            control={form.control}
            name="code"
            render={({ field }) => (
              <CodeInput value={field.value} onChange={field.onChange} onComplete={onConfirm} />
            )}
          />

          {isError ? <Text className="text-error-600">{t(errorKey)}</Text> : null}

          <Button onPress={onConfirm} isDisabled={isConfirming}>
            {isConfirming ? (
              <ButtonSpinner />
            ) : (
              <ButtonText>{t('twofactor.setup.confirmButton')}</ButtonText>
            )}
          </Button>
          <Button variant="link" action="secondary" onPress={onCancel}>
            <ButtonText>{t('twofactor.recovery.done')}</ButtonText>
          </Button>
        </>
      )}
    </VStack>
  );
}
