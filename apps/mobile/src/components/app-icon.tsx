import { Ionicons } from '@expo/vector-icons';
import { cssInterop } from 'nativewind';

/**
 * Theme-aware Ionicons wrapper (plan §M.2). `@expo/vector-icons` is an icon font, so it does
 * not understand NativeWind `className` out of the box — we map the resolved `color` style back
 * onto the native `color` prop via `cssInterop`. This lets every icon recolour through token
 * classes (`text-primary`, `text-muted-foreground`) and flip automatically with dark mode,
 * instead of hard-coding hex values per call site.
 *
 * Usage: `<AppIcon name="home-outline" size={22} className="text-primary" />`.
 */
export const AppIcon = cssInterop(Ionicons, {
  className: {
    target: 'style',
    nativeStyleToProp: { color: true },
  },
});

export type AppIconName = keyof typeof Ionicons.glyphMap;
