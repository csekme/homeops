import { useTranslation } from 'react-i18next';

import { FormField } from '@/components/form-field';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Modal, ModalBackdrop, ModalBody, ModalContent, ModalHeader } from '@/components/ui/modal';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useDisable2fa, useRegenerateRecoveryCodes } from '@/features/security/use-disable-2fa';

type Mode = 'disable' | 'regenerate';

interface PasswordDialogProps {
  mode: Mode;
  visible: boolean;
  onClose: () => void;
  /** For `regenerate`: receives the freshly issued codes on success. */
  onCodes?: (codes: string[]) => void;
}

/** Password step-up dialog shared by disable + regenerate (plan §U3). */
export function PasswordDialog({ mode, visible, onClose, onCodes }: PasswordDialogProps) {
  if (!visible) return null;
  return mode === 'disable' ? (
    <DisableDialog onClose={onClose} />
  ) : (
    <RegenerateDialog onClose={onClose} onCodes={onCodes} />
  );
}

function Shell({
  title,
  description,
  children,
  onClose,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <Modal isOpen onClose={onClose}>
      <ModalBackdrop />
      <ModalContent>
        <ModalHeader>
          <Heading size="md">{title}</Heading>
        </ModalHeader>
        <ModalBody>
          <VStack space="md">
            <Text className="text-typography-500">{description}</Text>
            {children}
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

function DisableDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('settings');
  const { form, onSubmit, isPending, isError, errorKey } = useDisable2fa(onClose);

  return (
    <Shell
      title={t('twofactor.disable.title')}
      description={t('twofactor.disable.description')}
      onClose={onClose}
    >
      <FormField
        control={form.control}
        name="password"
        label={t('twofactor.disable.passwordLabel')}
        errorMessage={form.formState.errors.password?.message}
        type="password"
      />
      {isError ? <Text className="text-error-600">{t(errorKey)}</Text> : null}
      <Button action="negative" onPress={onSubmit} isDisabled={isPending}>
        {isPending ? <ButtonSpinner /> : <ButtonText>{t('twofactor.disable.submit')}</ButtonText>}
      </Button>
    </Shell>
  );
}

function RegenerateDialog({
  onClose,
  onCodes,
}: {
  onClose: () => void;
  onCodes?: (codes: string[]) => void;
}) {
  const { t } = useTranslation('settings');
  const { form, onSubmit, isPending, isError, errorKey } = useRegenerateRecoveryCodes((codes) => {
    onClose();
    onCodes?.(codes);
  });

  return (
    <Shell
      title={t('twofactor.regenerate.title')}
      description={t('twofactor.regenerate.description')}
      onClose={onClose}
    >
      <FormField
        control={form.control}
        name="password"
        label={t('twofactor.regenerate.passwordLabel')}
        errorMessage={form.formState.errors.password?.message}
        type="password"
      />
      {isError ? <Text className="text-error-600">{t(errorKey)}</Text> : null}
      <Button onPress={onSubmit} isDisabled={isPending}>
        {isPending ? (
          <ButtonSpinner />
        ) : (
          <ButtonText>{t('twofactor.regenerate.submit')}</ButtonText>
        )}
      </Button>
    </Shell>
  );
}
