import { useLogout, useMe } from '@homeops/api-client';
import {
  DrawerContentScrollView,
  type DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon, type AppIconName } from '@/components/app-icon';
import { HouseholdSwitcher } from '@/components/household-switcher';
import { LanguageToggle } from '@/components/language-toggle';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button, ButtonText } from '@/components/ui/button';
import { Center } from '@/components/ui/center';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { secureStorePersistence } from '@/lib/secure-store';

interface NavItem {
  name: string;
  labelKey: string;
  icon: AppIconName;
}

// Drawer routes, in display order. `name` matches the (app)/ file route name.
const NAV: NavItem[] = [
  { name: 'index', labelKey: 'nav.dashboard', icon: 'home-outline' },
  { name: 'obligations', labelKey: 'nav.obligations', icon: 'checkbox-outline' },
  { name: 'expenses', labelKey: 'nav.expenses', icon: 'cash-outline' },
  { name: 'services', labelKey: 'nav.services', icon: 'cube-outline' },
  { name: 'documents', labelKey: 'nav.documents', icon: 'document-outline' },
  { name: 'settings', labelKey: 'nav.settings', icon: 'settings-outline' },
];

/**
 * Custom side-drawer content (replaces the old bottom tab bar): household lockup on top, the
 * navigation list in the middle with the active route highlighted, and the user identity +
 * language/theme toggles + logout pinned to the bottom. All colours are semantic tokens so the
 * drawer flips with the theme.
 */
export function AppDrawerContent(props: DrawerContentComponentProps) {
  const { t } = useTranslation('common');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data } = useMe();
  const logout = useLogout();

  const activeRoute = props.state.routeNames[props.state.index];
  const initial = (data?.display_name ?? data?.email ?? '?').charAt(0).toUpperCase();

  const onLogout = () => {
    logout.mutate(undefined, {
      onSettled: () => {
        void secureStorePersistence.saveRefreshToken(null);
        router.replace('/login');
      },
    });
  };

  return (
    <VStack className="flex-1 bg-card">
      <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: insets.top }}>
        <VStack space="lg" className="px-3 pb-4">
          <HStack className="px-1 py-2">
            <HouseholdSwitcher />
          </HStack>
          <VStack space="xs">
            {NAV.map((item) => {
              const active = item.name === activeRoute;
              return (
                <Pressable
                  key={item.name}
                  accessibilityRole="button"
                  onPress={() => props.navigation.navigate(item.name)}
                  className={`flex-row items-center gap-3 rounded-xl px-3 py-3 ${
                    active ? 'bg-primary/10' : 'active:bg-muted'
                  }`}
                >
                  <AppIcon
                    name={item.icon}
                    size={22}
                    className={active ? 'text-primary' : 'text-muted-foreground'}
                  />
                  <Text className={`font-medium ${active ? 'text-primary' : 'text-foreground'}`}>
                    {t(item.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </VStack>
        </VStack>
      </DrawerContentScrollView>

      <VStack
        space="md"
        className="border-t border-border px-4 pt-4"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        <HStack space="sm" className="items-center">
          <Center className="h-9 w-9 rounded-full bg-primary">
            <Text className="font-semibold text-primary-foreground">{initial}</Text>
          </Center>
          <Text className="flex-1 font-medium text-foreground" numberOfLines={1}>
            {data?.display_name ?? data?.email}
          </Text>
        </HStack>
        <HStack space="sm">
          <LanguageToggle />
          <ThemeToggle />
        </HStack>
        <Button action="negative" variant="outline" onPress={onLogout} isDisabled={logout.isPending}>
          <ButtonText>{t('logout')}</ButtonText>
        </Button>
      </VStack>
    </VStack>
  );
}
