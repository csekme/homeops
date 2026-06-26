import {
  FileTextIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  ReceiptIcon,
  SettingsIcon,
  WrenchIcon,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router-dom';

import { HouseholdSwitcher } from '@/components/household-switcher';
import { NavUser } from '@/components/nav-user';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';

interface NavItem {
  to: string;
  labelKey: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', labelKey: 'nav.dashboard', icon: LayoutDashboardIcon },
  { to: '/obligations', labelKey: 'nav.obligations', icon: ListChecksIcon },
  { to: '/expenses', labelKey: 'nav.expenses', icon: ReceiptIcon },
  { to: '/services', labelKey: 'nav.services', icon: WrenchIcon },
  { to: '/documents', labelKey: 'nav.documents', icon: FileTextIcon },
  { to: '/settings', labelKey: 'nav.settings', icon: SettingsIcon },
];

export function AppSidebar() {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  const isActivePath = (to: string) =>
    to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <HouseholdSwitcher />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActivePath(item.to)}
                    tooltip={t(item.labelKey)}
                  >
                    <NavLink to={item.to} end={item.to === '/'}>
                      <item.icon />
                      <span>{t(item.labelKey)}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
