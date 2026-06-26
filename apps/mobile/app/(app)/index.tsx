import { useLogout, useMe } from '@homeops/api-client';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LanguageToggle } from '@/components/language-toggle';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

/** Dashboard placeholder (phase0-mobile §11). Confirms the session and offers logout. */
export default function DashboardScreen() {
  const { t } = useTranslation(['dashboard', 'common']);
  const router = useRouter();
  const { data: user } = useMe();
  const logout = useLogout();

  const onLogout = () => {
    // The (app) layout redirects on me=null, but replace explicitly for an instant exit.
    logout.mutate(undefined, { onSuccess: () => router.replace('/login') });
  };

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <HStack className="items-center justify-between px-4 py-3">
          <Heading size="lg">{t('appName', { ns: 'common' })}</Heading>
          <LanguageToggle />
        </HStack>
        <VStack space="lg" className="flex-1 p-4">
          <VStack space="xs">
            <Heading size="2xl">{t('title')}</Heading>
            {user ? (
              <Text className="text-muted-foreground">
                {t('greeting', { name: user.display_name })}
              </Text>
            ) : null}
          </VStack>
          <Text className="text-muted-foreground">{t('noUpcoming')}</Text>
          <Button variant="outline" onPress={onLogout} isDisabled={logout.isPending}>
            {logout.isPending ? <ButtonSpinner /> : null}
            <ButtonText>{t('logout', { ns: 'common' })}</ButtonText>
          </Button>
        </VStack>
      </SafeAreaView>
    </View>
  );
}
