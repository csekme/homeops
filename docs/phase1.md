# HomeOps — FÁZIS 1 részletes végrehajtási terv (MVP-mag)

> Forrás: `docs/PLAN.md` §4 + `docs/specification.md` (§3.1–3.8, §6 ERD, §7). Ez a dokumentum a PLAN §4 (4.1–4.13) munkatételeit bontja **nagy granularitású, sorrendezett, fájl-szintű** lépésekre, **a web/mobil közös kódbázist a középpontba állítva**.

---

## 0. Kiindulási állapot (mit szállított a Fázis 0)

A Fázis 0 (lásd `docs/phase0.md`, lezárva 2026-06-14) **kész**, és a következő újrahasználható alapokat adja:

**Backend (`backend/app`):**
- `create_app()` factory, `config.py` (Dev/Test/Prod), `extensions.py` (db, migrate, limiter, scheduler-singleton).
- Réteges minta él: **vékony APIBlueprint controller** (`api/auth.py`, `api/totp.py`, `api/health.py`) → **service** (`services/auth_service.py`, `services/totp_service.py`) → **repository** (`repositories/users.py`). Domain-hibák: `services/exceptions.py`.
- DB-mag: `db/base.py` (`UUIDPrimaryKeyMixin`, `TimestampMixin`, `TenantMixin`), `db/models.py` (`User`, `Household`, `Role`, `Membership`, `RefreshToken`, `ActivationToken`, `UserTotp`, `RecoveryCode`), `db/session.py`, **`db/rls.py` (a tenant session-wiring kész — `SET LOCAL app.current_household`)**.
- `domain/enums.py`: `Role`, `UserStatus` + **`ROLE_PERMISSIONS` katalógus már seedelve** (OWNER/ADMIN/MEMBER/VIEWER/CHILD finomszemcsés stringekkel).
- `security/`: `rbac.py` (**csak `has_permission` seam — a `require_permission` motor a 4.2**), `refresh_tokens.py`, `passwords.py`, `jwt_tokens.py` (`AccessClaims`), `csrf.py`, `secrets/cipher.py` (`SecretCipher` envelope, AES-256-GCM — már használja a TOTP).
- `notifications/email/`: `EmailSender` SMTP-port + `messages.py` (Jinja sablonok). **Még nincs outbox/worker — az a 4.7.**
- `tasks/scheduler.py`: APScheduler-singleton **váz** (külön process; még nincs job — a 4.7 tölti fel).

**Megosztott csomagok (`packages/*`, platform-független TS):**
- `core`: **`money.ts`, `recurrence.ts` (RRULE next-occurrence), `status.ts` (státusz-derivált), `permissions.ts` (`can`, `isFinancialVisible`) — KÉSZ és tesztelt.** A Fázis 1 ezekre épít, alig bővíti.
- `validation`: jelenleg **csak az auth Zod-sémák** (`index.ts`) — a Fázis 1 ezt **namespace-fájlokra bontja** és bővíti (household/obligation/expense/…).
- `api-client`: `token-store` (memória + secure-store-kész seam), `http`, `orval-mutator` (bearer + `/api` base + `credentials: include`), kézi `auth`/`totp` hookok. **Az orval-generált rész a 4.x endpointokra vár.**
- `types`: generált DTO-k (a backend `openapi.json`-ból).
- `i18n`: HU(default)/EN namespace-ek (`common/auth/dashboard/obligations/expenses/services/settings/validation`) — a kulcsok **léteznek**, a Fázis 1 feltölti a tartalmukat.
- `tokens`: dizájn-tokenek + `theme.css` (`b27JkRsW`).

**Web (`apps/web`):** app-shell (`Sidebar`, nav-user, household-switcher seam, language/theme toggle), `RequireAuth`, auth-oldalak, `lib/auth.tsx`, `lib/query.ts`, `lib/i18n.ts`. **A feature-minta rögzült:** `features/<terület>/use-*.ts` hook + `mappers.ts` (DTO↔form) + `error-messages.ts`; a `pages/*` vékony.

---

## 1. Vezérelv: web/mobil közös kódbázis (a Fázis 1 legfontosabb kerete)

A Fázis 3 (`apps/mobile`, Expo/RN) **nem ír újra üzleti logikát**. Ezért a Fázis 1 minden frontend-munkájánál **kötelező a réteg-besorolás**, és minden tétel megnevezi, mi hová kerül:

| Réteg | Hol | Platform | Mi kerül ide |
|---|---|---|---|
| **Domain-logika** | `packages/core` | közös (tiszta TS) | Money-aritmetika, RRULE, státusz-derivált, jogosultság-helper |
| **Validáció** | `packages/validation` | közös | Zod sémák (form + DTO határ); enumokat `core`-ból importál |
| **Szerződés / típus** | `packages/types` | közös | OpenAPI-ból generált DTO-k/enumok |
| **Adatelérés** | `packages/api-client` | közös | orval-generált TanStack Query hookok + mutator (web: cookie+bearer; **mobil: bearer secure-store-ból — a mutator-seam már kész**) |
| **Fordítások** | `packages/i18n` | közös | HU/EN kulcsok + típusos `t` |
| **Dizájn-token** | `packages/tokens` | közös forrás | web Tailwind + mobil NativeWind ugyanabból |
| **Prezentáció** | `apps/web` (§5.1) + `apps/mobile` (§5.2) | **platform-specifikus** | web: shadcn/Radix DOM; mobil: gluestack-ui v4 + NativeWind RN; oldalak, RHF-kötés |

**Két szigorú szabály (ESLint `no-restricted-imports` tartatja be):**
1. A `packages/*` **soha** nem importál DOM-ot, React Native-et, shadcn-t vagy `apps/*`-ot.
2. Üzleti döntés (pénznem-összesítés, RRULE-előnézet, „pénzügy látható-e", státusz-átmenet) **soha** nem `apps/web`-ben születik — `core`/`validation`-ben, hogy a mobil egy az egyben örökölje.

**Gyakorlati következmény minden web-tételre:** a hook (`use-*.ts`) csak *összeköti* a közös `api-client` hookot + `validation` sémát + `core` helpert a shadcn UI-val. Amikor a Fázis 3 jön, a mobil ugyanazt a hookot (ha platform-független, pl. adat-derivált) vagy ugyanazt az `api-client`/`validation`/`core` hármast használja, csak más prezentációval.

---

## 2. Párhuzamos sávok és kemény sorrend-kötések

**Sávok (a PLAN §12 kritikus útját követve):**
- **A sáv — Backend domain+adat:** 4.1 → 4.2 → {4.3, 4.4, 4.5} → 4.6 → 4.7 → 4.8.
- **B sáv — Megosztott csomagok:** B1 (`validation` szétbontás+bővítés) ∥ B2 (`core` apró bővítés) ∥ B3 (`i18n` feltöltés) → **B4 (orval codegen: a backend endpointokra vár, addig interim stub)**.
- **C sáv — Web prezentáció:** 4.9 → 4.10 → 4.11 → 4.12 → 4.13 (mind a B4 generált hookjaira épül; addig a stub-szerződésre).

**Kemény sorrend-kötések (PLAN §12):**
1. **Domain VO-k (4.1) a service-ek (4.4/4.5) előtt.**
2. **RBAC-motor (4.2) minden tenant-művelet előtt** — a `require_permission` minden új service-en áthalad.
3. **RLS (Fázis 0 / 3.6) már él** — minden új tartalom-tábla `household_id` + RLS-policy a migrációban, **nem utólag**.
4. **A scheduler külön processben** (4.7) — sosem a web-workerben (dupla-ütemezés).
5. **Codegen (B4) a backend OpenAPI-ra vár** — a web a stub-szerződéssel kezd, csere amint a 4.3–4.6 endpointok élnek.
6. Outbox (4.7) a meglévő `EmailSender`-re (Fázis 0) épül; az audit (4.8) a 4.2+4.3-ra.

---

## 3. BACKEND

### 4.1 — Domain-réteg: value object-ek és enumok

**Cél:** a service-ek alatti tiszta-Python domain-mag; a `packages/core` Python-párja (drift-mentes enumok).

**Lépések / fájlok:**
- `backend/app/domain/money.py` — **`Money` value object**: `amount_minor: int` + `currency: str (ISO-4217)`. Konstruktor elutasít floatot és nem-`^[A-Z]{3}$` pénznemet; `add`/`subtract` **csak azonos pénznemen** (különben `CurrencyMismatch`); `from_major`/`to_major` (kerekítés `Decimal`-lal, soha float); `__eq__`/`__hash__`. Tükrözi a `packages/core/src/money.ts` szemantikáját.
- `backend/app/domain/enums.py` — **bővítés** a meglévő `Role`/`UserStatus` mellé:
  - `ObligationStatus(StrEnum)`: `UPCOMING`, `DUE`, `DONE`, `OVERDUE`, `SKIPPED`.
  - `BillingCycle(StrEnum)`: `MONTHLY`, `QUARTERLY`, `YEARLY` (a 4.x szolgáltatás-újrahasználatra előre).
  - `NotificationType(StrEnum)`: `OBLIGATION_DUE`, `PAYMENT_DUE`, `OVERDUE`, `INVITATION`, `WEEKLY_DIGEST`.
  - `NotificationChannel(StrEnum)`: `EMAIL` (push a Fázis 3-ban additív).
  - `NotificationStatus(StrEnum)`: `PENDING`, `SENT`, `FAILED`, `DEAD`.
  - `ConnectorProvider(StrEnum)`: `GDRIVE` (a Fázis 2 bővíti — itt csak az enum létezik).
- `backend/app/domain/recurrence.py` — **`next_occurrence(rrule: str, after: date) -> date | None`** `python-dateutil rrulestr`-rel; tükrözi a `packages/core/src/recurrence.ts`-t (ugyanaz a BYMONTHDAY/DST viselkedés). `derive_status(due_date, status, today) -> ObligationStatus` (státusz-derivált, `packages/core/src/status.ts` párja).

**Elfogadás (PLAN §4.1):** unit (`tests/unit/domain/`): Money elutasít floatot + cross-currency összeadást, minor↔major oda-vissza; `next_occurrence` `FREQ=YEARLY` és `FREQ=MONTHLY;BYMONTHDAY=15`; státusz-átmenetek táblázata.

**Tesztek:** `tests/unit/domain/test_money.py`, `test_recurrence.py`, `test_status.py`. Coverage-gate a `domain`-en.

**Web/mobil kapcsolat:** ezek a `packages/core` **backend-tükrei** — közös fixture-készlet (azonos RRULE/Money esetek) biztosítja, hogy a TS és Python ugyanazt számolja. **Drift-teszt:** közös JSON fixture (`tests/fixtures/recurrence_cases.json`) mind a Vitest, mind a pytest beolvassa.

**Függőség:** nincs (Fázis 1 első backend-lépés).

---

### 4.2 — RBAC-motor

**Cél:** a Fázis 0 `has_permission` seam-jét **kötelező, service-szintű kapuvá** emelni; minden tenant-művelet áthalad rajta.

**Lépések / fájlok:**
- `backend/app/security/rbac.py` — **bővítés**: `require_permission(membership: Membership, permission: str) -> None` → ha a membership role-jának permission-listája nem tartalmazza, `PermissionDenied` (új `services/exceptions.py`). A permission-listát a `Role.permissions` JSONB-ből olvassa (a `ROLE_PERMISSIONS` seedből származik). `resolve_permissions(membership) -> list[str]` helper.
- `backend/app/services/exceptions.py` — **bővítés**: `PermissionDenied` (→ 403 a controllerben).
- `backend/app/api/security.py` — **bővítés**: `current_membership()` resolver, ami az access-token `household_id`+`role` claimjéből (Fázis 0 `AccessClaims`) felépíti a kontextust **a kliens-body megkerülésével** (a tenant sosem a bodyból jön — egyezik az RLS-elvvel).
- **Migráció:** a `Role` sorok **seedelése** a `ROLE_PERMISSIONS` katalógusból (Alembic data-migration vagy idempotens `ensure_roles()` a bootstrapban). CHILD/VIEWER **nem kap** `expense.read`-et (ezt teszt rögzíti).

**Elfogadás (PLAN §4.2):** security-tesztek (`tests/security/test_rbac.py`): VIEWER write → 403; CHILD nem olvas kiadást; OWNER törölhet háztartást, ADMIN nem; minden új service-művelet legalább egy `require_permission` hívással kezd.

**Web/mobil kapcsolat:** a `packages/core/permissions.ts` (`can`, `isFinancialVisible`) **a UI-elrejtés tükre** — nem biztonsági határ. A backend a kemény kapu; a közös TS-helper csak a használhatatlan UI elrejtésére. A permission-stringek **egyetlen forrásból**: a backend `ROLE_PERMISSIONS` és a `PERMISSIONS` konstans (`core`) paritását egy teszt ellenőrzi.

**Függőség:** 4.1 után; minden 4.3–4.8 service-t blokkol.

---

### 4.3 — Háztartások, tagságok, meghívók

**Cél:** több-felhasználós, több-háztartású tenant-kezelés; háztartás-váltás új access-tokennel; e-mailes meghívó-flow.

**Lépések / fájlok:**
- **Migráció** (`backend/migrations/versions/*`): `invitations` tábla — `household_id` (FK, RLS-szkópolt), `email`, `role_id`, `token_hash` (csak hash, mint az activation), `expires_at`, `accepted_at`, `created_by_membership_id`. **RLS-policy + `household_id` index** a migrációban. A `households` már van (Fázis 0); `deleted_at` soft-delete már létezik.
- `backend/app/db/models.py` — **bővítés**: `Invitation` model (a fenti minta szerint).
- `backend/app/repositories/households.py` — `HouseholdRepository`: `create`, `get`, `list_for_user`, `soft_delete`. **Explicit `household_id`-szűrés** (mélységi védelem az RLS mellett).
- `backend/app/repositories/memberships.py` — `MembershipRepository`: `add`, `list_by_household`, `get_for_user_household`, `update_role`, `remove`.
- `backend/app/repositories/invitations.py` — `create`, `get_by_token_hash`, `mark_accepted`.
- `backend/app/services/household_service.py`:
  - `create_household(user, name, default_currency)` → létrehozó **OWNER** lesz (membership + RLS no-tenant boot, mint az auth).
  - `switch_household(user, household_id)` → ellenőrzi a tagságot, **új access-tokent ad** a `household_id`+role claimmel (Fázis 0 `jwt_tokens`).
  - `invite(membership, email, role)` → `require_permission(..., "member.invite")`; egyszer használatos lejáró token; e-mail a meglévő `EmailSender`-rel (Jinja `invitation` sablon, i18n).
  - `accept_invitation(user, token)` → token-validáció, membership létrehozás a kívánt role-lal, token `accepted_at`.
  - `update_member_role` / `remove_member` → `require_permission(..., "member.manage")`.
  - `delete_household` → `require_permission(..., "household.delete")` (csak OWNER), soft-delete + archív.
- `backend/app/api/households.py` — **új APIBlueprint** (vékony controller, Pydantic sémák `api/schemas.py`-ben):
  - `POST /api/households`, `GET /api/households` (a usert tartalmazó háztartások), `POST /api/households/switch`, `DELETE /api/households/{id}`.
  - `GET /api/households/{id}/members`, `PATCH /api/households/{id}/members/{mid}`, `DELETE /api/households/{id}/members/{mid}`.
  - `POST /api/invitations` (létrehoz+email), `POST /api/invitations/accept`.
- `api/schemas.py` — `HouseholdIn/Out`, `MemberOut`, `InviteIn`, `AcceptInviteIn`, `SwitchHouseholdIn/Out` (az access-token a body-ban, mint a login).

**Elfogadás (PLAN §4.3):** integráció — owner meghív → meghívó a Mailpitben → elfogadás → membership a kívánt role-lal; user két háztartásban vált (új token, új RLS-scope); cross-tenant izoláció tart (A tagja nem éri B-t → 404/403). Az audit (4.8) role-/tag-változást rögzít.

**Tesztek:** `tests/integration/test_households.py`, `test_invitations.py`; `tests/security/test_cross_tenant.py` (RLS negatív teszt — `WHERE` nélkül is 0 sor B-ből).

**Web/mobil kapcsolat:** household-váltás kontextus **közös** lesz — az access-token kezelés a `packages/api-client/token-store`-ban van (web+mobil). A switch-hook (`useSwitchHousehold`) generált, közös. A háztartás-lista/tag-lista DTO-k a `packages/types`-ban.

**Függőség:** 4.2 (RBAC), Fázis 0 mailer (3.7) + RLS (3.6).

---

### 4.4 — Teendők, ismétlődő RRULE

**Cél:** egyszeri + ismétlődő (RRULE) teendők felelőssel, státusz-deriválttal, complete/skip flow-val.

**Lépések / fájlok:**
- **Migráció:** `obligations` tábla a §6 ERD szerint — `household_id` (FK, RLS), `title`, `description`, `category`, `due_date (date)`, `rrule (str, null)`, `status`, `assignee_membership_id (FK, null)`, `estimated_amount_minor (BigInteger, null)`, `actual_amount_minor (BigInteger, null)`, `currency (CHAR(3), null, CHECK ~ '^[A-Z]{3}$')`, `lead_time_days (int, default 0)`, `completed_at`, `deleted_at`. **Összetett index `(household_id, due_date, status)`** (a dashboard+scheduler ezt fésüli — §6/PLAN §11). RLS-policy.
- `backend/app/db/models.py` — `Obligation` model; `status` CHECK az `ObligationStatus`-ra.
- `backend/app/repositories/obligations.py` — `ObligationRepository`: `create`, `get`, `list` (szűrők: status, assignee, due-window), `update`, `soft_delete`. Explicit `household_id`.
- `backend/app/services/obligation_service.py`:
  - `create` / `update` / `delete` → `require_permission(..., "obligation.write")`; RRULE-validáció a `domain/recurrence.py`-vel.
  - `list` → `require_permission(..., "obligation.read")`; **CHILD-szűkítés: CHILD csak a rá kiosztott (`assignee_membership_id`) teendőket látja** (service-szintű szűrő, nem csak UI).
  - `complete(obligation_id, membership)` → ha `rrule` van, **a következő előfordulás generálása** (`next_occurrence`) új sorként; az aktuális `DONE` + `completed_at`.
  - `skip(...)` → `SKIPPED` + (ismétlődőnél) következő generálás.
  - A listázás státusza **derivált** (`derive_status` — UPCOMING/DUE/OVERDUE a `due_date`+ma alapján), nem statikusan tárolt (kivéve DONE/SKIPPED).
- `backend/app/api/obligations.py` — `GET/POST /api/obligations`, `GET/PATCH/DELETE /api/obligations/{id}`, `POST /api/obligations/{id}/complete`, `POST /api/obligations/{id}/skip`.
- `api/schemas.py` — `ObligationIn/Out`, `ObligationListQuery` (szűrők).

**Elfogadás (PLAN §4.4):** unit RRULE `FREQ=YEARLY` és `FREQ=MONTHLY;BYMONTHDAY=15`; ismétlődő befejezése a következőt szüli; CHILD csak a rá kiosztottat látja (security-teszt).

**Tesztek:** `tests/unit/domain/test_recurrence.py` (közös fixture), `tests/integration/test_obligations.py`, `tests/security/test_obligation_child_scope.py`.

**Web/mobil kapcsolat:** **RRULE-előnézet és státusz-badge a `packages/core`-ban** (`recurrence.ts` next-occurrence, `status.ts` derive) — a web és a mobil ugyanazt az előnézetet rendereli, eltérő UI-val. Az `obligation` Zod-séma a `packages/validation`-ben (B1).

**Függőség:** 4.1 (Money/recurrence), 4.2 (RBAC).

---

### 4.5 — Kiadások + havi áttekintő

**Cél:** kiadás-rögzítés egész minorban + soronkénti ISO-4217 pénznemmel; havi aggregáció `GROUP BY currency, category`, FX nélkül (döntés 10.1).

**Lépések / fájlok:**
- **Migráció:** `expenses` tábla a §6 szerint — `household_id` (FK, RLS), `amount_minor (BigInteger)`, `currency (CHAR(3), CHECK)`, `occurred_on (date)`, `category`, `service_id (FK, null)`, `note`, `is_recurring (bool, default false)`, `deleted_at`. **Index `(household_id, occurred_on)`** (PLAN §11). RLS-policy.
- `backend/app/db/models.py` — `Expense` model.
- `backend/app/repositories/expenses.py` — `ExpenseRepository`: `create`, `get`, `list` (hó/kategória szűrő), `monthly_summary` (SQL aggregáció **`GROUP BY currency, category`** + hó/hó delta), `update`, `soft_delete`.
- `backend/app/services/expense_service.py`:
  - CRUD → `require_permission(..., "expense.write")` / `"expense.read"`.
  - `monthly_overview(household, year, month)` → kategória-bontás, fix vs változó (`is_recurring`), hó/hó trend, **per-pénznem külön összeg** (`Money` csoportonként, **soha cross-currency összeadás**).
- `backend/app/api/expenses.py` — `GET/POST /api/expenses`, `GET/PATCH/DELETE /api/expenses/{id}`, `GET /api/expenses/overview?year&month`.
- `api/schemas.py` — `ExpenseIn/Out`, `MonthlyOverviewOut` (per-currency, per-category tömbök + delta).

**Elfogadás (PLAN §4.5):** integráció — két hónap/kategória → helyes per-kategória/per-pénznem összeg + trend; sosem float; `EXPLAIN` az `(household_id, occurred_on)` indexet használja.

**Tesztek:** `tests/integration/test_expenses.py`, `tests/integration/test_monthly_overview.py` (több pénznem, hó/hó delta), `tests/integration/test_expense_query_plan.py` (EXPLAIN index-használat).

**Web/mobil kapcsolat:** a Money-formázás és per-currency csoportosítás a `packages/core/money.ts`-ben — a web `Chart` és a (Fázis 3) mobil-kártya ugyanazt a formázott összeget kapja. A `MonthlyOverviewOut` DTO a `types`-ban.

**Függőség:** 4.1 (Money), 4.2 (RBAC).

---

### 4.6 — Dashboard endpoint (szerepkör-érzékeny)

**Cél:** egy aggregáló endpoint, ami a 4.4/4.5 összetett indexeire épít; CHILD/VIEWER **szerver oldalon** kihagyja a pénzügyi blokkokat.

**Lépések / fájlok:**
- `backend/app/services/dashboard_service.py` — `build_dashboard(membership)`:
  - közelgő teendők (7–30 nap, felelőssel, derivált státusz);
  - lejárati idővonal;
  - havi költés + kategória + előző hó delta (a `expense_service.monthly_overview` újrahasználata);
  - esedékes befizetések (overdue jelölve);
  - aktív riasztások.
  - **RBAC-szűrés a service-ben:** ha `not isFinancialVisible(role)` (a backend párja — `resolve_permissions`/`expense.read` hiánya), a havi-költés és esedékes-befizetés blokk **kimarad a válaszból** (nem csak elrejtve a UI-n).
- `backend/app/api/dashboard.py` — `GET /api/dashboard`.
- `api/schemas.py` — `DashboardOut` (opcionális pénzügyi mezők).

**Elfogadás (PLAN §4.6):** OWNER → minden widget; CHILD → pénzügyi blokkok hiányoznak a JSON-ból (integráció + komponens-teszt); `EXPLAIN` az összetett indexet használja; cél <300 ms.

**Tesztek:** `tests/integration/test_dashboard.py` (role-mátrix), `tests/integration/test_dashboard_perf.py` (EXPLAIN).

**Web/mobil kapcsolat:** a widget-láthatóság **kétrétegű és közös**: a szerver elhagyja a tiltott blokkot, a kliens (`isFinancialVisible` a `core`-ból) pedig a widget-térképet kapuzza — a web és a mobil **ugyanazzal a helperrel** dönt.

**Függőség:** 4.4, 4.5.

---

### 4.7 — Értesítések: outbox + scheduler + idempotens worker

**Cél:** megbízható, idempotens e-mail-emlékeztető a Fázis 0 `EmailSender`-én; **külön processben futó** scheduler + worker.

**Lépések / fájlok:**
- **Migráció:** `notifications` = **outbox** — `household_id` (RLS), `type`, `channel`, `status`, `scheduled_for`, **`dedup_key (UNIQUE)`**, `payload jsonb`, `attempts (int)`, `next_attempt_at`, `last_error`, `created_at`. Plusz `notification_preferences` — `user_id`, `household_id`, `type`, `channel`, `enabled (bool)`, `lead_times (int[])`. RLS-policy + indexek (`status, next_attempt_at`).
- `backend/app/db/models.py` — `Notification`, `NotificationPreference`.
- `backend/app/repositories/notifications.py` — `enqueue` (`INSERT ... ON CONFLICT (dedup_key) DO NOTHING` → idempotens), `claim_batch` (`SELECT ... FOR UPDATE SKIP LOCKED`), `mark_sent`/`mark_failed`/`mark_dead`.
- `backend/app/services/notification_service.py` — preferenciák olvasás/írás; outbox-enqueue helper a többi service-nek.
- `backend/app/tasks/scheduler.py` — **bővítés** (a Fázis 0 váz feltöltése): napi pásztázás a közelgő esedékességekre (`obligations` + lead-time, később `services` felmondási ablak) → idempotens outbox-insert (`dedup_key = f"{type}:{target_id}:{occurrence_date}"`).
- `backend/app/tasks/notification_worker.py` — **új**: `claim_batch` → küldés a `EmailSender`-rel → `SENT`/`FAILED` + **exponenciális backoff** (`next_attempt_at`), kimerített retry → `DEAD` (riaszt/metrika). A `Scheduler` port mögött (Celery-csere később, döntés 10.6).
- **Esemény-típusok:** közelgő lejárat, esedékes fizetés, overdue, meghívó, heti digest.
- **Process-szeparáció:** a scheduler+worker külön belépési ponton indul (`backend/app/tasks/__main__.py` vagy `flask <cmd>`), **nem a web-workerben** (PLAN §12.5).

**Elfogadás (PLAN §4.7):** a scheduler kétszeri futása ugyanarra az ablakra **0 duplikált** outbox-sor; a worker kétszeri futása **1** e-mail a Mailpitben; bukó küldés retry-zik, nem vész el; a scheduler külön processben fut.

**Tesztek:** `tests/integration/test_outbox_idempotency.py` (dedup_key), `test_worker_skip_locked.py` (két worker, nincs dupla küldés), `test_worker_retry.py` (backoff→DEAD).

**Web/mobil kapcsolat:** a `channel` enum már tartalmazza az `EMAIL`-t; a **push (Fázis 3) ugyanennek az outboxnak az új csatornája** — a worker-interfész változatlan marad. A preferencia-DTO (`types`) közös; a 4.13 preferencia-UI web, a mobil-variáns Fázis 3.

**Függőség:** 4.4 (obligations a pásztázáshoz), Fázis 0 `EmailSender`.

---

### 4.8 — Audit log alap

**Cél:** append-only audit minden érzékeny műveletre; az app-szerep nem szerkeszt/töröl.

**Lépések / fájlok:**
- **Migráció:** `audit_log` — `household_id` (RLS), `actor_user_id`, `action`, `target_type`, `target_id`, `metadata jsonb`, `ip`, `ua`, `created_at`. **Az app Postgres-szerep `UPDATE`/`DELETE` jogának megvonása** (`REVOKE` + opcionális `BEFORE UPDATE/DELETE` trigger ami `RAISE`-el). RLS-szkópolt.
- `backend/app/db/models.py` — `AuditLog` (csak `created_at`, nincs `updated_at`).
- `backend/app/services/audit_service.py` — `audit(membership, action, target_type, target_id, metadata)` központi helper; a household/membership/role-változás, törlés, connector-művelet hívja a service-rétegből.
- Beépítés a 4.3 (role/tag-változás, household-törlés) és később a 4.x service-ekbe.

**Elfogadás (PLAN §4.8):** role-váltás → 1 immutábilis audit-sor; az app nem szerkeszt/töröl audit-sort (negatív integrációs teszt: `UPDATE audit_log` → hiba).

**Tesztek:** `tests/integration/test_audit_log.py`, `tests/security/test_audit_immutable.py`.

**Web/mobil kapcsolat:** nincs közvetlen UI a Fázis 1-ben (megjelenítés későbbi fázis). Tisztán backend.

**Függőség:** 4.2 (RBAC), 4.3 (a hívási helyek).

---

## 4. MEGOSZTOTT CSOMAGOK (`packages/*`)

> Ez a Fázis 1 web/mobil-közös magja. Minden itt szállított dolgot a Fázis 3 mobil **változtatás nélkül** újrahasznál.

### B1 — `packages/validation` szétbontás + bővítés

**Cél:** a jelenlegi egyfájlos auth-séma szétbontása namespace-fájlokra és bővítés a Fázis 1 entitásokkal.

**Lépések / fájlok:**
- `packages/validation/src/auth.ts` (a meglévő áthelyezése), `household.ts`, `invitation.ts`, `obligation.ts`, `expense.ts`, `notification.ts`; `index.ts` re-export.
- **Enumokat a `@homeops/core`-ból importál** (drift ellen): `Role`, `ObligationStatus`, `BillingCycle`.
- Sémák: `householdSchema` (name, default_currency), `inviteSchema` (email + role enum), `obligationSchema` (title, category, due_date, rrule opcionális + RRULE-szintaxis-validáció, assignee, estimated `Money` egész minor + currency, lead_time_days), `expenseSchema` (amount_minor egész + currency + occurred_on + category + service_id?), `notificationPreferenceSchema`.
- **Money-mező szabály:** minden összeg `z.number().int()` minor + ISO-4217 string — **soha float** (a `core/money.ts`-szel összhangban).

**Elfogadás:** unit (Vitest) minden sémára (valid/invalid fixture); `no-restricted-imports` tiltja a DOM/RN-t; az enum-paritás teszt (`core` ↔ `validation`) zöld.

**Web/mobil kapcsolat:** **a séma a forma-validáció egyetlen forrása** — a web RHF `zodResolver`-e és a mobil RHF-je ugyanazt importálja.

### B2 — `packages/core` apró bővítés

**Cél:** a Fázis 1-hez hiányzó tiszta-TS helperek (a meglévő money/recurrence/status/permissions mellé).
- `permissions.ts` — a `PERMISSIONS` konstans kiegészítése a teljes Fázis 1 készletre (`member.manage`); paritás-teszt a backend `ROLE_PERMISSIONS`-szal.
- `status.ts` — biztosítani a `UPCOMING/DUE/OVERDUE/DONE/SKIPPED` teljes átmenet-térképet (ha még nincs).
- `money.ts` — `groupByCurrency`/`formatMoney` ha a havi-áttekintő UI igényli (különben változatlan).

**Elfogadás:** a meglévő magas unit-lefedettség megmarad; új helperek tesztelve.

### B3 — `packages/i18n` feltöltés

**Cél:** a Fázis 0-ban létrehozott üres/váz namespace-kulcsok feltöltése a Fázis 1 szövegeivel (HU default + EN).
- `obligations`, `expenses`, `dashboard`, `services` (előkészítés), `common` (akciók, státuszok, üres állapotok), `validation` (Zod hibaüzenet-kulcsok).
- **HU/EN kulcs-paritás** a meglévő `parity.test.ts` szerint kötelező (CI `i18n-check`).

**Web/mobil kapcsolat:** a fordítások **közösek**; a mobil ugyanazt az i18next bundle-t tölti.

### B4 — OpenAPI codegen: orval → `types` + `api-client`

**Cél:** a kézi interim stubok cseréje generált, típusos TanStack Query hookokra, amint a 4.3–4.6 endpointok élnek.

**Lépések:**
- A backend `GET /api/openapi.json` mostantól tartalmazza a household/invitation/obligation/expense/dashboard/notification sémákat.
- `pnpm codegen:fetch` → frissíti az `openapi.snapshot.json`-t a futó backendből; `pnpm codegen` → `orval.config.ts` szerint generál: hookok `packages/api-client/src/generated`, DTO-k `packages/types/src/generated`.
- A `packages/api-client` re-exportálja a generált hookokat (`useGetObligations`, `useCreateExpense`, `useGetDashboard`, `useSwitchHousehold`, `useInvite`, …); a kézi interim stubok **eltávolítva**.
- **A mutator változatlan** (Fázis 0): web cookie+bearer; a mobil-variáns ugyanazt a `token-store`-t használja secure-store-ból (Fázis 3).
- CI: `codegen` regenerál + `git diff --exit-code` (drift-gate) + Spectral lint.

**Elfogadás (PLAN §3.11/§4):** futó backend → `pnpm codegen` typed hookokat + DTO-kat ad; az `apps/web` típus-helyesen importál; szándékos, nem-regenerált spec-változás megbukik a drift-en; az interim stub eltávolítva.

**Függőség:** 4.3–4.6 backend endpointok. **A web adat-kötött részeit (4.9–4.13) blokkolja** (a statikus shellt nem).

---

## 5. PREZENTÁCIÓ — Fázis 1 képernyők

> A prezentációs réteg **két platformra** szállít (web most, mobil párhuzamosan/Fázis 3), de **ugyanarra a közös magra** (`packages/{core,validation,api-client,i18n,tokens}`) épül. Egyik platform sem ír újra üzleti logikát: a `features/<terület>/use-*.ts` hookok csak *összekötik* a közös `api-client` hookot + `validation` sémát + `core` helpert a platform-specifikus UI-val. A különbség kizárólag a prezentáció: web = shadcn/Radix DOM, mobil = gluestack-ui v4 + NativeWind RN.

### 5.1 WEB (`apps/web`) — Fázis 1 képernyők

> Minden UI shadcn CLI-n át (`info` → `search`/`docs --base radix`/`view` → `add` → komponálás); szerver-állapot **kizárólag** a B4 generált hookjaiból; űrlapok RHF + `@homeops/validation`; szöveg `@homeops/i18n`; jogosultság-kapuzás `@homeops/core`. **A `src/components/ui/*` nincs kézzel szerkesztve.** Minden képernyő vékony `pages/*.tsx` + `features/<terület>/use-*.ts` hook + `mappers.ts` + `error-messages.ts` (a Fázis 0-ban rögzült minta).

### 4.9 — Háztartás + tagság + RBAC UI
- `features/households/`: `use-create-household.ts`, `use-household-switch.ts`, `use-members.ts`, `use-invite.ts`, `use-member-role.ts`; `mappers.ts`.
- `pages/households.tsx` (tagok `Table`+`Badge`), `Dialog` háztartás-létrehozás, `Dialog` meghívás (e-mail + role `Select`), role-kezelés `Select` OWNER/ADMIN-nak.
- A háztartás-váltó a meglévő app-shell `nav-user`/sidebar seam-jébe köt.
- **Akció-kapuzás `can()`/`isFinancialVisible()` a `core`-ból** (VIEWER csak olvas, gomb elrejtve).
- *Elfogadás:* OWNER meghív/kezel; VIEWER csak olvas; meghívó-link a Mailpitből aktivál (E2E).

### 4.10 — Teendők UI (egyszeri + RRULE)
- `features/obligations/`: `use-obligations.ts` (lista+szűrő), `use-obligation-form.ts` (create/edit), `use-obligation-actions.ts` (complete/skip); `mappers.ts`.
- `pages/obligations.tsx`: lista `Table`+`Badge` (státusz a `core/status.ts` derivált), szűrők; create/edit `Sheet` (cím, kategória, due date `Calendar`, felelős `Select`, becsült `Money`, lead-time); **ismétlés-szerkesztő `core/recurrence.ts`-szel + következő-előfordulás-előnézet**.
- *Elfogadás:* `FREQ=MONTHLY;BYMONTHDAY=15` helyes következő (előnézet); státusz-badge UPCOMING/DUE/OVERDUE; CHILD csak a sajátját látja (a szerver szűr).

### 4.11 — Kiadások + havi áttekintő UI
- `features/expenses/`: `use-expenses.ts`, `use-expense-form.ts`, `use-monthly-overview.ts`; `mappers.ts`.
- `pages/expenses.tsx`: rögzítés (`Money` egész minor + pénznem `Select` + dátum + kategória + ismétlődő flag + kapcsolt szolgáltatás), havi áttekintő shadcn `Chart`-tal (kategória-bontás + előző hó), **per-pénznem külön** (`core/money.ts`).
- *Elfogadás:* összegek egész minorként a hálózaton; chart renderel; nincs cross-currency összeg.

### 4.12 — Dashboard UI (szerepkör-érzékeny widget-térkép)

| Widget (§3.7) | shadcn kompozíció | Láthatóság |
|---|---|---|
| Mai/közeli teendők (felelőssel) | `Card`+`Table`+`Badge`+`Avatar` | minden role |
| Lejárati idővonal | `Card`+`Separator`/`Badge`; `Empty` ha üres | minden role |
| Havi kiadás-összesítő | `Card`+`Chart` | **CHILD/VIEWER rejtve** |
| Esedékes befizetések (overdue piros) | `Card`+`Table`+`Badge variant=destructive` | **CHILD/VIEWER rejtve** |
| Aktív riasztások | `Card`+`Alert` lista | minden role (pénzügyi szűrve) |

- `features/dashboard/use-dashboard.ts` (a `useGetDashboard` köré); a widget-térkép `isFinancialVisible(role)`-lal kapuz **a szerver-szűrés mellett** (kétréteg).
- *Elfogadás:* MEMBER → minden widget; CHILD/VIEWER → pénzügyi widgetek hiányoznak (komponens-teszt + a szerver sem küldi); perf <300 ms.

### 4.13 — Értesítés-preferenciák UI
- `features/notifications/use-notification-preferences.ts`; `pages/settings.tsx` bővítés (csatorna/típus + előzetes-ablak űrlap), „aktív riasztások" nézet (Web Push a Fázis 3+).
- *Elfogadás:* preferenciák oda-vissza API-n; közelgő-esedékes e-mail a Mailpitben.

---

## 5.2 MOBILE (`apps/mobile`) — Fázis 1 képernyők

> **A mobil a webbel azonos `features/<terület>/use-*.ts` + `mappers.ts` réteget használja** — ezek a hookok platform-függetlenek (csak `@homeops/api-client` + `@homeops/validation` + `@homeops/core`), ezért **nem íródnak újra**: a közös csomagba (vagy egy platform-független `features/` rétegbe) kerülnek, és a web és a mobil egyaránt importálja. **Csak a prezentáció platform-specifikus.**
>
> **Mobil UI-konvenciók (a Fázis 0-ban rögzült házi kit, lásd a mobile design-system memóriát):** képernyők a `src/components/` house-style rétegből épülnek (`Screen`/`ScreenTitle`, `SectionCard`, `IconBadge`, `EmptyState`, `FormField`, `FormAlert`, `QuickAction`, `AppIcon`) a gluestack-ui v4 `ui/` primitívek fölött — **SOHA nyers `Card`/`VStack`-ből**. **Csak szemantikus tokenek** (`bg-background`/`bg-card`/`bg-muted`, `text-foreground`/`text-muted-foreground`, `bg-primary`+`-foreground`, `bg-destructive`, `bg-success`/`bg-warning`/`bg-info`) — a számozott gluestack-skála tiltott. Navigáció = **oldal-drawer** (`expo-router/drawer`, `AppDrawerContent`), nem bottom-tabs. Űrlapok: RHF + `@homeops/validation` (`zodResolver`, ugyanaz a séma mint a weben). Szöveg: `@homeops/i18n` (HU/EN paritás). Szerver-állapot: a **B4 generált TanStack Query hookjai** (`@homeops/api-client`), a bearer token a `token-store` secure-store seamjéből (a mutator már kész). Jogosultság-kapuzás: `can()`/`isFinancialVisible()` a `core`-ból.

### M4.9 — Háztartás + tagság + RBAC (mobil)
- Hookok: **a 4.9 `features/households/` réteg újrahasználva** (`use-create-household`, `use-household-switch`, `use-members`, `use-invite`, `use-member-role`, `mappers.ts`) — platform-független, megosztott.
- Képernyők (`app/(app)/households/`): háztartás-lista `SectionCard` sorok + role-`IconBadge`; létrehozás/meghívás `Actionsheet` modalban (`FormField` e-mail + role-picker `Actionsheet`); tag-lista `SectionCard` sorok role-pillel; role-váltás `Actionsheet` OWNER/ADMIN-nak; üres állapot `EmptyState`.
- **Háztartás-váltó az app-drawer household-lockup seamjébe** köt (Fázis 0 `AppDrawerContent`); a `switch` új access-tokent ad (a token-store-ba).
- **Akció-kapuzás `can()`/`isFinancialVisible()`** (VIEWER read-only, gomb rejtve).
- *Elfogadás:* OWNER meghív/kezel; VIEWER csak olvas; meghívó **deep-link** (`homeops://invite/<token>` / universal link) → accept; háztartás-váltás új tokennel.

### M4.10 — Teendők (egyszeri + RRULE) (mobil)
- Hookok: **a 4.10 `features/obligations/` réteg újrahasználva** (lista+szűrő, form, complete/skip akciók).
- Képernyők: lista `SectionCard` + státusz-`IconBadge` (a `core/status.ts` derivált — ugyanaz mint a weben), szűrő `Actionsheet`; create/edit modal (cím, kategória, due date **natív date-picker**, felelős-picker, becsült `Money`, lead-time); **ismétlés-szerkesztő `core/recurrence.ts`-szel + következő-előfordulás-előnézet** (azonos számítás, RN render); complete/skip swipe- vagy gomb-akció.
- *Elfogadás:* `FREQ=MONTHLY;BYMONTHDAY=15` helyes következő (előnézet); státusz-pill UPCOMING/DUE/OVERDUE; CHILD csak a sajátját látja (a szerver szűr).

### M4.11 — Kiadások + havi áttekintő (mobil)
- Hookok: **a 4.11 `features/expenses/` réteg újrahasználva** (lista, form, havi áttekintő).
- Képernyők: rögzítés modal (`Money` egész minor + pénznem-picker + dátum + kategória + ismétlődő `Switch` + kapcsolt szolgáltatás); havi áttekintő `SectionCard` kártyák kategória-bontással + előző hó delta, **per-pénznem külön** (`core/money.ts`). Chart: RN-kompatibilis lib (pl. `victory-native`/`react-native-svg`), de a **chart-adat-derivált a `core`-ból** — csak a render más.
- *Elfogadás:* összegek egész minorként a hálózaton; per-pénznem külön; nincs cross-currency összeg.

### M4.12 — Dashboard (szerepkör-érzékeny) (mobil)
- Hook: **a 4.12 `features/dashboard/use-dashboard.ts` újrahasználva.** A widget-térkép ugyanaz, `SectionCard`/`IconBadge`/`EmptyState` kompozícióval; a havi-kiadás és esedékes-befizetés widget **CHILD/VIEWER-nél rejtve** (`isFinancialVisible` a `core`-ból + a szerver sem küldi — kétréteg).
- *Elfogadás:* MEMBER → minden widget; CHILD/VIEWER → pénzügyi widgetek hiányoznak (a szerver sem küldi).

### M4.13 — Értesítés-preferenciák (mobil)
- Hook: **a 4.13 `features/notifications/use-notification-preferences.ts` újrahasználva.** Settings-képernyő bővítés (csatorna/típus + előzetes-ablak `FormField`/`Switch`).
- A **push (Expo Notifications) a Fázis 3** — itt csak az `EMAIL`-preferencia UI; a push-csatorna seam a meglévő outbox-`channel` enumra épül (4.7), a worker-interfész nem változik.
- *Elfogadás:* preferenciák oda-vissza API-n.

**Web/mobil kapcsolat (mind a 4.9–4.13 / M4.9–M4.13-ra):** a hook-ok csak *összekötik* a közös `api-client` + `validation` + `core` hármast a platform UI-jával. A web és a mobil **ugyanazt a hármast importálja**, csak a prezentáció (shadcn DOM vs. gluestack-ui/NativeWind RN) más. **Semmi üzleti döntés nem szivárog a prezentációba** — sem a webbe, sem a mobilba.

---

## 6. Migrációk és indexek (összefoglaló)

| Migráció | Táblák | Index / kényszer | RLS |
|---|---|---|---|
| `invitations` (4.3) | invitations | `household_id` idx; token_hash UNIQUE | igen |
| `roles seed` (4.2) | roles (data) | — | — |
| `obligations` (4.4) | obligations | **`(household_id, due_date, status)`**; currency CHECK | igen |
| `expenses` (4.5) | expenses | **`(household_id, occurred_on)`**; currency CHECK | igen |
| `notifications` (4.7) | notifications, notification_preferences | `dedup_key` UNIQUE; `(status, next_attempt_at)` | igen |
| `audit_log` (4.8) | audit_log | `household_id` idx; **app-szerep UPDATE/DELETE REVOKE** | igen |

**Minden migrációra kötelező:** `household_id` index + `ENABLE/FORCE ROW LEVEL SECURITY` + policy `USING/WITH CHECK (household_id = current_setting('app.current_household')::uuid)` (a Fázis 0 mintája szerint); `alembic check` drift-mentes.

---

## 7. Tesztelési mátrix (PLAN §9)

- **Unit (pytest + Vitest):** `domain/` (Money, recurrence, status), `services/` magas lefedettség; `core`/`validation` Vitest. **Közös RRULE/Money fixture** mindkét oldalon.
- **Integráció (Testcontainers PG16):** households/invitations/obligations/expenses/dashboard/outbox; **RLS negatív teszt** (`WHERE` elhagyva → 0 cross-tenant sor); outbox idempotencia + `SKIP LOCKED`; dashboard EXPLAIN.
- **Security:** cross-tenant authz; CHILD obligation-scope; RBAC role-mátrix; audit immutábilis; „titok sosem logban".
- **Contract:** OpenAPI-drift (`pnpm codegen && git diff --exit-code`) + Spectral.
- **E2E (Playwright, `https://homeops.localhost`):** register→aktiválás→login→háztartás→meghívó(Mailpit-link)→teendő(RRULE)→kiadás→dashboard(role-érzékeny)→scheduler→**1** e-mail a Mailpitben.

---

## 8. Fázis 1 kilépési kritérium (ellenőrzőlista)

- [ ] Több-tagú, szerepkörös háztartás; meghívó-flow a Mailpiten át; háztartás-váltás új tokennel.
- [ ] RBAC-motor minden service-műveleten; cross-tenant izoláció RLS-sel bizonyítva.
- [ ] Egyszeri + ismétlődő (RRULE) teendő felelőssel; complete→következő-előfordulás.
- [ ] Kiadás-rögzítés egész minorban; havi áttekintő per-pénznem, FX nélkül.
- [ ] Szerepkör-érzékeny dashboard (CHILD/VIEWER nem lát pénzügyet — szerver + kliens).
- [ ] Nem-duplikált e-mail emlékeztető esedékesség előtt (outbox idempotencia, külön process).
- [ ] Audit-log érzékeny műveletekre, immutábilis.
- [ ] **Minden üzleti logika a `packages/*`-ban (core/validation/api-client/types/i18n); `apps/web` csak prezentáció — a Fázis 3 mobil újrahasználatra kész.**
- [ ] CI zöld: lint/typecheck/unit/integráció/contract(drift+Spectral)/deps/sast/i18n.

---

## 9. Függőségi gráf (Fázis 1)

```
4.1 domain ─┬─ 4.2 RBAC ─┬─ 4.3 háztartás/meghívó ──┐
            │            ├─ 4.4 teendők (RRULE) ─────┼─ 4.6 dashboard
            │            └─ 4.5 kiadások ────────────┘
            │   4.4 + Fázis0 mailer → 4.7 outbox/scheduler/worker (külön process)
            │   4.2 + 4.3 → 4.8 audit
B1 validation ∥ B2 core ∥ B3 i18n ──→ B4 codegen ⟵ (4.3–4.6 OpenAPI)
                                          └─→ 4.9 → 4.10 → 4.11 → 4.12 → 4.13 (web)
```
