import { useGetMe, useLogout } from '@homeops/api-client';
import { ChevronsUpDownIcon, LogOutIcon, PlusIcon, SettingsIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { CreateHouseholdDialog } from '@/components/create-household-dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/** Canonical shadcn "NavUser" — account menu + household switcher pinned to the SidebarFooter. */
export function NavUser() {
  const { t } = useTranslation();
  const { t: th } = useTranslation('households');
  const navigate = useNavigate();
  const { isMobile } = useSidebar();
  const { data: user } = useGetMe();
  const logout = useLogout();
  const { activeHouseholdId } = useActiveHousehold();
  const { switchTo, isPending: switching } = useHouseholdSwitcher();
  const [createOpen, setCreateOpen] = useState(false);

  if (!user) return null;

  const memberships = user.memberships ?? [];

  const onLogout = () =>
    logout.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) });

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
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="rounded-lg text-xs">
                  {initials(user.display_name ?? '?')}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.display_name}</span>
                <span className="truncate text-xs text-muted-foreground">{user.email}</span>
              </div>
              <ChevronsUpDownIcon className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {th('switcher.label')}
            </DropdownMenuLabel>
            {memberships.length > 0 ? (
              <DropdownMenuRadioGroup
                value={activeHouseholdId}
                onValueChange={onSelectHousehold}
              >
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

            <DropdownMenuItem onSelect={() => setCreateOpen(true)}>
              <PlusIcon />
              {th('switcher.create')}
            </DropdownMenuItem>
            {activeHouseholdId ? (
              <DropdownMenuItem onSelect={() => navigate('/household')}>
                <SettingsIcon />
                {th('switcher.manage')}
              </DropdownMenuItem>
            ) : null}

            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onLogout} disabled={logout.isPending}>
              <LogOutIcon />
              {t('logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>

      <CreateHouseholdDialog open={createOpen} onOpenChange={setCreateOpen} />
    </SidebarMenu>
  );
}
