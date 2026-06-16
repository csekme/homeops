import { useTranslation } from 'react-i18next';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TwoFactorCard } from '@/features/security/two-factor-card';

export default function SettingsPage() {
  const { t } = useTranslation('settings');

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>

      <Tabs defaultValue="security">
        <TabsList>
          <TabsTrigger value="security">{t('security.tabLabel')}</TabsTrigger>
        </TabsList>
        <TabsContent value="security" className="mt-4 max-w-2xl">
          <TwoFactorCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
