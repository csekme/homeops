import { AppIcon, type AppIconName } from '@/components/app-icon';
import { Center } from '@/components/ui/center';

type Tone = 'primary' | 'success' | 'warning' | 'error' | 'info' | 'muted';

const TONE: Record<Tone, { surface: string; icon: string }> = {
  primary: { surface: 'bg-primary/10', icon: 'text-primary' },
  success: { surface: 'bg-success/10', icon: 'text-success' },
  warning: { surface: 'bg-warning/10', icon: 'text-warning' },
  error: { surface: 'bg-destructive/10', icon: 'text-destructive' },
  info: { surface: 'bg-info/10', icon: 'text-info' },
  muted: { surface: 'bg-muted', icon: 'text-muted-foreground' },
};

const SIZE = {
  md: { box: 'h-11 w-11 rounded-xl', glyph: 22 },
  lg: { box: 'h-16 w-16 rounded-2xl', glyph: 30 },
} as const;

interface IconBadgeProps {
  name: AppIconName;
  tone?: Tone;
  size?: keyof typeof SIZE;
}

/**
 * A tinted rounded square holding an icon — the recurring "leading visual" in the HomeOps UI
 * (empty states, list rows, section headers, quick actions). Tone classes are token-based, so
 * the badge recolours and dark-mode-flips with the rest of the theme.
 */
export function IconBadge({ name, tone = 'primary', size = 'md' }: IconBadgeProps) {
  const palette = TONE[tone];
  const dims = SIZE[size];
  return (
    <Center className={`${dims.box} ${palette.surface}`}>
      <AppIcon name={name} size={dims.glyph} className={palette.icon} />
    </Center>
  );
}
