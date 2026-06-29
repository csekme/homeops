import { useTranslation } from 'react-i18next';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AvatarCard } from '@/features/profile/avatar-card';
import { DevicesCard } from '@/features/security/devices-card';
import { TwoFactorCard } from '@/features/security/two-factor-card';

export default function SettingsPage() {
  const { t } = useTranslation('settings');

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">{t('profile.tabLabel')}</TabsTrigger>
          <TabsTrigger value="security">{t('security.tabLabel')}</TabsTrigger>
        </TabsList>
        <TabsContent value="profile" className="mt-4 flex max-w-2xl flex-col gap-6">
          <AvatarCard />
        </TabsContent>
        <TabsContent value="security" className="mt-4 flex max-w-2xl flex-col gap-6">
          <TwoFactorCard />
          <DevicesCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
