---
name: react-conventions
description: >-
  Industry-standard React architecture and coding conventions for any React app
  (TypeScript, react-hook-form, TanStack Query / RTK Query). Use this skill
  whenever you write, scaffold, refactor, or review React code — new screens,
  pages, components, forms, data-fetching hooks, or feature folders — even if the
  user doesn't say "convention". Apply it on any request that produces React/TSX
  so pages stay thin, logic lives in hooks, and DTO mapping is isolated. Trigger
  for "add a screen", "build a form", "wire up this API", "refactor this
  component", "review my React code", or any frontend task in a React codebase.
---

# React Conventions

The goal: code that another senior engineer would recognize as conventional and
boring (in the good way). Logic is where you expect it, files do one job, and the
component tree is easy to read top-down. The single organizing principle is
**separation of concerns by layer**, applied feature by feature.

## The layering rule

Every screen is built from four layers. Keep them in separate files and never let
one layer's job leak into another.

| Layer | Owns | Must NOT do |
|-------|------|-------------|
| **Page / route component** | Composition, layout, rendering | Data fetching logic, submit logic, field renaming, validation rules |
| **Feature hook** (`use-*.ts`) | react-hook-form, queries/mutations, navigation, derived UI state | JSX, raw fetch wiring, DTO shape translation |
| **Mappers** (`mappers.ts`) | Form-shape ↔ API-DTO translation | React, side effects, business rules |
| **API client / service** | HTTP calls, endpoints, transport concerns | Knowing about form shapes or component state |

If you find yourself renaming an API field inside a component, or calling
`fetch`/`axios` inside a page, the layering is wrong — move it down a layer.

### Why this matters

Thin pages are readable at a glance and trivial to test. Hooks make logic reusable
and unit-testable without rendering. Isolated mappers mean shape changes (snake_case
API ↔ camelCase form) live in exactly one place, so an API rename touches one file
instead of every component that happened to spread the response.

## Folder structure: feature-first

Organize by feature, not by file type. Co-locate everything a feature needs.

```
src/
├── features/
│   └── auth/
│       ├── login-page.tsx          # thin: renders + calls the hook
│       ├── register-page.tsx
│       ├── use-login-form.ts        # form + mutation + navigation
│       ├── use-register-form.ts
│       ├── use-activation.ts        # one-shot action (see gotcha below)
│       ├── mappers.ts               # form <-> DTO translation
│       ├── api.ts                   # endpoint calls for this feature
│       └── components/              # feature-local presentational pieces
├── components/                      # shared, app-wide UI primitives
├── hooks/                           # shared, cross-feature hooks
├── lib/                             # api client, utils, config
└── types/                           # shared types / generated API DTOs
```

Promote something from `features/<x>/` to the shared folders **only when a second
feature actually needs it**. Premature sharing creates coupling; duplicate first,
abstract on the third use.

## Scaffolding a new feature

When creating a new screen, start from the skeletons in `assets/templates/` rather
than writing the layering from memory — they encode the four-layer split correctly.

```
assets/templates/
├── page.tsx.template               # thin page
├── use-__feature__-form.ts.template # form + mutation + navigation + schema
├── mappers.ts.template             # form <-> DTO translation
└── api.ts.template                 # endpoint calls
```

To use them: copy each into `src/features/<feature>/`, drop the `.template`
extension, and replace the two placeholders consistently:

- `__Feature__` → PascalCase feature/entity name (e.g. `Login`, `Profile`)
- `__feature__` → kebab/camel for files and routes (e.g. `login`, `profile`)

Then fill in the real fields (schema, form values, DTO mapping, endpoints). Delete
any layer a given feature genuinely doesn't need (e.g. a read-only screen has a
query in the hook and no `mappers` write path), but don't collapse layers together.

## Pages stay thin

A page renders and delegates. It should read like a table of contents for the
screen.

**Good:**
```tsx
export function LoginPage() {
  const { form, onSubmit, isPending, error } = useLoginForm();
  return (
    <AuthLayout title="Sign in">
      <LoginForm form={form} onSubmit={onSubmit} isPending={isPending} />
      {error && <FormError error={error} />}
    </AuthLayout>
  );
}
```

**Avoid:** inline `useState` for every field, `fetch` calls in the component body,
`try/catch` submit handlers, or mapping `data.user_name` → `userName` in JSX. All of
that belongs in the hook or the mappers.

## Feature hooks own the logic

A `use-*.ts` hook composes form state, the query/mutation, and navigation, and
returns a small, intentional surface to the page. The hook is the unit you test.

```ts
export function useLoginForm() {
  const navigate = useNavigate();
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: LoginFormValues) => api.login(toLoginRequest(values)),
    onSuccess: () => navigate('/dashboard'),
  });

  const onSubmit = form.handleSubmit((values) => mutation.mutate(values));

  return { form, onSubmit, isPending: mutation.isPending, error: mutation.error };
}
```

Notes:
- Validation schema (zod/yup) lives next to the form values type, not inline.
- The hook returns a curated object — don't spread the whole mutation back to the
  page. Expose only what the UI needs (`isPending`, `error`, `onSubmit`).
- Navigation and side effects belong here, never in the mapper or the API client.

## DTO mapping is isolated

Form shapes (camelCase, validation-friendly) and API DTOs (often snake_case) are
different contracts. Translate between them in `mappers.ts` and nowhere else.

```ts
// form values -> API request
export function toLoginRequest(v: LoginFormValues): LoginRequest {
  return { email: v.email, password: v.password };
}

// API response -> view model the UI consumes
export function fromUserDto(dto: UserDto): User {
  return { id: dto.id, displayName: dto.display_name, email: dto.email };
}
```

This is the only place field renaming happens. Pages and hooks consume already-mapped
shapes and stay ignorant of transport casing.

## Data fetching: queries vs. mutations

Use a server-state library (TanStack Query or RTK Query) — don't hand-roll
`useEffect` + `useState` for server data.

- **Reads** → `useQuery`, keyed by its inputs. Caching, refetch, and loading state
  come for free.
- **User-triggered writes** (submit, delete, toggle) → `useMutation`.

### Gotcha: one-shot actions and StrictMode

A "fire on mount" action (email activation, redeem token, confirm) is **read-shaped
from the UI's view** — given this token, produce a result. Model it as a `useQuery`
keyed by the token, **not** a `useMutation` triggered from `useEffect` with a ran-once
ref. Under React 18 StrictMode the double-mount + ref guard can leave the UI stuck on
"pending", and the query approach is idempotent and survives remounts cleanly.

```ts
// good: idempotent, StrictMode-safe
export function useActivation(token: string) {
  return useQuery({
    queryKey: ['activation', token],
    queryFn: () => api.activate(token),
    enabled: Boolean(token),
    retry: false,
  });
}
```

## Components

- **Presentational by default.** A component takes props and renders. If it needs to
  fetch or mutate, it should instead receive that via props from a hook, or be a
  small "container" that only wires a hook to a presentational child.
- **Composition over configuration.** Prefer `children` and slot-style props over a
  growing list of boolean flags (`isLarge`, `isPrimary`, `hasIcon`…).
- **Name by role, not appearance:** `SubmitButton`, `UserCard`, `EmptyState`.
- **One component per file**, named export matching the filename.
- Keep prop interfaces explicit and typed; avoid `any` and avoid spreading unknown
  props through.

## State, the right tool for the scope

1. **Server state** → TanStack Query / RTK Query. Most "app state" is really cached
   server data; don't duplicate it into a store.
2. **Form state** → react-hook-form (don't put each field in `useState`).
3. **Local UI state** → `useState` / `useReducer` in the nearest owning component.
4. **Cross-cutting client state** (theme, auth session, feature flags) → Context or a
   small store (Zustand/Redux). Reach for a global store last, not first.

Avoid lifting state higher than it needs to go, and avoid Context for high-frequency
updates (it re-renders all consumers).

## TypeScript conventions

- Type the contracts: form values, DTOs, view models, hook return types.
- Prefer discriminated unions over optional-flag soups for variant state
  (`{ status: 'idle' | 'loading' | 'error'; ... }`).
- Derive types where possible (`z.infer<typeof schema>`) so the schema is the source
  of truth.
- No `any`; use `unknown` + narrowing at boundaries (e.g. parsing API responses).

## Effects

- `useEffect` is for synchronizing with external systems, not for deriving state or
  fetching data you could fetch with a query.
- Always justify the dependency array; a disabled lint rule on deps is a code smell.
- Cleanup subscriptions/timeouts in the returned cleanup function.

## Performance (only when measured)

Write clear code first. Reach for `memo`, `useMemo`, `useCallback` when a profiler
shows a real problem, not preemptively — premature memoization adds noise and can
even slow things down. Stable keys in lists (never the array index for dynamic
lists) is the one that's always worth getting right.

## Quick review checklist

When writing or reviewing a screen, verify:

- [ ] Page is presentational — no fetch/submit/mapping logic inline.
- [ ] Form + submit + navigation live in a `use-*.ts` feature hook.
- [ ] Field renaming / casing translation lives only in `mappers.ts`.
- [ ] Server reads use `useQuery`; writes use `useMutation`.
- [ ] One-shot on-mount actions use `useQuery` keyed by input (StrictMode-safe).
- [ ] Files sit under `features/<feature>/`; shared-only-when-reused.
- [ ] Types cover form values, DTOs, and the hook's return surface.
- [ ] No `any`; no `useEffect` doing work a query should do.
