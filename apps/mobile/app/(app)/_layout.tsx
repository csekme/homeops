import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AppHeader } from '@/components/app-header';
import { RequireAuth } from '@/components/require-auth';

type IconName = keyof typeof Ionicons.glyphMap;

/** Authenticated app shell (plan §U2): RequireAuth + bottom tabs, mirroring the web routes. */
export default function AppLayout() {
  const { t } = useTranslation('common');

  const icon =
    (name: IconName) =>
    ({ color, size }: { color: string; size: number }) =>
      <Ionicons name={name} color={color} size={size} />;

  return (
    <RequireAuth>
      <Tabs
        screenOptions={{
          header: () => <AppHeader />,
          tabBarActiveTintColor: '#2563eb',
        }}
      >
        <Tabs.Screen
          name="index"
          options={{ title: t('nav.dashboard'), tabBarIcon: icon('home-outline') }}
        />
        <Tabs.Screen
          name="obligations"
          options={{ title: t('nav.obligations'), tabBarIcon: icon('checkbox-outline') }}
        />
        <Tabs.Screen
          name="expenses"
          options={{ title: t('nav.expenses'), tabBarIcon: icon('cash-outline') }}
        />
        <Tabs.Screen
          name="services"
          options={{ title: t('nav.services'), tabBarIcon: icon('cube-outline') }}
        />
        <Tabs.Screen
          name="documents"
          options={{ title: t('nav.documents'), tabBarIcon: icon('document-outline') }}
        />
        <Tabs.Screen
          name="settings"
          options={{ title: t('nav.settings'), tabBarIcon: icon('settings-outline') }}
        />
      </Tabs>
    </RequireAuth>
  );
}
