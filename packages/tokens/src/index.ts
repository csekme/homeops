/**
 * Design tokens for HomeOps — shadcn preset `b27JkRsW` (Tailwind v4, OKLCH).
 *
 * Pure data: no DOM, no React Native. Consumed by the web app's Tailwind theme
 * and (later) by the mobile app via NativeWind, so the visual language stays
 * identical across platforms. The light-theme color values here mirror
 * `theme.css`; the `.dark` overrides live in the CSS file only.
 *
 * A clean neutral + blue theme.
 */

/** Light-theme color tokens, expressed as OKLCH strings. */
export const colors = {
  background: "oklch(1 0 0)",
  foreground: "oklch(0.141 0.005 285.823)",

  card: "oklch(1 0 0)",
  cardForeground: "oklch(0.141 0.005 285.823)",

  popover: "oklch(1 0 0)",
  popoverForeground: "oklch(0.141 0.005 285.823)",

  primary: "oklch(0.546 0.215 262.881)",
  primaryForeground: "oklch(0.97 0.014 254.604)",

  secondary: "oklch(0.967 0.001 286.375)",
  secondaryForeground: "oklch(0.21 0.006 285.885)",

  muted: "oklch(0.967 0.001 286.375)",
  mutedForeground: "oklch(0.552 0.016 285.938)",

  accent: "oklch(0.967 0.001 286.375)",
  accentForeground: "oklch(0.21 0.006 285.885)",

  destructive: "oklch(0.577 0.245 27.325)",
  destructiveForeground: "oklch(0.97 0.014 254.604)",

  border: "oklch(0.92 0.004 286.32)",
  input: "oklch(0.92 0.004 286.32)",
  ring: "oklch(0.546 0.215 262.881)",

  sidebar: "oklch(0.985 0 0)",
  sidebarForeground: "oklch(0.141 0.005 285.823)",
  sidebarPrimary: "oklch(0.546 0.215 262.881)",
  sidebarPrimaryForeground: "oklch(0.97 0.014 254.604)",
  sidebarAccent: "oklch(0.967 0.001 286.375)",
  sidebarAccentForeground: "oklch(0.21 0.006 285.885)",
  sidebarBorder: "oklch(0.92 0.004 286.32)",
  sidebarRing: "oklch(0.546 0.215 262.881)",

  chart1: "oklch(0.646 0.222 41.116)",
  chart2: "oklch(0.6 0.118 184.704)",
  chart3: "oklch(0.398 0.07 227.392)",
  chart4: "oklch(0.828 0.189 84.429)",
  chart5: "oklch(0.769 0.188 70.08)",
} as const;

/** Spacing scale (rem). Matches Tailwind's default 4px step base. */
export const spacing = {
  px: "1px",
  0: "0rem",
  1: "0.25rem",
  2: "0.5rem",
  3: "0.75rem",
  4: "1rem",
  5: "1.25rem",
  6: "1.5rem",
  8: "2rem",
  10: "2.5rem",
  12: "3rem",
  16: "4rem",
  20: "5rem",
  24: "6rem",
} as const;

/** Corner radius scale. The base `--radius` is 0.625rem (10px). */
export const radius = {
  base: "0.625rem",
  sm: "calc(0.625rem - 4px)",
  md: "calc(0.625rem - 2px)",
  lg: "0.625rem",
  xl: "calc(0.625rem + 4px)",
  full: "9999px",
} as const;

/** Typography: font families and a type scale. */
export const typography = {
  fontFamily: {
    sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
  },
  fontSize: {
    xs: "0.75rem",
    sm: "0.875rem",
    base: "1rem",
    lg: "1.125rem",
    xl: "1.25rem",
    "2xl": "1.5rem",
    "3xl": "1.875rem",
    "4xl": "2.25rem",
  },
  fontWeight: {
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
  lineHeight: {
    tight: "1.25",
    normal: "1.5",
    relaxed: "1.625",
  },
} as const;

/** The full typed token object. */
export const tokens = {
  colors,
  spacing,
  radius,
  typography,
} as const;

export type Tokens = typeof tokens;
export type Colors = typeof colors;
export type Spacing = typeof spacing;
export type Radius = typeof radius;
export type Typography = typeof typography;

export default tokens;
