import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TextField } from '@/components/text-field';
import { Alert, AlertIcon, AlertText } from '@/components/ui/alert';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { AlertCircleIcon } from '@/components/ui/icon';
import { VStack } from '@/components/ui/vstack';
import { useCreateHouseholdForm } from '@/features/households/use-households';

export default function CreateHouseholdScreen() {
  const { t } = useTranslation('households');
  const router = useRouter();
  const { form, onSubmit, isPending, isError, errorKey } = useCreateHouseholdForm(() =>
    router.replace('/'),
  );
  const { errors } = form.formState;

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <VStack space="lg" className="flex-1 p-4">
          <Heading size="2xl">{t('create.title')}</Heading>
          <Heading size="sm" className="font-normal text-muted-foreground">
            {t('create.description')}
          </Heading>

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

          <VStack space="sm" className="mt-2">
            <Button onPress={onSubmit} isDisabled={isPending}>
              {isPending ? <ButtonSpinner /> : null}
              <ButtonText>{t('create.submit')}</ButtonText>
            </Button>
            <Button variant="outline" onPress={() => router.back()} isDisabled={isPending}>
              <ButtonText>{t('general.cancel')}</ButtonText>
            </Button>
          </VStack>
        </VStack>
      </SafeAreaView>
    </View>
  );
}
