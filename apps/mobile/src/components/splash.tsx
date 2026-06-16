import { Center } from '@/components/ui/center';
import { Spinner } from '@/components/ui/spinner';

/** Boot splash shown while the silent refresh + i18n load settle (plan §M2). */
export function Splash() {
  return (
    <Center className="flex-1 bg-background">
      <Spinner size="large" />
    </Center>
  );
}
