import { useGetMe, useListHouseholds, useLogout } from '@homeops/api-client';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LanguageToggle } from '@/components/language-toggle';
import { Avatar, AvatarFallbackText } from '@/components/ui/avatar';
import { Badge, BadgeText } from '@/components/ui/badge';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Divider } from '@/components/ui/divider';
import {
  Drawer,
  DrawerBackdrop,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
} from '@/components/ui/drawer';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import {
  AddIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  Icon,
  SettingsIcon,
} from '@/components/ui/icon';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useActiveHousehold, useHouseholdSwitcher } from '@/features/households/use-households';
import { initials } from '@/lib/initials';
import { clearSession } from '@/lib/api';

/** Slide-in app menu: the signed-in user, household switcher, settings and logout. */
export function AppDrawer({
  isOpen,
  onClose,
  onCreateHousehold,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreateHousehold: () => void;
}) {
  const { t } = useTranslation(['dashboard', 'common', 'households']);
  const router = useRouter();
  const { data: user } = useGetMe();
  const { data: households } = useListHouseholds();
  const logout = useLogout();
  const { activeHouseholdId, role } = useActiveHousehold();
  const { switchTo, isPending: switching } = useHouseholdSwitcher();
  const insets = useSafeAreaInsets();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const list = households?.households ?? [];
  const active = list.find((h) => h.id === activeHouseholdId);

  const go = (path: string) => {
    onClose();
    router.push(path as never);
  };
  const onSwitch = (id: string) => {
    switchTo(id);
    setSwitcherOpen(false);
    onClose();
  };
  const onLogout = () => {
    onClose();
    // Bearer transport keeps no cookie, so clear the local session ourselves regardless of
    // the network result, then land on the login stack.
    logout.mutate(undefined, {
      onSettled: () => {
        clearSession();
        router.replace('/login');
      },
    });
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} size="lg" anchor="left">
      <DrawerBackdrop />
      <DrawerContent className="w-[88%] overflow-hidden p-0 ios:rounded-br-3xl ios:rounded-tr-3xl">
        <DrawerHeader
          className="border-b border-border p-4"
          style={{ paddingTop: insets.top + 16 }}
        >
          <HStack space="md" className="w-full items-center">
            <Avatar>
              <AvatarFallbackText>{initials(user?.display_name)}</AvatarFallbackText>
            </Avatar>
            <VStack className="flex-1">
              <Heading size="sm" numberOfLines={1}>
                {user?.display_name}
              </Heading>
              <Text className="text-sm text-muted-foreground" numberOfLines={1}>
                {user?.email}
              </Text>
              {role ? (
                <Badge variant="secondary" className="mt-1 self-start">
                  <BadgeText>{t(`roles.${role}`, { ns: 'households' })}</BadgeText>
                </Badge>
              ) : null}
            </VStack>
          </HStack>
        </DrawerHeader>

        <DrawerBody className="my-0 flex-1 p-0">
          <ScrollView contentContainerStyle={{ paddingVertical: 8 }}>
            <VStack space="xs" className="px-4 pt-2">
              <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t('switcher.label', { ns: 'households' })}
              </Text>
              <Pressable
                onPress={() => setSwitcherOpen((v) => !v)}
                className="flex-row items-center justify-between rounded-md border border-border px-3 py-3"
              >
                <Text className="flex-1 font-medium" numberOfLines={1}>
                  {active?.name ?? t('switcher.none', { ns: 'households' })}
                </Text>
                <Icon
                  as={switcherOpen ? ChevronUpIcon : ChevronDownIcon}
                  size="sm"
                  className="text-muted-foreground"
                />
              </Pressable>

              {switcherOpen ? (
                <VStack className="rounded-md border border-border">
                  {list.map((h, i) => {
                    const isActive = h.id === activeHouseholdId;
                    return (
                      <View key={h.id}>
                        {i > 0 ? <Divider /> : null}
                        <Pressable
                          disabled={switching || isActive}
                          onPress={() => h.id && onSwitch(h.id)}
                          className="flex-row items-center justify-between px-3 py-3"
                        >
                          <Text className={isActive ? 'font-semibold' : ''} numberOfLines={1}>
                            {h.name}
                          </Text>
                          {isActive ? (
                            <Icon as={CheckIcon} size="sm" className="text-primary" />
                          ) : null}
                        </Pressable>
                      </View>
                    );
                  })}
                </VStack>
              ) : null}

              <Pressable
                onPress={() => {
                  onClose();
                  onCreateHousehold();
                }}
                className="mt-1 flex-row items-center gap-2 py-2"
              >
                <Icon as={AddIcon} size="sm" className="text-primary" />
                <Text className="text-primary">{t('switcher.create', { ns: 'households' })}</Text>
              </Pressable>
            </VStack>

            {activeHouseholdId ? (
              <>
                <Divider className="my-2" />
                <Pressable
                  onPress={() => go('/household')}
                  className="flex-row items-center gap-3 px-4 py-3"
                >
                  <Icon as={SettingsIcon} size="sm" className="text-foreground" />
                  <Text>{t('switcher.manage', { ns: 'households' })}</Text>
                </Pressable>
              </>
            ) : null}
          </ScrollView>
        </DrawerBody>

        <DrawerFooter
          className="flex-col gap-3 border-t border-border p-4"
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          <HStack className="w-full items-center justify-between">
            <Text className="text-sm text-muted-foreground">
              {t('languageToggle', { ns: 'common' })}
            </Text>
            <LanguageToggle />
          </HStack>
          <Button
            variant="outline"
            onPress={onLogout}
            isDisabled={logout.isPending}
            className="w-full"
          >
            {logout.isPending ? <ButtonSpinner /> : null}
            <ButtonText>{t('logout', { ns: 'common' })}</ButtonText>
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
