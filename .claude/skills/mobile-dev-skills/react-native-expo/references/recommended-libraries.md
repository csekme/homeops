# Recommended libraries for this stack

The canonical choices for an Expo (New Architecture) + Expo Router + gluestack-ui app. Prefer these over alternatives unless the project already standardized on something else. Always confirm New-Architecture support before adding a native dependency.

## UI & styling
- **gluestack-ui** (v2/v3) — component layer (copy-paste, see the gluestack-ui skill).
- **nativewind** (v4.1) — Tailwind-in-RN styling engine (see the nativewind-styling skill).
- **lucide-react-native** — icon set; pass to gluestack `Icon as={...}`.
- **expo-image** — performant images with caching/blurhash.

## Navigation
- **expo-router** — file-based routing (built on React Navigation). Default choice.
- (Under the hood: **@react-navigation/native** — only touch directly for advanced custom navigators.)

## Data & state
- **@tanstack/react-query** — all server state (fetching/caching/mutations).
- **zustand** — client/UI/session state.
- **@tanstack/react-query-persist-client** + a storage persister — offline cache.

## Forms & validation
- **react-hook-form** — form state (uncontrolled, performant).
- **zod** — schemas + inferred types; `@hookform/resolvers` to bridge.

## Lists & animation
- **@shopify/flash-list** (v2) — virtualized lists. New-Arch native.
- **react-native-reanimated** (v4) — UI-thread animations via worklets.
- **react-native-gesture-handler** — gestures (works with Reanimated).

## Storage
- **expo-secure-store** — secrets (Keychain/Keystore).
- **react-native-mmkv** — fast sync key-value (prefs, cache).
- **@react-native-async-storage/async-storage** — simple async kv when MMKV isn't set up.

## Networking
- **fetch** (built-in) wrapped in `src/lib/api-client.ts`, or **axios** if interceptors are wanted. One client, one place to attach auth headers + base URL.

## Config & build
- **expo-constants** — read public config from `app.config.ts` `extra`.
- **EAS** (`eas build` / `eas update` / `eas submit`) — builds, OTA updates, store submission.
- **expo-router/typed-routes** (experiment) — typed `href`s.

## Dev quality
- **TypeScript** strict mode.
- **eslint-config-expo** + **prettier**.
- **@testing-library/react-native** + **jest-expo** for component/hook tests.
- **maestro** for E2E flows (lighter than Detox for many teams).

## Compatibility note

On SDK 55+ the New Architecture is mandatory. Before adding any native module, check its New-Arch status (the library's README, or a package-compatibility tracker). If a dependency is bridge-only and unmaintained, find a maintained replacement rather than pinning to an older SDK.
