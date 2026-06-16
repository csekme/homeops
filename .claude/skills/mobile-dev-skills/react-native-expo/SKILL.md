---
name: react-native-expo
description: Enterprise-grade conventions for building React Native apps with Expo (managed workflow, New Architecture), Expo Router, and TypeScript. Use this skill WHENEVER working in a React Native / Expo codebase — creating screens or navigation, structuring the project, wiring data fetching or state, handling lists/images/forms, setting up secure storage, env config, or EAS builds — even if the user just says "add a screen", "set up navigation", "fetch data", or "why is this list slow". Also use it when reviewing RN architecture or starting a new mobile app. Pairs with the gluestack-ui and nativewind-styling skills for the UI layer.
---

# React Native + Expo

Conventions for shipping production React Native apps on the modern stack: **Expo SDK 54/55+**, **New Architecture** (Fabric + TurboModules + JSI, the default and mandatory from SDK 55), **Expo Router** (file-based navigation), and **TypeScript strict**. The goal is a codebase that's predictable, testable, and performant — the mobile analog of a well-structured Spring Boot service.

## Step 0 — Read the lay of the land

Before adding code, check: `app.json`/`app.config.ts` (SDK version, `newArchEnabled`, plugins), `package.json` (Expo Router? state lib? data lib?), and the `app/` directory (routing tree). Match existing patterns; don't introduce a second navigation or state solution alongside one that's already there.

## Project structure

Use a feature-oriented layout. Keep `app/` thin — route files compose features, they don't contain business logic.

```
app/                      # Expo Router routes ONLY (thin screens)
  _layout.tsx             # root: providers (GluestackUIProvider, QueryClient, etc.)
  (tabs)/                 # route group → tab navigator
    _layout.tsx
    index.tsx             # a tab screen
  (auth)/                 # route group → auth stack
  [id].tsx                # dynamic route
  +not-found.tsx
src/
  features/<feature>/     # screens' real logic, components, hooks, api per feature
  components/             # shared, cross-feature components
  components/ui/          # gluestack-ui generated components (don't hand-edit lightly)
  lib/                    # clients: api client, query client, storage, env
  hooks/                  # shared hooks
  types/                  # shared TS types
assets/
```

Rationale: routing concerns (URL shape, params) stay in `app/`; everything reusable and testable lives in `src/` and is imported into routes. This keeps screens swappable and logic unit-testable without a navigator.

## Navigation — Expo Router (file-based)

Expo Router maps the filesystem to navigation, like Next.js. Prefer it over hand-wired React Navigation for new apps; under the hood it *is* React Navigation, so you can still drop to native stack/tab options.

- **Groups** `(group)` organize routes without adding a URL segment — use them to attach a layout (tab bar, auth gate) to a set of screens.
- **Layouts** `_layout.tsx` define navigators (`Stack`, `Tabs`, `Drawer`) and are where providers go.
- **Dynamic** `[id].tsx`; read with `useLocalSearchParams()`.
- **Navigate** with `<Link href="/profile/123" />` or `router.push()` from `useRouter()`. Use typed routes (`experiments.typedRoutes`) so `href`s are checked.
- **Auth gating**: redirect in a layout based on auth state (`<Redirect href="/login" />`), rather than conditionally rendering navigators.

```tsx
// app/_layout.tsx — providers live here, once
export default function RootLayout() {
  return (
    <GluestackUIProvider mode="system">
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }} />
      </QueryClientProvider>
    </GluestackUIProvider>
  );
}
```

## Data fetching — TanStack Query (server state)

Treat server data as a cache, not as component state. Use **@tanstack/react-query** for all remote reads/writes: it gives you caching, dedup, retries, background refetch, and loading/error states for free.

```tsx
// src/features/tasks/api.ts
export const tasksKeys = { all: ["tasks"] as const, detail: (id: string) => ["tasks", id] as const };

export function useTasks() {
  return useQuery({ queryKey: tasksKeys.all, queryFn: () => apiClient.get("/tasks") });
}
export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (t: Task) => apiClient.put(`/tasks/${t.id}`, t),
    onSuccess: () => qc.invalidateQueries({ queryKey: tasksKeys.all }),
  });
}
```

Centralize query keys per feature so invalidation is consistent. Don't store fetched data in `useState`/Zustand — that creates a second source of truth that drifts.

## Client state — Zustand (UI/session state only)

For genuinely client-side state (auth session, theme, multi-step form drafts, filters), use **zustand** — minimal and re-render-friendly. Keep stores small and selector-based.

```tsx
export const useAuth = create<AuthState>((set) => ({
  token: null,
  setToken: (token) => set({ token }),
  signOut: () => set({ token: null }),
}));
// consume with a selector to avoid over-rendering:
const token = useAuth((s) => s.token);
```

Rule of thumb: **server data → React Query; local/UI/session → Zustand; ephemeral component state → useState.** Don't reach for Redux unless the app genuinely needs it.

## Lists — FlashList, not ScrollView, for anything that grows

Never `.map()` a large array inside a `ScrollView` — it renders everything and tanks memory/scroll. Use **@shopify/flash-list** (v2, New-Arch native) for virtualized lists; fall back to `FlatList` only if FlashList isn't available.

```tsx
<FlashList
  data={tasks}
  renderItem={({ item }) => <TaskRow task={item} />}
  keyExtractor={(t) => t.id}
/>
```

Keep `renderItem` components memoized and side-effect-free; avoid inline closures that change identity every render.

## Images — expo-image

Use **expo-image** for caching, blurhash placeholders, and better memory behavior than RN `Image`. Set `contentFit` and a `placeholder`/`transition` for perceived speed.

## Forms — react-hook-form + zod

Use **react-hook-form** for state/validation (uncontrolled, minimal re-renders) and **zod** for the schema + types. Render fields through gluestack `FormControl` (see the gluestack-ui skill) using `Controller`.

```tsx
const schema = z.object({ email: z.string().email(), name: z.string().min(1) });
type Form = z.infer<typeof schema>;
const { control, handleSubmit, formState: { errors } } =
  useForm<Form>({ resolver: zodResolver(schema) });
```

## Storage & secrets

- Sensitive data (auth tokens, refresh tokens) → **expo-secure-store** (Keychain/Keystore). Never `AsyncStorage` for secrets.
- Non-sensitive cache/prefs → `@react-native-async-storage/async-storage` or `react-native-mmkv` (fast, sync).
- React Query persistence (offline) → persist the cache to MMKV/AsyncStorage via the official persister, not by hand.

## Configuration & environment

- Use `app.config.ts` (dynamic) over `app.json` when you need env-driven values; expose only public values via `expo-constants` `extra` or `EXPO_PUBLIC_*` env vars.
- **Never** ship real secrets in `EXPO_PUBLIC_*` — those are bundled into the client. Keep true secrets server-side.
- Validate env at startup with zod so a misconfigured build fails loudly, not at runtime.

## New Architecture awareness

The New Architecture is the default and is required on SDK 55+. Practical implications when choosing libraries:

- Prefer libraries that explicitly support the New Architecture. Notably: **react-native-reanimated v4** (worklets/UI-thread animations), **react-native-gesture-handler**, **FlashList v2**. Audit any native dependency for New-Arch support before adding it.
- Animations and gestures run off the JS thread — push animation logic into Reanimated worklets rather than `Animated` + `setState` loops.
- Don't write or assume legacy bridge modules; native modules should use the Expo Modules API / TurboModules.

## Performance checklist

When something is slow, check in order:
1. Long lists in `ScrollView` → switch to FlashList.
2. Unmemoized list rows / inline functions recreating each render → `memo`, stable callbacks.
3. Heavy work on the JS thread blocking interactions → move to Reanimated worklets or defer with `InteractionManager`.
4. Large unoptimized images → expo-image with sized sources + caching.
5. Provider/state churn re-rendering whole trees → narrow Zustand selectors, split contexts.
6. Profile with the New-Arch-aware tools (React DevTools profiler, Expo's performance monitor) before guessing.

## Build & release — EAS

- **Development**: `npx expo start` (dev client for native modules).
- **Builds**: `eas build --profile <preview|production> --platform <ios|android>`; define profiles in `eas.json`.
- **OTA updates**: `eas update` ships JS-only changes without a store submission; native changes require a new build.
- **Submit**: `eas submit`.

## Hard "don't"s

- Don't put business logic, fetching, or large component trees directly in `app/` route files — keep them thin.
- Don't mix two navigation systems, two state libs, or store server data in client state.
- Don't render big lists with `.map()` in a `ScrollView`.
- Don't store secrets in `AsyncStorage` or `EXPO_PUBLIC_*`.
- Don't add native deps without checking New-Architecture compatibility.
- Don't disable the New Architecture to make an old library work on SDK 55+ — find a maintained alternative.

## References

- `references/project-structure.md` — fuller folder layout, naming, and a feature-module template.
- `references/recommended-libraries.md` — the canonical library choices for this stack and what each is for.
