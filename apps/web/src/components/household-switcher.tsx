/**
 * Household switcher pinned to the SidebarHeader (feature plan §#3, shadcn "team-switcher"
 * pattern). Shows the active household name + the caller's role, with a dropdown to switch
 * between households and a "Create household" action. Makes the active tenant — previously
 * invisible — obvious at a glance.
 */
import { useGetMe } from '@homeops/api-client';
import { ChevronsUpDownIcon, HouseIcon, PlusIcon, SettingsIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { CreateHouseholdDialog } from '@/components/create-household-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar';
import { useActiveHousehold, useHouseholdSwitcher } from '@/features/households/use-households';

export function HouseholdSwitcher() {
  const { t } = useTranslation();
  const { t: th } = useTranslation('households');
  const navigate = useNavigate();
  const { isMobile } = useSidebar();
  const { data: user } = useGetMe();
  const { activeHouseholdId, role } = useActiveHousehold();
  const { switchTo, isPending: switching } = useHouseholdSwitcher();
  const [createOpen, setCreateOpen] = useState(false);

  const memberships = user?.memberships ?? [];
  const active = memberships.find((m) => m.household_id === activeHouseholdId);
  // Primary line: active household name, or a neutral prompt before one is selected/created.
  const primary = active?.household_name ?? t('appName');
  const secondary = role ? th(`roles.${role}`) : th('switcher.none');

  const onSelectHousehold = (householdId: string) => {
    if (householdId !== activeHouseholdId) switchTo(householdId);
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <HouseIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{primary}</span>
                <span className="truncate text-xs text-muted-foreground">{secondary}</span>
              </div>
              <ChevronsUpDownIcon className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
            align="start"
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {th('switcher.label')}
            </DropdownMenuLabel>
            {memberships.length > 0 ? (
              <DropdownMenuRadioGroup value={activeHouseholdId} onValueChange={onSelectHousehold}>
                {memberships.map((m) => (
                  <DropdownMenuRadioItem
                    key={m.household_id}
                    value={m.household_id ?? ''}
                    disabled={switching}
                  >
                    <span className="truncate">{m.household_name}</span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            ) : (
              <DropdownMenuItem disabled className="text-xs">
                {th('switcher.none')}
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />
            {activeHouseholdId ? (
              <DropdownMenuItem onSelect={() => navigate('/household')}>
                <SettingsIcon />
                {th('switcher.manage')}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onSelect={() => setCreateOpen(true)}>
              <PlusIcon />
              {th('switcher.create')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>

      <CreateHouseholdDialog open={createOpen} onOpenChange={setCreateOpen} />
    </SidebarMenu>
  );
}
