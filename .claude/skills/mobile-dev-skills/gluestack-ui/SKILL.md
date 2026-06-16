---
name: gluestack-ui
description: Enforce correct gluestack-ui (v2/v3) usage in React Native / Expo apps. Use this skill WHENEVER the task involves building or editing UI in a project that uses gluestack-ui — including adding screens, buttons, forms, modals, layouts, lists, or styling components — even if the user only says "build a screen", "add a form", "make this look better", or names a gluestack component. Also use it when reviewing RN UI code for gluestack correctness, migrating from gluestack v1 / NativeBase, or wiring up GluestackUIProvider and theming. If the repo has a `components/ui/` folder with gluestack components or `gluestack-ui` in package.json, this skill applies.
---

# gluestack-ui

gluestack-ui is a **copy-paste** component library (like shadcn/ui, but for React Native + web) styled with **NativeWind** (Tailwind CSS for RN). Components are not imported from `node_modules` — they live as editable source inside the project, usually under `components/ui/<component>/`. Styling is done with Tailwind utility classes via the `className` prop.

This skill encodes how to use it correctly. The single most common failure is mixing the **legacy v1 API** (`@gluestack-ui/themed`, `sx={{...}}`, `$token` style props, `bg="$red500"`) with the **modern v2/v3 API** (`className="bg-red-500"`). They are incompatible. Pick the modern API and never reach for v1 props.

## Step 0 — Detect the setup before writing any UI

Read these to know what you're working with. Don't assume.

1. `package.json` → confirm `nativewind`, `tailwindcss`, and a gluestack CLI/version. CLI `gluestack-ui` `3.x` = v3, `2.x`/v2-era = v2. The component-level API is the same for both; v3 adds RSC/Expo-SDK-53 internals and a `Grid` primitive.
2. `components/ui/` → the list of components already installed. **Only import components that exist here.** If a needed one is missing, add it via the CLI (see below) rather than hand-writing it.
3. `tailwind.config.js` (or `.ts`) and `global.css` → the design tokens (`primary`, `secondary`, `typography`, etc.) and the `@tailwind` directives.
4. Where `GluestackUIProvider` wraps the app (usually `app/_layout.tsx` in Expo Router, or the root component). It must wrap everything that renders gluestack components.

## Adding / updating components — use the CLI, don't hand-roll

```bash
npx gluestack-ui init          # one-time: adds GluestackUIProvider + icon/overlay/toast + config
npx gluestack-ui add button    # add a single component into components/ui/button/
npx gluestack-ui add --all     # add every component
npx gluestack-ui update button # pull the latest version of an existing component
```

Hand-writing a component from scratch defeats the point: you lose accessibility wiring, the variant system, and dark-mode support that the generated source provides. If a component already exists in `components/ui/`, edit that source rather than re-adding it (re-adding can overwrite local changes).

## Core usage rules

### 1. Use the compound-component pattern — never put text directly in `<Button>`

gluestack components are composed of named subcomponents. Text, icons, and spinners are explicit children, not props.

```tsx
import { Button, ButtonText, ButtonIcon, ButtonSpinner } from "@/components/ui/button";
import { AddIcon } from "@/components/ui/icon";

// ✅ correct
<Button size="md" variant="solid" action="primary" onPress={onSave}>
  <ButtonIcon as={AddIcon} />
  <ButtonText>Save</ButtonText>
</Button>

// ❌ wrong — text as a child string, no ButtonText
<Button>Save</Button>
```

The same pattern applies across the library: `FormControl` + `FormControlLabel` + `FormControlError`, `Alert` + `AlertText` + `AlertIcon`, `Toast` + `ToastTitle` + `ToastDescription`, `Avatar` + `AvatarImage` + `AvatarFallbackText`, etc. See `references/components.md` for the catalog.

### 2. Variants come from props; everything else comes from `className`

Each component exposes a small set of semantic props — typically `size`, `variant`, and `action`. Use them for the variant; use `className` (NativeWind) for any other styling.

```tsx
// Button props: size = xs|sm|md|lg|xl, variant = solid|outline|link,
//               action = primary|secondary|positive|negative
<Button size="lg" variant="outline" action="negative" className="w-full mt-4">
  <ButtonText>Delete</ButtonText>
</Button>
```

Don't fight the variant system with `className` overrides when a prop exists — set `action="negative"` rather than `className="bg-red-500"`, so theming and dark mode stay consistent.

### 3. Layout with primitives, not raw `View` + fl. Use Box / HStack / VStack / Center

```tsx
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Box } from "@/components/ui/box";
import { Center } from "@/components/ui/center";

<VStack space="md" className="p-4">
  <HStack space="sm" className="items-center justify-between">
    {/* ... */}
  </HStack>
</VStack>
```

`space` on `VStack`/`HStack` is the gap token (`xs|sm|md|lg|xl|2xl|3xl|4xl`) — prefer it over manual margins between children. `Box` is the styled `View`; `Center` centers its children. (v3 also has `Grid`/`GridItem`.)

### 4. Typography: `Text` and `Heading`, not RN `Text`

```tsx
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";

<Heading size="xl">Title</Heading>
<Text size="sm" className="text-typography-500">Subtitle</Text>
```

Color via the theme token scale (`text-typography-900`, `text-primary-600`, `bg-background-50`) — see the nativewind-styling skill. Hard-coded hex/`text-black` breaks dark mode.

### 5. Forms: wrap inputs in `FormControl` for labels, errors, and a11y

```tsx
import { FormControl, FormControlLabel, FormControlLabelText,
         FormControlError, FormControlErrorText } from "@/components/ui/form-control";
import { Input, InputField } from "@/components/ui/input";

<FormControl isInvalid={!!errors.email} isRequired>
  <FormControlLabel><FormControlLabelText>Email</FormControlLabelText></FormControlLabel>
  <Input variant="outline" size="md">
    <InputField value={value} onChangeText={onChange} placeholder="you@example.com"
                keyboardType="email-address" autoCapitalize="none" />
  </Input>
  <FormControlError>
    <FormControlErrorText>{errors.email?.message}</FormControlErrorText>
  </FormControlError>
</FormControl>
```

Note `Input` is a wrapper; the actual text field is `InputField`, which takes the RN `TextInput` props (`value`, `onChangeText`, `keyboardType`, …). The same wrapper/field split applies to `Textarea`/`TextareaInput` and `Select`.

### 6. Dark mode and theming go through GluestackUIProvider + tokens

```tsx
// app/_layout.tsx
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";

<GluestackUIProvider mode="system">
  {/* app */}
</GluestackUIProvider>
```

`mode` is `light | dark | system`. Because components style themselves from token classes (`bg-background-0`, `text-typography-950`), they flip automatically. To recolor the app, edit the token scales in the gluestack config / `tailwind.config`, not individual components.

## Hard "don't"s (these cause real bugs)

- **Don't import from `@gluestack-ui/themed`.** That's v1. Modern components import from `@/components/ui/*`.
- **Don't use `sx={{...}}`, `$token` props, or `bg="$primary500"`.** All styling is `className`.
- **Don't use descendant styling** (e.g. styling `Text` from a parent's `_text`). NativeWind doesn't support it; style the child directly.
- **Don't import a `components/ui/` component that isn't installed.** Add it with the CLI first.
- **Don't replace gluestack primitives with raw `View`/`Text`/`Pressable`** in a gluestack screen — you lose theming and a11y, and the UI drifts.
- **Don't wrap the app in two providers or forget the provider** — unstyled components are almost always a missing/duplicated `GluestackUIProvider` or missing `global.css` import.

## When something renders unstyled

Check, in order: (1) `GluestackUIProvider` wraps the tree, (2) `global.css` (with `@tailwind` directives) is imported at the entry point, (3) `nativewind` is wired in `metro.config.js` and `babel.config.js`, (4) the `className` references a token that exists in the config. This is the #1 gluestack support issue and it's almost never the component itself.

## Migrating from v1 / NativeBase

Use the official codemod (`npx @gluestack-ui/...` upgrade flow) to convert `sx`/token props to `className`. Descendant styles won't auto-convert — flag each one and move the style onto the child element manually. After migration, delete `@gluestack-ui/themed` imports.

## Reference

For the component catalog, subcomponent names, and per-component variant props, read `references/components.md`.
