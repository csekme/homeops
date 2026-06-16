import { AppIcon } from '@/components/app-icon';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';

type Tone = 'error' | 'success';

const TONE = {
  error: { surface: 'bg-destructive/10', icon: 'alert-circle', iconColor: 'text-destructive', text: 'text-destructive' },
  success: { surface: 'bg-success/10', icon: 'checkmark-circle', iconColor: 'text-success', text: 'text-success' },
} as const;

/** Compact inline alert for form-level messages (auth errors, success confirmations). */
export function FormAlert({ tone = 'error', message }: { tone?: Tone; message: string }) {
  const t = TONE[tone];
  return (
    <HStack space="sm" className={`items-center rounded-xl px-3 py-2.5 ${t.surface}`}>
      <AppIcon name={t.icon} size={18} className={t.iconColor} />
      <Text className={`flex-1 ${t.text}`}>{message}</Text>
    </HStack>
  );
}
