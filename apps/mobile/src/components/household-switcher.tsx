import { useMe } from '@homeops/api-client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetItem,
  ActionsheetItemText,
} from '@/components/ui/actionsheet';
import { Button, ButtonText } from '@/components/ui/button';

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

  return (
    <>
      <Button
        variant="outline"
        action="secondary"
        size="sm"
        isDisabled={memberships.length === 0}
        onPress={() => setOpen(true)}
      >
        <ButtonText>{label}</ButtonText>
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
