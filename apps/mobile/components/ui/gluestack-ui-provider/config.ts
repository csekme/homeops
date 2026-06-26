import { vars } from 'nativewind';

/**
 * HomeOps theme for gluestack-ui / NativeWind.
 *
 * These RGB triples are the mobile mirror of the web design tokens: they are the
 * OKLCH values from `@homeops/tokens` (`packages/tokens/src/theme.css`) converted
 * to sRGB so the brand looks identical on web and native. The tailwind config
 * consumes them as `rgb(var(--token) / <alpha-value>)`.
 */

// Font stacks (mirrors @homeops/tokens typography). Native falls back to the system
// font; the vars keep the gluestack `font-*` utilities resolvable.
const fonts = {
  '--font-sans': 'System',
  '--font-body': 'System',
  '--font-serif': 'serif',
  '--font-mono': 'monospace',
  '--font-inter': 'System',
};

// Raw color values - update these and they sync everywhere
export const colors = {
  light: {
    '--background': '255 255 255',
    '--foreground': '9 9 11',
    '--card': '255 255 255',
    '--card-foreground': '9 9 11',
    '--popover': '255 255 255',
    '--popover-foreground': '9 9 11',
    '--primary': '37 99 235',
    '--primary-foreground': '239 246 255',
    '--secondary': '244 244 245',
    '--secondary-foreground': '24 24 27',
    '--muted': '244 244 245',
    '--muted-foreground': '113 113 123',
    '--accent': '244 244 245',
    '--accent-foreground': '24 24 27',
    '--destructive': '231 0 11',
    '--destructive-foreground': '239 246 255',
    '--border': '228 228 231',
    '--input': '228 228 231',
    '--ring': '37 99 235',
    '--chart-1': '245 73 0',
    '--chart-2': '0 150 137',
    '--chart-3': '16 78 100',
    '--chart-4': '255 185 0',
    '--chart-5': '254 154 0',
    '--sidebar': '250 250 250',
    '--sidebar-foreground': '9 9 11',
    '--sidebar-primary': '37 99 235',
    '--sidebar-primary-foreground': '239 246 255',
    '--sidebar-accent': '244 244 245',
    '--sidebar-accent-foreground': '24 24 27',
    '--sidebar-border': '228 228 231',
    '--sidebar-ring': '37 99 235',
    ...fonts,
  },
  dark: {
    '--background': '9 9 11',
    '--foreground': '250 250 250',
    '--card': '24 24 27',
    '--card-foreground': '250 250 250',
    '--popover': '24 24 27',
    '--popover-foreground': '250 250 250',
    '--primary': '43 127 255',
    '--primary-foreground': '239 246 255',
    '--secondary': '39 39 42',
    '--secondary-foreground': '250 250 250',
    '--muted': '39 39 42',
    '--muted-foreground': '159 159 169',
    '--accent': '39 39 42',
    '--accent-foreground': '250 250 250',
    '--destructive': '255 100 103',
    '--destructive-foreground': '250 250 250',
    '--border': '34 34 36',
    '--input': '46 46 48',
    '--ring': '43 127 255',
    '--chart-1': '20 71 230',
    '--chart-2': '0 188 125',
    '--chart-3': '254 154 0',
    '--chart-4': '173 70 255',
    '--chart-5': '255 32 86',
    '--sidebar': '24 24 27',
    '--sidebar-foreground': '250 250 250',
    '--sidebar-primary': '43 127 255',
    '--sidebar-primary-foreground': '239 246 255',
    '--sidebar-accent': '39 39 42',
    '--sidebar-accent-foreground': '250 250 250',
    '--sidebar-border': '34 34 36',
    '--sidebar-ring': '43 127 255',
    ...fonts,
  },
};

// Config for nativewind vars() - used by provider
export const config = {
  light: vars(colors.light),
  dark: vars(colors.dark),
};
