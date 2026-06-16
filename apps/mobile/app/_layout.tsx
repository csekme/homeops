import '../global.css';
import '@/lib/zod-i18n';

import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { type ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Toaster } from 'sonner-native';

import { Splash } from '@/components/splash';
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { configureApi } from '@/lib/api';
import { AuthBootProvider, useAuthBoot } from '@/lib/auth';
import { queryClient } from '@/lib/query';
import { ThemeProvider, useTheme } from '@/lib/theme';

// Configure the api-client (base URL, body-refresh, secure-store persistence, session-expired
// handler) exactly once, at module load — before any screen renders or fires a request.
configureApi();

/** Bridge: drive gluestack's mode (and thus NativeWind's color scheme) from our theme. */
function ThemedGluestack({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  return (
    <GluestackUIProvider mode={theme} style={{ flex: 1 }}>
      {children}
    </GluestackUIProvider>
  );
}

function RootNavigator() {
  const { booted } = useAuthBoot();
  const { resolvedTheme } = useTheme();

  if (!booted) return <Splash />;

  return (
    <>
      <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(app)" />
        <Stack.Screen name="(auth)" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ThemedGluestack>
            <QueryClientProvider client={queryClient}>
              <AuthBootProvider>
                <RootNavigator />
                <Toaster />
              </AuthBootProvider>
            </QueryClientProvider>
          </ThemedGluestack>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
