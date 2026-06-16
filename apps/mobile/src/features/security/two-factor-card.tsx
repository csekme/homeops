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
import { SectionCard } from '@/components/section-card';
import { Badge, BadgeText } from '@/components/ui/badge';
import { Button, ButtonText } from '@/components/ui/button';
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
    <SectionCard
      icon="shield-checkmark-outline"
      title={t('security.title')}
      subtitle={t('security.description')}
    >
      <VStack space="lg">
        {isLoading ? (
          <Spinner />
        ) : (
          <>
            <HStack space="md" className="items-center">
              <Badge action={enabled ? 'success' : 'muted'} variant="solid" className="rounded-full">
                <BadgeText>
                  {enabled ? t('security.statusEnabled') : t('security.statusDisabled')}
                </BadgeText>
              </Badge>
              {enabled ? (
                <Text className="text-muted-foreground">
                  {t('security.recoveryRemaining', {
                    count: status?.recovery_codes_remaining ?? 0,
                  })}
                </Text>
              ) : null}
            </HStack>

            {enabled ? (
              <VStack space="sm">
                <Button
                  variant="outline"
                  action="secondary"
                  className="rounded-xl"
                  onPress={() => setDialog('regenerate')}
                >
                  <ButtonText>{t('security.regenerateButton')}</ButtonText>
                </Button>
                <Button action="negative" className="rounded-xl" onPress={() => setDialog('disable')}>
                  <ButtonText>{t('security.disableButton')}</ButtonText>
                </Button>
              </VStack>
            ) : (
              <Button className="rounded-xl" onPress={() => setDialog('enroll')}>
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
    </SectionCard>
  );
}
