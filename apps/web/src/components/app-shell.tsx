import { useTranslation } from 'react-i18next';
import { Outlet, useLocation } from 'react-router-dom';

import { AppSidebar } from '@/components/app-sidebar';
import { LanguageToggle } from '@/components/language-toggle';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';

const SEGMENT_LABEL_KEYS: Record<string, string> = {
  '': 'nav.dashboard',
  obligations: 'nav.obligations',
  expenses: 'nav.expenses',
  services: 'nav.services',
  documents: 'nav.documents',
  settings: 'nav.settings',
};

export function AppShell() {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  const segment = pathname.split('/')[1] ?? '';
  const labelKey = SEGMENT_LABEL_KEYS[segment] ?? 'nav.dashboard';

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>{t(labelKey)}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto flex items-center gap-1">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </header>
        <ScrollArea className="flex-1">
          <div className="p-4 md:p-6">
            <Outlet />
          </div>
        </ScrollArea>
      </SidebarInset>
    </SidebarProvider>
  );
}
