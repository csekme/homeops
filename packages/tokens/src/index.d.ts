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
export declare const colors: {
    readonly background: "oklch(1 0 0)";
    readonly foreground: "oklch(0.141 0.005 285.823)";
    readonly card: "oklch(1 0 0)";
    readonly cardForeground: "oklch(0.141 0.005 285.823)";
    readonly popover: "oklch(1 0 0)";
    readonly popoverForeground: "oklch(0.141 0.005 285.823)";
    readonly primary: "oklch(0.546 0.215 262.881)";
    readonly primaryForeground: "oklch(0.97 0.014 254.604)";
    readonly secondary: "oklch(0.967 0.001 286.375)";
    readonly secondaryForeground: "oklch(0.21 0.006 285.885)";
    readonly muted: "oklch(0.967 0.001 286.375)";
    readonly mutedForeground: "oklch(0.552 0.016 285.938)";
    readonly accent: "oklch(0.967 0.001 286.375)";
    readonly accentForeground: "oklch(0.21 0.006 285.885)";
    readonly destructive: "oklch(0.577 0.245 27.325)";
    readonly destructiveForeground: "oklch(0.97 0.014 254.604)";
    readonly border: "oklch(0.92 0.004 286.32)";
    readonly input: "oklch(0.92 0.004 286.32)";
    readonly ring: "oklch(0.546 0.215 262.881)";
    readonly sidebar: "oklch(0.985 0 0)";
    readonly sidebarForeground: "oklch(0.141 0.005 285.823)";
    readonly sidebarPrimary: "oklch(0.546 0.215 262.881)";
    readonly sidebarPrimaryForeground: "oklch(0.97 0.014 254.604)";
    readonly sidebarAccent: "oklch(0.967 0.001 286.375)";
    readonly sidebarAccentForeground: "oklch(0.21 0.006 285.885)";
    readonly sidebarBorder: "oklch(0.92 0.004 286.32)";
    readonly sidebarRing: "oklch(0.546 0.215 262.881)";
    readonly chart1: "oklch(0.646 0.222 41.116)";
    readonly chart2: "oklch(0.6 0.118 184.704)";
    readonly chart3: "oklch(0.398 0.07 227.392)";
    readonly chart4: "oklch(0.828 0.189 84.429)";
    readonly chart5: "oklch(0.769 0.188 70.08)";
};
/** Spacing scale (rem). Matches Tailwind's default 4px step base. */
export declare const spacing: {
    readonly px: "1px";
    readonly 0: "0rem";
    readonly 1: "0.25rem";
    readonly 2: "0.5rem";
    readonly 3: "0.75rem";
    readonly 4: "1rem";
    readonly 5: "1.25rem";
    readonly 6: "1.5rem";
    readonly 8: "2rem";
    readonly 10: "2.5rem";
    readonly 12: "3rem";
    readonly 16: "4rem";
    readonly 20: "5rem";
    readonly 24: "6rem";
};
/** Corner radius scale. The base `--radius` is 0.625rem (10px). */
export declare const radius: {
    readonly base: "0.625rem";
    readonly sm: "calc(0.625rem - 4px)";
    readonly md: "calc(0.625rem - 2px)";
    readonly lg: "0.625rem";
    readonly xl: "calc(0.625rem + 4px)";
    readonly full: "9999px";
};
/** Typography: font families and a type scale. */
export declare const typography: {
    readonly fontFamily: {
        readonly sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
        readonly mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';
    };
    readonly fontSize: {
        readonly xs: "0.75rem";
        readonly sm: "0.875rem";
        readonly base: "1rem";
        readonly lg: "1.125rem";
        readonly xl: "1.25rem";
        readonly "2xl": "1.5rem";
        readonly "3xl": "1.875rem";
        readonly "4xl": "2.25rem";
    };
    readonly fontWeight: {
        readonly normal: "400";
        readonly medium: "500";
        readonly semibold: "600";
        readonly bold: "700";
    };
    readonly lineHeight: {
        readonly tight: "1.25";
        readonly normal: "1.5";
        readonly relaxed: "1.625";
    };
};
/** The full typed token object. */
export declare const tokens: {
    readonly colors: {
        readonly background: "oklch(1 0 0)";
        readonly foreground: "oklch(0.141 0.005 285.823)";
        readonly card: "oklch(1 0 0)";
        readonly cardForeground: "oklch(0.141 0.005 285.823)";
        readonly popover: "oklch(1 0 0)";
        readonly popoverForeground: "oklch(0.141 0.005 285.823)";
        readonly primary: "oklch(0.546 0.215 262.881)";
        readonly primaryForeground: "oklch(0.97 0.014 254.604)";
        readonly secondary: "oklch(0.967 0.001 286.375)";
        readonly secondaryForeground: "oklch(0.21 0.006 285.885)";
        readonly muted: "oklch(0.967 0.001 286.375)";
        readonly mutedForeground: "oklch(0.552 0.016 285.938)";
        readonly accent: "oklch(0.967 0.001 286.375)";
        readonly accentForeground: "oklch(0.21 0.006 285.885)";
        readonly destructive: "oklch(0.577 0.245 27.325)";
        readonly destructiveForeground: "oklch(0.97 0.014 254.604)";
        readonly border: "oklch(0.92 0.004 286.32)";
        readonly input: "oklch(0.92 0.004 286.32)";
        readonly ring: "oklch(0.546 0.215 262.881)";
        readonly sidebar: "oklch(0.985 0 0)";
        readonly sidebarForeground: "oklch(0.141 0.005 285.823)";
        readonly sidebarPrimary: "oklch(0.546 0.215 262.881)";
        readonly sidebarPrimaryForeground: "oklch(0.97 0.014 254.604)";
        readonly sidebarAccent: "oklch(0.967 0.001 286.375)";
        readonly sidebarAccentForeground: "oklch(0.21 0.006 285.885)";
        readonly sidebarBorder: "oklch(0.92 0.004 286.32)";
        readonly sidebarRing: "oklch(0.546 0.215 262.881)";
        readonly chart1: "oklch(0.646 0.222 41.116)";
        readonly chart2: "oklch(0.6 0.118 184.704)";
        readonly chart3: "oklch(0.398 0.07 227.392)";
        readonly chart4: "oklch(0.828 0.189 84.429)";
        readonly chart5: "oklch(0.769 0.188 70.08)";
    };
    readonly spacing: {
        readonly px: "1px";
        readonly 0: "0rem";
        readonly 1: "0.25rem";
        readonly 2: "0.5rem";
        readonly 3: "0.75rem";
        readonly 4: "1rem";
        readonly 5: "1.25rem";
        readonly 6: "1.5rem";
        readonly 8: "2rem";
        readonly 10: "2.5rem";
        readonly 12: "3rem";
        readonly 16: "4rem";
        readonly 20: "5rem";
        readonly 24: "6rem";
    };
    readonly radius: {
        readonly base: "0.625rem";
        readonly sm: "calc(0.625rem - 4px)";
        readonly md: "calc(0.625rem - 2px)";
        readonly lg: "0.625rem";
        readonly xl: "calc(0.625rem + 4px)";
        readonly full: "9999px";
    };
    readonly typography: {
        readonly fontFamily: {
            readonly sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
            readonly mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';
        };
        readonly fontSize: {
            readonly xs: "0.75rem";
            readonly sm: "0.875rem";
            readonly base: "1rem";
            readonly lg: "1.125rem";
            readonly xl: "1.25rem";
            readonly "2xl": "1.5rem";
            readonly "3xl": "1.875rem";
            readonly "4xl": "2.25rem";
        };
        readonly fontWeight: {
            readonly normal: "400";
            readonly medium: "500";
            readonly semibold: "600";
            readonly bold: "700";
        };
        readonly lineHeight: {
            readonly tight: "1.25";
            readonly normal: "1.5";
            readonly relaxed: "1.625";
        };
    };
};
export type Tokens = typeof tokens;
export type Colors = typeof colors;
export type Spacing = typeof spacing;
export type Radius = typeof radius;
export type Typography = typeof typography;
export default tokens;
