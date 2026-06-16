---
name: nativewind-styling
description: Conventions for styling React Native / Expo apps with NativeWind v4 (Tailwind CSS for RN), as used by gluestack-ui. Use this skill WHENEVER applying or reviewing styling in an RN project that uses NativeWind — picking className utilities, defining or using design tokens, handling dark mode, responsive/platform-specific styles, or debugging "my styles aren't applying". Also use it when setting up NativeWind (metro/babel/tailwind config) or when a screen needs theming consistent with gluestack tokens. Complements the gluestack-ui and react-native-expo skills.
---

# NativeWind styling

NativeWind brings Tailwind CSS to React Native: you style with the `className` prop using Tailwind utilities, which compile to RN styles. It's the styling engine under gluestack-ui. This skill keeps styling consistent, theme-driven, and dark-mode-correct.

## Core model

- Style with `className="..."`, not `StyleSheet.create` or inline `style={{}}`, for anything Tailwind can express. Reserve `style={{}}` for the rare dynamic value Tailwind can't produce (e.g. an animated value).
- RN is not the web: there's **no cascade, no `:hover` on touch, limited selectors**. Most web Tailwind utilities for layout/spacing/color/typography work; web-only ones (grid templates, many pseudo-classes, `space-x` quirks) don't translate cleanly. When in doubt, prefer fl/gap utilities (`flex`, `flex-row`, `items-center`, `justify-between`, `gap-4`).
- Everything is flexbox and **`flex-col` by default** (unlike web's `row`). Be explicit: `flex-row` for horizontal.

## Use design tokens, never raw colors

gluestack/NativeWind apps define a semantic token scale in `tailwind.config` and `global.css` (CSS variables). Style against tokens so light/dark and rebranding "just work":

```tsx
// ✅ token-driven — flips with dark mode, rebrands centrally
<View className="bg-background-0 border border-outline-200">
  <Text className="text-typography-900">Title</Text>
  <Text className="text-typography-500">Subtitle</Text>
</View>

// ❌ hard-coded — breaks dark mode, can't rebrand
<View className="bg-white border border-gray-200">
  <Text className="text-black">Title</Text>
</View>
```

Typical gluestack token families: `primary`, `secondary`, `tertiary`, `typography`, `background`, `outline`, plus semantic `error`/`success`/`warning`/`info`, each with a numeric scale (`0`–`950`). To recolor the app, edit the token values in config — not individual screens.

### OKLCH tokens

When defining or editing the palette, prefer **OKLCH** color values for perceptually uniform scales (consistent lightness steps, predictable dark-mode inversions). Define them as CSS variables consumed by the Tailwind token config, so every `bg-primary-500` etc. resolves through one source.

## Dark mode

NativeWind supports `dark:` variants and gluestack's provider drives the mode. With token classes you rarely need `dark:` at all — `bg-background-0` already resolves to the right value per mode. Reach for explicit `dark:` only for one-off cases token scales can't cover:

```tsx
<View className="bg-background-0 dark:bg-background-50" />
```

Set the mode at the root via `GluestackUIProvider mode="system|light|dark"` (see the gluestack-ui skill). Don't track theme in component state and branch `className` manually — let the provider + tokens do it.

## Responsive & platform

- **Breakpoints**: `sm: md: lg:` work and matter for tablets/foldables and web (gluestack is universal). Design mobile-first, then add larger-screen overrides where needed.
- **Platform-specific**: use `ios:` / `android:` / `web:` variants for genuine per-platform differences (e.g. `ios:pt-12 android:pt-6` for status bars), or fall back to RN `Platform.select` for non-style logic.
- Respect safe areas with `react-native-safe-area-context` (`useSafeAreaInsets` / `SafeAreaView`) rather than hard-coded top padding.

## Composing classes

- Conditional classes: use **clsx** or **tailwind-merge** (`twMerge`) so conflicting utilities resolve predictably and conditionals stay readable.
  ```tsx
  className={twMerge("px-4 py-2", isActive && "bg-primary-500", disabled && "opacity-50")}
  ```
- Repeated patterns: extract a small wrapper component, not a copy-pasted class string. Don't invent a parallel `StyleSheet` system alongside Tailwind.

## Spacing & layout idioms

- Gap between stacked children: `gap-*` (or gluestack `VStack`/`HStack` `space=`), not per-child margins.
- Full-width button/input: `w-full`.
- Screen padding: a consistent `px-4`/`p-4` rhythm; centralize if the app has a standard gutter.

## Setup (when styles don't apply at all)

If `className` does nothing, the wiring is almost always the cause. Verify:
1. `global.css` exists with `@tailwind base; @tailwind components; @tailwind utilities;` and is **imported at the app entry** (root `_layout.tsx`).
2. `tailwind.config.js` `content` globs include `app/**` and `src/**` (and `components/**`).
3. `metro.config.js` wraps config with `withNativeWind(config, { input: "./global.css" })`.
4. `babel.config.js` includes the NativeWind/`jsxImportSource` preset as required by your NativeWind version.
5. The class references a token that actually exists in the config.

This is the most common NativeWind/gluestack issue — it's configuration, not the component.

## Hard "don't"s

- Don't hard-code `text-black`, `bg-white`, `text-gray-500` in a themed app — use token scales.
- Don't mix a `StyleSheet`/inline-`style` styling system with NativeWind for the same concerns.
- Don't assume web Tailwind behavior (cascade, hover, grid) carries over to native.
- Don't branch `className` on a hand-tracked theme flag — drive theming through the provider + tokens.
- Don't hard-code status-bar/notch padding — use safe-area insets.
