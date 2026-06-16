import { DrawerActions } from '@react-navigation/native';
import { useNavigation } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/app-icon';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';

/** Shell header (drawer layout): hamburger toggles the side drawer, next to the brand wordmark. */
export function AppHeader() {
  const navigation = useNavigation();
  const { t } = useTranslation('common');
  return (
    <SafeAreaView edges={['top']} className="bg-card shadow-soft-1">
      <HStack space="xs" className="items-center border-b border-border px-2 py-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('menu')}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
          className="h-10 w-10 items-center justify-center rounded-full active:bg-muted"
        >
          <AppIcon name="menu" size={24} className="text-foreground" />
        </Pressable>
        <Heading size="md" className="text-foreground">
          {t('appName')}
        </Heading>
      </HStack>
    </SafeAreaView>
  );
}
