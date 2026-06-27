import { useGetMe, useListHouseholds } from '@homeops/api-client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppDrawer } from '@/components/app-drawer';
import { CreateHouseholdSheet } from '@/components/create-household-sheet';
import { DrawerToggleButton } from '@/components/drawer-toggle-button';
import { Alert, AlertIcon, AlertText } from '@/components/ui/alert';
import { Badge, BadgeText } from '@/components/ui/badge';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Center } from '@/components/ui/center';
import { Divider } from '@/components/ui/divider';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import {
  AlertCircleIcon,
  BellIcon,
  CheckCircleIcon,
  GlobeIcon,
  Icon,
  PaperclipIcon,
  RepeatIcon,
} from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useActiveHousehold } from '@/features/households/use-households';
import { useMyInvitations, useRespondToInvitation } from '@/features/households/use-my-invitations';

const MODULES = [
  { key: 'payments', icon: RepeatIcon },
  { key: 'documents', icon: PaperclipIcon },
  { key: 'utilities', icon: GlobeIcon },
  { key: 'tasks', icon: CheckCircleIcon },
] as const;

/** Dashboard: greeting, domain module entry points, and the app menu (drawer). */
export default function DashboardScreen() {
  const { t } = useTranslation(['dashboard', 'common', 'households']);
  const { data: user } = useGetMe();
  const { data: households } = useListHouseholds();
  const { activeHouseholdId } = useActiveHousehold();
  const { invitations: pending } = useMyInvitations();
  const respond = useRespondToInvitation();
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const isIOS = Platform.OS === 'ios';
  const memberships = user?.memberships ?? [];
  const list = households?.households ?? [];
  const active = list.find((h) => h.id === activeHouseholdId);

  const moduleRows = [MODULES.slice(0, 2), MODULES.slice(2, 4)];

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {/* Android keeps a header row; iOS floats a glass button over the content (below). */}
        {isIOS ? null : (
          <HStack className="items-center px-2 py-2" space="xs">
            <DrawerToggleButton onPress={() => setMenuOpen(true)} label={t('menu.title')} />
            <Heading size="lg">{t('appName', { ns: 'common' })}</Heading>
          </HStack>
        )}

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingTop: isIOS ? 64 : 16, gap: 24 }}
        >
          <VStack space="xs">
            <Heading size="2xl">{t('title')}</Heading>
            {user ? (
              <Text className="text-muted-foreground">
                {t('greeting', { name: user.display_name })}
              </Text>
            ) : null}
            <Text className="text-sm font-medium text-primary">
              {active?.name ?? t('menu.noHousehold')}
            </Text>
          </VStack>

          {pending.length > 0 ? (
            <VStack space="sm">
              <Text className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t('myInvitations.title', { ns: 'households' })}
              </Text>
              {respond.isError ? (
                <Alert variant="destructive">
                  <AlertIcon as={AlertCircleIcon} />
                  <AlertText>{t(respond.errorKey, { ns: 'households' })}</AlertText>
                </Alert>
              ) : null}
              <Card className="gap-0 p-0">
                {pending.map((inv, i) => (
                  <View key={inv.id}>
                    {i > 0 ? <Divider /> : null}
                    <VStack space="sm" className="p-4">
                      <VStack space="xs">
                        <Text className="font-medium" numberOfLines={1}>
                          {inv.household_name}
                        </Text>
                        <Badge variant="outline" className="self-start">
                          <BadgeText>{t(`roles.${inv.role}`, { ns: 'households' })}</BadgeText>
                        </Badge>
                      </VStack>
                      <HStack space="sm">
                        <Button
                          className="flex-1"
                          onPress={() => inv.id && respond.onAccept(inv.id)}
                          isDisabled={respond.acceptingId === inv.id || respond.decliningId === inv.id}
                        >
                          {respond.acceptingId === inv.id ? <ButtonSpinner /> : null}
                          <ButtonText>{t('accept.accept', { ns: 'households' })}</ButtonText>
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1"
                          onPress={() => inv.id && respond.onDecline(inv.id)}
                          isDisabled={respond.acceptingId === inv.id || respond.decliningId === inv.id}
                        >
                          {respond.decliningId === inv.id ? <ButtonSpinner /> : null}
                          <ButtonText>{t('accept.decline', { ns: 'households' })}</ButtonText>
                        </Button>
                      </HStack>
                    </VStack>
                  </View>
                ))}
              </Card>
            </VStack>
          ) : null}

          {memberships.length === 0 ? (
            <Card className="gap-4">
              <Heading size="md">{t('onboarding.title', { ns: 'households' })}</Heading>
              <Text className="text-muted-foreground">
                {t('onboarding.description', { ns: 'households' })}
              </Text>
              <Button onPress={() => setCreateOpen(true)} className="self-start">
                <ButtonText>{t('onboarding.cta', { ns: 'households' })}</ButtonText>
              </Button>
            </Card>
          ) : (
            <>
              <VStack space="sm">
                <Text className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('modules.title')}
                </Text>
                <VStack space="md">
                  {moduleRows.map((row, ri) => (
                    <HStack key={ri} space="md">
                      {row.map((m) => (
                        <ModuleCard
                          key={m.key}
                          icon={m.icon}
                          title={t(`modules.${m.key}`)}
                          subtitle={t('modules.comingSoon')}
                        />
                      ))}
                    </HStack>
                  ))}
                </VStack>
              </VStack>

              <VStack space="sm">
                <Text className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('deadlines.title')}
                </Text>
                <Card>
                  <HStack space="md" className="items-center">
                    <Center className="h-10 w-10 rounded-full bg-muted">
                      <Icon as={BellIcon} className="text-muted-foreground" />
                    </Center>
                    <Text className="flex-1 text-sm text-muted-foreground">
                      {t('deadlines.empty')}
                    </Text>
                  </HStack>
                </Card>
              </VStack>
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* iOS: floating liquid-glass drawer toggle over the content. */}
      {isIOS ? (
        <View
          pointerEvents="box-none"
          style={{ position: 'absolute', top: insets.top + 8, left: 16 }}
        >
          <DrawerToggleButton onPress={() => setMenuOpen(true)} label={t('menu.title')} />
        </View>
      ) : null}

      <AppDrawer
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        onCreateHousehold={() => setCreateOpen(true)}
      />
      <CreateHouseholdSheet isOpen={createOpen} onClose={() => setCreateOpen(false)} />
    </View>
  );
}

function ModuleCard({
  icon,
  title,
  subtitle,
}: {
  icon: React.ComponentProps<typeof Icon>['as'];
  title: string;
  subtitle: string;
}) {
  return (
    <Card className="flex-1 gap-3">
      <Center className="h-10 w-10 rounded-full bg-primary/10">
        <Icon as={icon} className="text-primary" />
      </Center>
      <VStack space="xs">
        <Text className="font-medium">{title}</Text>
        <Text className="text-xs text-muted-foreground">{subtitle}</Text>
      </VStack>
    </Card>
  );
}
