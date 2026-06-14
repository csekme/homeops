---
name: homeops-react-conventions
description: HomeOps web (apps/web) React conventions the user requires
metadata:
  type: feedback
---

For HomeOps `apps/web`, the user requires React industry-standard structure (stated 2026-06-14):

- **Pages must stay thin** — presentational only; no data/DTO/submit logic inline.
- **Form + submit logic lives in custom hooks** (e.g. `features/auth/use-login-form.ts`, `use-register-form.ts`, `use-activation.ts`).
- **DTO mapping lives in its own file** — form shapes (camelCase, `@homeops/validation`) ↔ API DTOs (snake_case, `@homeops/types`) in `features/auth/mappers.ts`. No field-renaming in pages/hooks.
- Feature-based folders under `src/features/<feature>/`.

**Why:** the initial scaffold put form/submit/mapping inline in page components; the user wants logic extracted so pages are thin and conventions are industry-standard.

**How to apply:** new screens → page renders + calls a feature hook; the hook owns react-hook-form + the mutation/query + navigation; a mappers file owns request/response shape translation. See the auth feature for the pattern. Related: [[homeops-phase0-state]].

Two frontend gotchas already fixed (don't reintroduce): the CSRF cookie must be `Path=/` (JS reads it for double-submit; refresh cookie stays `Path=/api/auth`), and one-shot actions like activation use `useQuery` keyed by token (NOT `useMutation`+ref) so React StrictMode's remount doesn't hang the UI on "pending".
