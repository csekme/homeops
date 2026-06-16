# Project structure & feature-module template

A fuller reference for organizing an Expo Router + TypeScript app at scale.

## Full layout

```
.
├── app/                          # ROUTES ONLY — thin, composition-only
│   ├── _layout.tsx               # root layout: all providers, root Stack
│   ├── +not-found.tsx
│   ├── (auth)/                   # auth flow group (no URL segment)
│   │   ├── _layout.tsx           # Stack; redirects authed users away
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── (tabs)/                   # main app, tab navigator
│   │   ├── _layout.tsx           # Tabs; redirects unauthed users to /login
│   │   ├── index.tsx             # Home tab
│   │   ├── tasks/
│   │   │   ├── index.tsx         # list
│   │   │   └── [id].tsx          # detail (dynamic)
│   │   └── settings.tsx
│   └── modal.tsx                 # presented modally
├── src/
│   ├── features/
│   │   └── tasks/
│   │       ├── components/       # TaskRow, TaskForm, ...
│   │       ├── hooks/            # useTasks, useTaskFilters
│   │       ├── api.ts            # query/mutation hooks + query keys
│   │       ├── schema.ts         # zod schemas + inferred types
│   │       └── screens/          # TaskListScreen, TaskDetailScreen (imported by app/)
│   ├── components/               # shared cross-feature components
│   │   └── ui/                   # gluestack-ui generated components
│   ├── lib/
│   │   ├── api-client.ts         # fetch/axios wrapper, base URL, auth header
│   │   ├── query-client.ts       # configured QueryClient
│   │   ├── storage.ts            # secure-store / mmkv wrappers
│   │   └── env.ts                # zod-validated env
│   ├── hooks/                    # shared hooks
│   ├── stores/                   # zustand stores (auth, theme, ...)
│   └── types/                    # shared types
├── assets/
├── app.config.ts
├── eas.json
├── tailwind.config.js
├── global.css
├── metro.config.js
└── tsconfig.json                 # paths: "@/*" → "./src/*" (and ui)
```

## Path aliases

Configure `@/` in `tsconfig.json` and the Babel/Metro resolver so imports are stable:

```jsonc
// tsconfig.json
{ "compilerOptions": { "paths": {
  "@/*": ["./src/*"],
  "@/components/ui/*": ["./src/components/ui/*"]
}}}
```

gluestack's CLI defaults to `@/components/ui/*`; keep that alias intact or the generated imports break.

## The route-screen split

Route files compose; screens implement. This keeps screens testable without a navigator and keeps routing declarative.

```tsx
// app/(tabs)/tasks/index.tsx  — the route
import { TaskListScreen } from "@/features/tasks/screens/TaskListScreen";
export default function Route() { return <TaskListScreen />; }
```

```tsx
// src/features/tasks/screens/TaskListScreen.tsx — the real component
export function TaskListScreen() {
  const { data, isPending, error } = useTasks();
  // ...render with gluestack + FlashList
}
```

## Naming conventions

- Components & screens: `PascalCase` files (`TaskRow.tsx`).
- Hooks: `useXxx.ts`.
- Route files: lowercase, Expo Router conventions (`index.tsx`, `[id].tsx`, `_layout.tsx`, `(group)`).
- Query keys: one factory object per feature in `api.ts`.
- Zod schemas: `schema.ts`, export inferred types (`export type Task = z.infer<typeof taskSchema>`).

## Feature-module checklist

When adding a feature, create under `src/features/<name>/`:
1. `schema.ts` — zod schema + types (single source of truth for shape).
2. `api.ts` — query keys + `useXxx` query/mutation hooks.
3. `components/` — presentational pieces.
4. `screens/` — screen components imported by `app/` routes.
5. `hooks/` — feature-specific logic.

Then add the thin route file(s) under `app/`.
