import { useMe } from '@homeops/api-client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AppIcon } from '@/components/app-icon';
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetItem,
  ActionsheetItemText,
} from '@/components/ui/actionsheet';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Center } from '@/components/ui/center';
import { ChevronDownIcon } from '@/components/ui/icon';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';

/**
 * Household switcher (plan §U2). Lists `useMe().memberships`; in Phase 0 memberships is `[]`
 * (household endpoints land in Phase 1), so the trigger is disabled — the UI + selection
 * state are ready for Phase 1.
 */
export function HouseholdSwitcher() {
  const { t } = useTranslation('common');
  const { data } = useMe();
  const memberships = data?.memberships ?? [];
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(memberships[0]?.household_id ?? null);

  const active = memberships.find((m) => m.household_id === activeId) ?? memberships[0];
  const label = active?.household_name ?? t('households');

  // Phase 0: no household endpoints yet → memberships is empty. Rather than a dead, disabled
  // switcher, show the brand lockup; the switcher returns once memberships exist (Phase 1).
  if (memberships.length === 0) {
    return (
      <HStack space="sm" className="items-center">
        <Center className="h-8 w-8 rounded-lg bg-primary">
          <AppIcon name="home" size={18} className="text-primary-foreground" />
        </Center>
        <Heading size="md" className="text-foreground">
          {t('appName')}
        </Heading>
      </HStack>
    );
  }

  return (
    <>
      <Button variant="outline" action="secondary" size="sm" onPress={() => setOpen(true)}>
        <ButtonText>{label}</ButtonText>
        <ButtonIcon as={ChevronDownIcon} className="ml-1" />
      </Button>

      <Actionsheet isOpen={open} onClose={() => setOpen(false)}>
        <ActionsheetBackdrop />
        <ActionsheetContent>
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          {memberships.map((m) => (
            <ActionsheetItem
              key={m.household_id}
              onPress={() => {
                setActiveId(m.household_id);
                setOpen(false);
              }}
            >
              <ActionsheetItemText>{m.household_name}</ActionsheetItemText>
            </ActionsheetItem>
          ))}
        </ActionsheetContent>
      </Actionsheet>
    </>
  );
}
