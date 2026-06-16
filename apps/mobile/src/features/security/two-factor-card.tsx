import { useTotpStatus } from '@homeops/api-client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
} from '@/components/ui/actionsheet';
import { Badge, BadgeText } from '@/components/ui/badge';
import { Button, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { EnrollmentSheet } from '@/features/security/enrollment-sheet';
import { PasswordDialog } from '@/features/security/password-dialog';
import { RecoveryCodes } from '@/features/security/recovery-codes';

type Dialog = 'enroll' | 'disable' | 'regenerate' | null;

/** Security card (plan §U3): 2FA status + enable/disable/regenerate actions. */
export function TwoFactorCard() {
  const { t } = useTranslation('settings');
  const { data: status, isLoading } = useTotpStatus();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [newCodes, setNewCodes] = useState<string[] | null>(null);

  const enabled = status?.enabled ?? false;

  return (
    <Card>
      <VStack space="lg">
        <VStack space="xs">
          <Heading size="lg">{t('security.title')}</Heading>
          <Text className="text-typography-500">{t('security.description')}</Text>
        </VStack>

        {isLoading ? (
          <Spinner />
        ) : (
          <>
            <HStack space="md" className="items-center">
              <Badge action={enabled ? 'success' : 'muted'} variant="solid">
                <BadgeText>
                  {enabled ? t('security.statusEnabled') : t('security.statusDisabled')}
                </BadgeText>
              </Badge>
              {enabled ? (
                <Text className="text-typography-500">
                  {t('security.recoveryRemaining', {
                    count: status?.recovery_codes_remaining ?? 0,
                  })}
                </Text>
              ) : null}
            </HStack>

            {enabled ? (
              <VStack space="sm">
                <Button variant="outline" action="secondary" onPress={() => setDialog('regenerate')}>
                  <ButtonText>{t('security.regenerateButton')}</ButtonText>
                </Button>
                <Button action="negative" onPress={() => setDialog('disable')}>
                  <ButtonText>{t('security.disableButton')}</ButtonText>
                </Button>
              </VStack>
            ) : (
              <Button onPress={() => setDialog('enroll')}>
                <ButtonText>{t('security.enableButton')}</ButtonText>
              </Button>
            )}
          </>
        )}
      </VStack>

      <EnrollmentSheet visible={dialog === 'enroll'} onClose={() => setDialog(null)} />
      <PasswordDialog mode="disable" visible={dialog === 'disable'} onClose={() => setDialog(null)} />
      <PasswordDialog
        mode="regenerate"
        visible={dialog === 'regenerate'}
        onClose={() => setDialog(null)}
        onCodes={setNewCodes}
      />

      {/* Show the freshly regenerated codes once. */}
      <Actionsheet isOpen={newCodes !== null} onClose={() => setNewCodes(null)}>
        <ActionsheetBackdrop />
        <ActionsheetContent>
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          <VStack space="md" className="w-full p-4">
            {newCodes ? <RecoveryCodes codes={newCodes} onDone={() => setNewCodes(null)} /> : null}
          </VStack>
        </ActionsheetContent>
      </Actionsheet>
    </Card>
  );
}
