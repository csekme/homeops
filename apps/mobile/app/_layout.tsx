// Side-effect imports — order matters: i18n before zod-i18n (the error map reads i18n),
// api configures the shared client, global.css boots NativeWind.
import '@/lib/i18n';
import '@/lib/zod-i18n';
import '@/lib/api';
import '../global.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Splash } from '@/components/splash';
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { AuthBootProvider, useAuthBoot } from '@/lib/auth';
import { queryClient } from '@/lib/query';

/** Holds the app on a splash until the boot refresh settles; group layouts then guard auth. */
function RootNavigator() {
  const { booted } = useAuthBoot();
  if (!booted) return <Splash />;
  return <Slot />;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <GluestackUIProvider mode="system">
          <QueryClientProvider client={queryClient}>
            <AuthBootProvider>
              <StatusBar style="auto" />
              <RootNavigator />
            </AuthBootProvider>
          </QueryClientProvider>
        </GluestackUIProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
