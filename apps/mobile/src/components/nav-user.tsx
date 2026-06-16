import { useLogout, useMe } from '@homeops/api-client';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LanguageToggle } from '@/components/language-toggle';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
} from '@/components/ui/actionsheet';
import { Button, ButtonText } from '@/components/ui/button';
import { Center } from '@/components/ui/center';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { secureStorePersistence } from '@/lib/secure-store';

/** User menu (plan §U2): avatar → sheet with email, language/theme toggles, logout. */
export function NavUser() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { data } = useMe();
  const logout = useLogout();
  const [open, setOpen] = useState(false);

  const initial = (data?.display_name ?? data?.email ?? '?').charAt(0).toUpperCase();

  const onLogout = () => {
    logout.mutate(undefined, {
      onSettled: () => {
        void secureStorePersistence.saveRefreshToken(null);
        setOpen(false);
        router.replace('/login');
      },
    });
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        className="h-9 w-9 items-center justify-center rounded-full bg-primary-600"
      >
        <Center>
          <Text className="font-semibold text-typography-0">{initial}</Text>
        </Center>
      </Pressable>

      <Actionsheet isOpen={open} onClose={() => setOpen(false)}>
        <ActionsheetBackdrop />
        <ActionsheetContent>
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          <VStack space="md" className="w-full p-4">
            <Text className="font-semibold">{data?.display_name ?? data?.email}</Text>
            <HStack space="sm">
              <LanguageToggle />
              <ThemeToggle />
            </HStack>
            <Button action="negative" onPress={onLogout} isDisabled={logout.isPending}>
              <ButtonText>{t('logout')}</ButtonText>
            </Button>
          </VStack>
        </ActionsheetContent>
      </Actionsheet>
    </>
  );
}
