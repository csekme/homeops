import { useGetMe, useListHouseholds, useLogout } from '@homeops/api-client';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LanguageToggle } from '@/components/language-toggle';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Divider } from '@/components/ui/divider';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useActiveHousehold, useHouseholdSwitcher } from '@/features/households/use-households';

/** Dashboard: household switcher, onboarding, and entry into household management. */
export default function DashboardScreen() {
  const { t } = useTranslation(['dashboard', 'common', 'households']);
  const router = useRouter();
  const { data: user } = useGetMe();
  const logout = useLogout();
  const { activeHouseholdId } = useActiveHousehold();
  const { data: households } = useListHouseholds();
  const { switchTo, isPending: switching } = useHouseholdSwitcher();

  const memberships = user?.memberships ?? [];
  const list = households?.households ?? [];

  const onLogout = () => logout.mutate(undefined, { onSuccess: () => router.replace('/login') });

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <HStack className="items-center justify-between px-4 py-3">
          <Heading size="lg">{t('appName', { ns: 'common' })}</Heading>
          <LanguageToggle />
        </HStack>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 24 }}>
          <VStack space="xs">
            <Heading size="2xl">{t('title')}</Heading>
            {user ? (
              <Text className="text-muted-foreground">
                {t('greeting', { name: user.display_name })}
              </Text>
            ) : null}
          </VStack>

          {memberships.length === 0 ? (
            <VStack space="md" className="rounded-xl border border-border p-6">
              <Heading size="md">{t('onboarding.title', { ns: 'households' })}</Heading>
              <Text className="text-muted-foreground">
                {t('onboarding.description', { ns: 'households' })}
              </Text>
              <Button onPress={() => router.push('/household-create')}>
                <ButtonText>{t('onboarding.cta', { ns: 'households' })}</ButtonText>
              </Button>
            </VStack>
          ) : (
            <VStack space="md">
              <Text className="text-sm font-medium text-muted-foreground">
                {t('switcher.label', { ns: 'households' })}
              </Text>
              <VStack className="rounded-xl border border-border">
                {list.map((h, i) => {
                  const active = h.id === activeHouseholdId;
                  return (
                    <View key={h.id}>
                      {i > 0 ? <Divider /> : null}
                      <Pressable
                        disabled={switching || active}
                        onPress={() => h.id && switchTo(h.id)}
                        className="flex-row items-center justify-between p-4"
                      >
                        <Text className={active ? 'font-semibold' : ''}>{h.name}</Text>
                        {active ? (
                          <Text className="text-xs text-primary">
                            {t('switcher.active', { ns: 'households' })}
                          </Text>
                        ) : null}
                      </Pressable>
                    </View>
                  );
                })}
              </VStack>

              <HStack space="sm">
                <Button
                  variant="outline"
                  className="flex-1"
                  onPress={() => router.push('/household-create')}
                >
                  <ButtonText>{t('switcher.create', { ns: 'households' })}</ButtonText>
                </Button>
                {activeHouseholdId ? (
                  <Button className="flex-1" onPress={() => router.push('/household')}>
                    <ButtonText>{t('switcher.manage', { ns: 'households' })}</ButtonText>
                  </Button>
                ) : null}
              </HStack>
            </VStack>
          )}

          <Button variant="outline" onPress={onLogout} isDisabled={logout.isPending}>
            {logout.isPending ? <ButtonSpinner /> : null}
            <ButtonText>{t('logout', { ns: 'common' })}</ButtonText>
          </Button>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
