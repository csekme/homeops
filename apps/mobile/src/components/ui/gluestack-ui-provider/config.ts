'use client';
import { vars } from 'nativewind';

/*
 * Semantic theme tokens injected on the native tree by `GluestackUIProvider`
 * (`config[colorScheme]` is applied as a root style). These are the same shadcn-style
 * semantic vars the web app uses via `@homeops/tokens`, mirrored in `global.css` for web.
 * Values are space-separated R G B channel triplets so `<alpha-value>` works (`bg-primary/90`).
 */
export const config = {
  light: vars({
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
    '--success': '22 163 74',
    '--success-foreground': '255 255 255',
    '--warning': '217 119 6',
    '--warning-foreground': '255 255 255',
    '--info': '37 99 235',
    '--info-foreground': '255 255 255',
    '--border': '228 228 231',
    '--input': '228 228 231',
    '--ring': '37 99 235',
  }),
  dark: vars({
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
    '--success': '34 197 94',
    '--success-foreground': '255 255 255',
    '--warning': '245 158 11',
    '--warning-foreground': '255 255 255',
    '--info': '59 130 246',
    '--info-foreground': '255 255 255',
    '--border': '39 39 42',
    '--input': '46 46 48',
    '--ring': '43 127 255',
  }),
};
