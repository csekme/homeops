import { Platform } from 'react-native';

import { Icon, MenuIcon } from '@/components/ui/icon';
import { GlassView } from '@/components/ui/liquid-glass';
import { Pressable } from '@/components/ui/pressable';

/**
 * Opens the app drawer. Android keeps the plain header hamburger; iOS gets a floating
 * "liquid glass" pill (gluestack GlassView → expo-glass-effect) the parent positions over
 * the content. GlassView already falls back to a standard blur on older iOS.
 */
export function DrawerToggleButton({ onPress, label }: { onPress: () => void; label: string }) {
  if (Platform.OS !== 'ios') {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        className="h-10 w-10 items-center justify-center rounded-md"
      >
        <Icon as={MenuIcon} size="xl" className="text-foreground" />
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <GlassView
        glassEffectStyle="regular"
        className="h-11 w-11 items-center justify-center overflow-hidden rounded-full"
      >
        <Icon as={MenuIcon} size="xl" className="text-foreground" />
      </GlassView>
    </Pressable>
  );
}
