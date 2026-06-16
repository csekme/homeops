import { Drawer } from 'expo-router/drawer';

import { AppDrawerContent } from '@/components/app-drawer';
import { AppHeader } from '@/components/app-header';
import { RequireAuth } from '@/components/require-auth';
import { useTheme } from '@/lib/theme';

// Drawer surface = the semantic `card` colour (hex — React Navigation needs raw color strings).
const DRAWER_BG = { light: '#ffffff', dark: '#18181b' } as const;

/** Authenticated app shell (plan §U2): RequireAuth + a side drawer (replaces the bottom tabs). */
export default function AppLayout() {
  const { resolvedTheme } = useTheme();

  return (
    <RequireAuth>
      <Drawer
        drawerContent={(props) => <AppDrawerContent {...props} />}
        screenOptions={{
          header: () => <AppHeader />,
          drawerType: 'front',
          swipeEdgeWidth: 80,
          drawerStyle: { backgroundColor: DRAWER_BG[resolvedTheme], width: 300 },
        }}
      />
    </RequireAuth>
  );
}
