import { useTranslation } from 'react-i18next';

import { useKeyboardHeight } from '@/components/keyboard-aware-scroll-view';
import { TextField } from '@/components/text-field';
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
} from '@/components/ui/actionsheet';
import { Alert, AlertIcon, AlertText } from '@/components/ui/alert';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { AlertCircleIcon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useCreateHouseholdForm } from '@/features/households/use-households';

/** Bottom-sheet "create household" form. Closes itself on success (the hook resets + calls onClose). */
export function CreateHouseholdSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { t } = useTranslation('households');
  const { form, onSubmit, isPending, isError, errorKey } = useCreateHouseholdForm(onClose);
  const { errors } = form.formState;
  const keyboardHeight = useKeyboardHeight();

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent
        style={keyboardHeight > 0 ? { bottom: keyboardHeight + 8 } : undefined}
      >
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <VStack space="md" className="w-full px-2 pb-2 pt-1">
          <VStack space="xs">
            <Heading size="md">{t('create.title')}</Heading>
            <Text className="text-sm text-muted-foreground">{t('create.description')}</Text>
          </VStack>

          {isError ? (
            <Alert variant="destructive">
              <AlertIcon as={AlertCircleIcon} />
              <AlertText>{t(errorKey)}</AlertText>
            </Alert>
          ) : null}

          <TextField
            control={form.control}
            name="name"
            label={t('create.nameLabel')}
            placeholder={t('create.namePlaceholder')}
            errorMessage={errors.name?.message}
          />
          <TextField
            control={form.control}
            name="default_currency"
            label={t('create.currencyLabel')}
            autoCapitalize="characters"
            maxLength={3}
            errorMessage={errors.default_currency?.message}
          />

          <Button onPress={onSubmit} isDisabled={isPending}>
            {isPending ? <ButtonSpinner /> : null}
            <ButtonText>{t('create.submit')}</ButtonText>
          </Button>
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
}
