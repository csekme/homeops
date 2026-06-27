 # Plan: Household creation & management (multi-tenant) — BE → Web → Mobile

## Context

HomeOps is a multi-tenant household SaaS. **Phase 0 already shipped the foundation** but no
household *management* surface exists yet:

- Models `Household`, `Membership`, `Role` exist ([backend/app/db/models.py](backend/app/db/models.py)); RLS plumbing is live ([backend/app/db/rls.py](backend/app/db/rls.py)); JWT access tokens already carry `household_id` + `role` claims ([backend/app/security/jwt_tokens.py](backend/app/security/jwt_tokens.py)).
- `_active_membership()` in [auth_service.py](backend/app/services/auth_service.py) is an explicit seam "ready for the multi-household switch" — but every new user gets `household_id=None` and **cannot create or join a household**.
- Shared packages are pre-wired: `householdSchema`/`inviteSchema`/`roleSchema` in [packages/validation/src/index.ts](packages/validation/src/index.ts), `PERMISSIONS`/`can()` in `@homeops/core`, and a `<NavUser>` household-switcher stub + a `/invite/:token` placeholder page on web.

This plan delivers the full household lifecycle: **create → switch → invite (email, register-then-join) → manage members & roles → archive/soft-delete**, across backend, web, and mobile. Outcome: a user can stand up a household, bring in family with role-based access, and operate inside the correct tenant context end-to-end.

**Confirmed decisions:** (1) invites are email-bound single-use expiring tokens supporting register-then-join; (2) role-based permissions only this iteration (derived from `Role.permissions`); (3) phased delivery BE → web → mobile so the OpenAPI contract is frozen before clients build on it.

---

## User stories / journeys

**Household lifecycle**
- *As a registered user with no household*, the dashboard shows an empty state inviting me to **create a household**; on submit I become `OWNER` and am dropped straight into it.
- *As a member of several households*, I use the **household switcher** to change my active context; the whole app re-scopes to that tenant.
- *As an OWNER*, I can **rename** and **archive/soft-delete** a household (with a confirm step); billing & delete are OWNER-only.

**Invitations (register-then-join)**
- *As an OWNER/ADMIN*, I **invite by email + role**; the invitee gets a link with an expiring token. I can see **pending invites**, **resend**, or **revoke** them.
- *As an invited person without an account*, the link routes me to **register → activate → sign in**, then I **accept** and join with the assigned role.
- *As an invited existing user*, I open the link, am already signed in, and **accept** directly.

**Members & roles**
- *As an OWNER/ADMIN*, I see the **member list** with roles and can **change a member's role** or **remove** a member.
- *As any member*, I can **leave** a household.
- **Safety:** the system refuses to remove/demote the **last OWNER**, refuses inviting an already-member or a duplicate pending email, and a `CHILD`/`VIEWER` sees a read-limited UI (driven by `can()`).

---

## Backend (Phase 1 — do first; freezes the contract)

Mirror the existing layering: thin APIFlask controller → service → repository, dataclass views (no ORM leakage), `session_scope` for tenant/bypass modes.

### Data model & migration
- **New `Invitation` model** in [models.py](backend/app/db/models.py), modeled on `ActivationToken` (hash-only, expiring, single-use) + tenant columns: `household_id` (FK, RLS discriminator), `email` (normalized lower), `role_id` (FK), `token_hash` (unique), `expires_at`, `accepted_at?`, `revoked_at?`, `invited_by` (FK users), timestamps.
- **Add `household_id` to `RefreshToken`** (nullable) — fixes the switch-revert bug (see below). Set it on `issue`/`rotate`.
- **New Alembic migration** (down_revision = current head/TOTP migration), mirroring the initial migration's RLS pattern ([migrations/versions/7267cd3d0e03_initial_schema.py](backend/migrations/versions/7267cd3d0e03_initial_schema.py)):
  - `invitations` table; indexes `ix_invitations_household_id`, `uq_invitations_token_hash`, and a **partial unique** on `(household_id, lower(email)) WHERE accepted_at IS NULL AND revoked_at IS NULL` (blocks duplicate pending invites).
  - `ENABLE`/`FORCE ROW LEVEL SECURITY` + policy `invitations_tenant_isolation` using the **same predicate** as households/memberships (`bypass OR household_id = current_setting('app.current_household')`). **Inline comment must flag** that the bypass branch is the acceptance path and the email-binding check in `invitation_service.accept()` is the compensating control.
  - Add the `refresh_tokens.household_id` column here too.

### Repositories (new)
- `repositories/roles.py` — `get_by_name(session, name)` (OWNER lookup by name, **never hardcoded UUID**; `roles` is global/un-scoped).
- `repositories/households.py` — `create`, `get_by_id`, `list_for_user` (cross-household), `rename`, `soft_delete` (all list/join paths filter `deleted_at IS NULL`).
- `repositories/memberships.py` — `get(user_id, household_id)`, `add`, `remove`, `change_role`, `count_owners(household_id)`, `list_for_household`.
- `repositories/invitations.py` — `create`, `get_by_token_hash`, `get_pending(household_id)`, `find_pending_for_email`, `mark_accepted`, `revoke`.

### Services (new)
- `services/authorization.py` — shared `require_permission(session, *, user_id, household_id, permission)` / `require_role(...)`. **Re-reads the membership/role from the DB in-transaction** — never trusts the JWT `role` claim (stale after a role change). Maps to `ROLE_PERMISSIONS` in [enums.py](backend/app/domain/enums.py): invite→`member.invite`, change role/remove→`member.manage`, rename→`member.manage`, archive/delete→`household.delete`.
- `services/household_service.py`:
  - `create(user_id, name, currency)` — **`bypass_tenant=True`**; insert Household + flush + OWNER `Membership` atomically; return household view. Controller then **auto-switches** (re-mints access token) so the brand-new tenant is usable without a second call.
  - `switch(user_id, household_id)` — **`bypass_tenant=True`**; verify membership exists (else **404**, don't leak existence); re-mint **access token only** (no refresh rotation). Refuse switching into a soft-deleted household.
  - `list_for_user(user_id)` — bypass; caller's households + roles, excluding soft-deleted.
  - `rename` / `soft_delete` / `list_members` / `change_role` / `remove_member` / `leave` — **tenant mode** (`session_scope(household_id=claim)`); enforce **last-OWNER guard** on demote/remove/leave (`count_owners`).
- `services/invitation_service.py`:
  - `invite` / `resend` / `revoke` / `list_pending` — tenant mode + `member.invite` check; reject already-member & duplicate pending; build + email the invite link via the existing email sender (new template alongside `build_activation_email`).
  - `accept(user, raw_token)` — **`bypass_tenant=True`**; validate not expired/used/revoked; **enforce authenticated user's email == invite email (case-insensitive)** — this is the security gate replacing RLS here; insert membership; set `accepted_at`; treat `UNIQUE(user_id,household_id)` violation as idempotent "already member". Optionally auto-switch.
- New exceptions in [exceptions.py](backend/app/services/exceptions.py): `PermissionDenied`, `NotAMember`, `HouseholdNotFound`, `LastOwnerError`, `AlreadyMember`, `InvalidInvitation`, `InvitationEmailMismatch`.

### Fix the switch-revert bug (high priority)
`auth_service.refresh()` calls `_active_membership()` → always `memberships[0]`, **silently reverting any household switch on the next refresh**. Fix: read the active household from the (new) `refresh_tokens.household_id` and re-mint into the *same* household; fall back to `memberships[0]`/`(None,None)` only if that membership no longer exists (covers left/removed/deleted household). Switch & create must persist the chosen household onto the refresh record.

### API layer
- New blueprint `api/households.py` + `api/invitations.py` (registered alongside `auth_bp`).
- New marshmallow schemas in [schemas.py](backend/app/api/schemas.py): `HouseholdCreateIn`, `HouseholdOut`, `HouseholdRenameIn`, `MemberOut`, `ChangeRoleIn`, `InviteCreateIn`, `InvitationOut`, `InviteAcceptIn`.
- All tenant-scoped endpoints **enforce `path {id} == claims.household_id`** (else 403/409 "switch required") so the GUC `app.current_household` stays sourced only from the JWT — keeping RLS a true second layer. Switch response is the lighter `{access_token, token_type}` (web cookie & mobile bearer converge — no Set-Cookie on switch); reuse the transport handling from [auth.py](backend/app/api/auth.py).

**Endpoint list**

| Method & path | Session mode | Notes |
|---|---|---|
| `POST /api/households` | bypass | create + OWNER membership; auto-switch |
| `GET /api/households` | bypass | caller's households (exclude soft-deleted) |
| `POST /api/households/{id}/switch` | bypass | verify membership; re-mint access token only |
| `PATCH /api/households/{id}` | tenant + `{id}==claim` | rename; `member.manage` |
| `DELETE /api/households/{id}` | tenant + `{id}==claim` | soft-delete; `household.delete`; OWNER only |
| `GET /api/households/{id}/members` | tenant | list members |
| `PATCH /api/households/{id}/members/{userId}` | tenant | change role; last-owner guard |
| `DELETE /api/households/{id}/members/{userId}` | tenant | remove / self-leave; last-owner guard |
| `POST /api/households/{id}/invitations` | tenant | create invite; `member.invite` |
| `GET /api/households/{id}/invitations` | tenant | list pending |
| `POST /api/households/{id}/invitations/{invId}/resend` | tenant | new token+expiry |
| `DELETE /api/households/{id}/invitations/{invId}` | tenant | revoke |
| `GET /api/invitations/{token}` | bypass | preview (household name, role) — minimal info |
| `POST /api/invitations/accept` | bypass | email-binding check; insert membership; idempotent |

---

## Shared packages (between BE freeze and clients)

- `@homeops/types` — add `Household`, `Invitation`, request/response DTOs (`CreateHouseholdRequest`, `SwitchResponse`, `InviteRequest`, `AcceptInviteRequest`, member/role DTOs). Eventually regenerated from the OpenAPI snapshot; hand-write interim like existing types.
- `@homeops/validation` — `householdSchema`/`inviteSchema`/`roleSchema` already exist; add `renameHouseholdSchema`, `changeRoleSchema`, `acceptInviteSchema` if needed.
- `@homeops/core` — `PERMISSIONS` + `can()` already present; use for UI gating. Confirm permission keys match backend `ROLE_PERMISSIONS`.
- `@homeops/api-client` — add hand-written hooks mirroring [auth.ts](packages/api-client/src/auth.ts): `useHouseholds`, `useCreateHousehold`, `useSwitchHousehold` (on success: `setAccessToken(new)` + invalidate `['auth','me']`), `useHouseholdMembers`, `useChangeRole`, `useRemoveMember`, `useLeaveHousehold`, `useRenameHousehold`, `useArchiveHousehold`, `useInvitations`, `useCreateInvite`, `useResendInvite`, `useRevokeInvite`, `usePreviewInvite`, `useAcceptInvite`. Active-household persistence: store id locally and rely on the token claim as source of truth.
- `@homeops/i18n` — add a `households` namespace (HU/EN) for all new strings; extend `validation` keys as needed.

---

## Web (`apps/web`)

Reuse React Router v7 + `RequireAuth` + `AppShell`/`AppSidebar`/`NavUser`, shadcn components, the `useForm + zodResolver + Field` form pattern, and `features/*` + `mappers.ts` conventions ([use-login-form.ts](apps/web/src/features/auth/use-login-form.ts) is the template). **Use the shadcn-only skill for all UI.**

- **Household switcher** — make the existing [nav-user.tsx](apps/web/src/components/nav-user.tsx) dropdown functional: list memberships, call `useSwitchHousehold`, reflect active household; "Create household" entry.
- **Onboarding empty state** — dashboard shows a create-household CTA when `memberships` is empty.
- **Create-household dialog** — `householdSchema` form (name + currency); on success the switch re-scopes the app.
- **Household settings** — new route(s) under settings (e.g. `/settings/household`) with tabs:
  - *General*: rename, archive/delete (confirm dialog; OWNER-gated via `can()`).
  - *Members*: table with role badges; role `<Select>` (change role), remove, leave; disable destructive actions per `can()` and last-owner rule.
  - *Invitations*: invite form (email + role), pending list with resend/revoke.
- **Accept-invite flow** — replace the [invite.tsx](apps/web/src/pages/invite.tsx) placeholder: preview via `usePreviewInvite`; if authenticated & email matches → accept; else route to register/login carrying the token, then accept post-login.
- New `features/households/*` hooks (form + mutation orchestration) + `mappers.ts` (camelCase form ↔ snake_case DTO).

---

## Mobile (`apps/mobile`)

Reuse expo-router groups, gluestack-ui v4 components, the `TextField` + `Controller` + `zod-i18n` pattern ([use-login-form.ts](apps/mobile/features/auth/use-login-form.ts)), bearer transport + secure store. **Use the gluestack-ui-v4 skill for all UI.** The same `@homeops/api-client` hooks work (bearer mode); switch updates the in-memory access token, no cookie.

- **Routes under `(app)`**: `households/index` (switcher + my households), `households/new` (create), `households/[id]/members`, `households/[id]/invite`. Add a household context indicator + switcher entry point (header or a drawer/tabs shell — Phase 0 is a bare Stack, so introduce a minimal app shell).
- **Onboarding** — dashboard empty state → create household.
- **Create / switch** — `householdSchema` form; `useSwitchHousehold` updates token and invalidates `['auth','me']`.
- **Members & invitations** — gluestack list/`Select`/`Alert` for role change, remove, leave, invite, pending list (resend/revoke), gated by `can()` + last-owner rule.
- **Accept-invite deep link** — `homeops://invitations/[token]` (mirror `activate/[token].tsx`): preview → accept if signed-in & email matches, else register/login then accept.
- i18n via the shared `households` namespace; forms use shared zod schemas + `zod-i18n` map.

---

## Verification

**Backend (primary gate — pytest + Testcontainers Postgres, mirrors `tests/`):**
- Unit: last-owner guard, permission helper, invite email-binding mismatch, already-member idempotency.
- Integration: create→OWNER membership; **RLS proof** that tenant-scoped endpoints can't touch another household; **acceptance under bypass** inserts membership for matching email and rejects mismatched email; **switch then refresh keeps the switched household** (regression test for the `memberships[0]` bug); soft-deleted household refuses switch & hides from list; `{id}==claim` mismatch → 403.
- `alembic check` clean (deterministic naming); upgrade/downgrade the new migration.
- Inspect `/api/openapi.json` (or `/api/docs`) to confirm the new contract before generating client types.

**Web:** run the app; create household → land inside it; switch households re-scopes; invite (check email in Mailpit) → accept in a second account; change role / remove / last-owner refusal; `CHILD`/`VIEWER` see read-limited UI. Use the `verify`/`run` skills.

**Mobile:** Expo run; create/switch/members/invite; deep-link accept; secure-store token persists; switch updates context without a relogin.

---

## Notes / risks
- **Highest risk:** the `refresh()` → `memberships[0]` revert. Must ship with switch (adds `refresh_tokens.household_id`).
- **Acceptance MUST be bypass-mode** with the email-binding check — RLS would otherwise hide the invite and reject the membership insert. Don't let a future reviewer "tighten" the policy.
- **Never trust the JWT `role` claim** for authorization — re-read in-transaction.
- **Soft-delete is invisible to RLS** — every list/join/switch path must filter `deleted_at IS NULL`.
- Fine-grained per-member permission overrides and GDPR hard-purge are explicitly deferred.
