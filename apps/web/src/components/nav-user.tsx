import { useGetMe, useLogout } from '@homeops/api-client';
import { ChevronsUpDownIcon, LogOutIcon, SettingsIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar';
import { useActiveHousehold } from '@/features/households/use-households';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/**
 * Canonical shadcn "NavUser" — the account menu pinned to the SidebarFooter. Household
 * switching now lives in the SidebarHeader's HouseholdSwitcher (feature plan §#3); this menu
 * keeps account-scoped actions (settings, logout) and surfaces the user's role for context.
 */
export function NavUser() {
  const { t } = useTranslation();
  const { t: th } = useTranslation('households');
  const navigate = useNavigate();
  const { isMobile } = useSidebar();
  const { data: user } = useGetMe();
  const logout = useLogout();
  const { role } = useActiveHousehold();

  if (!user) return null;

  const onLogout = () =>
    logout.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) });

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
                {user.avatar_url ? (
                  <AvatarImage className="rounded-lg" src={user.avatar_url} alt="" />
                ) : null}
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
            <DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
              <span className="truncate text-sm font-medium">{user.display_name}</span>
              <span className="truncate text-xs text-muted-foreground">{user.email}</span>
              {role ? (
                <span className="truncate text-xs text-muted-foreground">{th(`roles.${role}`)}</span>
              ) : null}
            </DropdownMenuLabel>

            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate('/settings')}>
              <SettingsIcon />
              {t('nav.settings')}
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onLogout} disabled={logout.isPending}>
              <LogOutIcon />
              {t('logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
