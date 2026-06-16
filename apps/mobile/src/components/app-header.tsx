import { SafeAreaView } from 'react-native-safe-area-context';

import { HouseholdSwitcher } from '@/components/household-switcher';
import { NavUser } from '@/components/nav-user';
import { HStack } from '@/components/ui/hstack';

/** Shell header (plan §U2): household switcher on the left, user menu on the right. */
export function AppHeader() {
  return (
    <SafeAreaView edges={['top']} className="bg-background-0">
      <HStack className="items-center justify-between border-b border-outline-200 px-4 py-2">
        <HouseholdSwitcher />
        <NavUser />
      </HStack>
    </SafeAreaView>
  );
}
