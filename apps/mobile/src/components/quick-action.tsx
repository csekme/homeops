import { Link, type Href } from 'expo-router';

import { type AppIconName } from '@/components/app-icon';
import { IconBadge } from '@/components/icon-badge';
import { Card } from '@/components/ui/card';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

interface QuickActionProps {
  href: Href;
  icon: AppIconName;
  label: string;
}

/**
 * Tappable shortcut tile used in the dashboard quick-actions grid: a leading icon badge over a
 * label, wrapped in an elevated card that routes to a tab. `flex-1` so a row of tiles shares the
 * available width evenly.
 */
export function QuickAction({ href, icon, label }: QuickActionProps) {
  return (
    <Link href={href} asChild>
      <Pressable className="flex-1 active:opacity-80">
        <Card
          variant="elevated"
          className="rounded-2xl border border-border shadow-soft-1"
        >
          <VStack space="md">
            <IconBadge name={icon} />
            <Text className="font-semibold text-foreground">{label}</Text>
          </VStack>
        </Card>
      </Pressable>
    </Link>
  );
}
