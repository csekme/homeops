# HomeOps — FÁZIS 1 részletes folytatási terv (4.4 → vég)

> **Hatókör:** ez a dokumentum a `docs/phase1.md` munkatételeit **4.4-től a Fázis 1 végéig** bontja le nagy granularitású, sorrendezett, fájl-szintű lépésekre — **backend (4.4–4.8) + közös csomagok (B1–B4) + web (4.9–4.13) + mobil (M4.9–M4.13)**.
>
> **Kiindulás (kész):** 4.1 domain (`Money`, `next_occurrence`, `derive_status`, enumok), 4.2 RBAC-motor (`MembershipContext`, `resolve_permissions`, `require_permission`), 4.3 háztartás/tagság/meghívó (service + repo + `api/households.py` + `invitations` migráció RLS-sel). A `NEXT.md` szerint a következő tétel: **4.4**.
>
> **Megjegyzés a tényleges állapotról (drift a phase1.md-hez képest):** a `packages/validation` **már namespace-szerűen tagolt** (van `obligationSchema`, `expenseSchema`, `serviceSchema`, `roleSchema`), a `packages/core` `permissions.ts`/`status.ts`/`money.ts` **kész és exportált**, az `orval.config.ts` + `codegen` scriptek **léteznek** (snapshot-alapú), az `apps/mobile` viszont **csak váz** (nincs `src/`). Ezt a terv minden érintett pontján jelzem (✅ kész / 🔧 bővítés / 🆕 új).

---

## 0. Végrehajtási sorrend és függőségek (4.4-től)

```
[KÉSZ] 4.1 domain ─ 4.2 RBAC ─ 4.3 háztartás/meghívó
                                      │
   ┌──────────────────────────────────┼───────────────────────────┐
   ▼                                  ▼                            ▼
4.4 teendők (RRULE) ───────┐    4.5 kiadások ──────────┐
   │                       └──────────┬─────────────────┘
   │                                  ▼
   │                            4.6 dashboard (4.4 + 4.5)
   │
   ├─ 4.4 + Fázis0 mailer ─→ 4.7 outbox/scheduler/worker (külön process)
   └─ 4.2 + 4.3 ──────────→ 4.8 audit log

Közös csomagok (a backend-del párhuzamosan):
  B1 validation (kvázi kész, finomítás) ∥ B2 core (apró) ∥ B3 i18n feltöltés
        └──→ B4 orval codegen ⟵ (a 4.3–4.6 OpenAPI véglegesedésére vár)
                  └──→ web 4.9 → 4.10 → 4.11 → 4.12 → 4.13
                  └──→ mobil M4.9 → M4.10 → M4.11 → M4.12 → M4.13
```

**Kemény kötések (változatlan a phase1.md §2-höz képest):**
1. Minden új tartalom-tábla migrációja **`household_id` + RLS-policy + index** — sosem utólag.
2. Minden tenant-művelet **első sora `require_permission(...)`**.
3. A scheduler+worker **külön processben** (4.7), sosem a web-workerben.
4. **B4 codegen a backend OpenAPI-ra vár** — a web/mobil adat-kötött része addig a B4-re blokkol; a statikus shell mehet előre.
5. Money mindenhol **egész minor + ISO-4217**, soha float — backend `Money` ↔ `core/money.ts` paritás.

**Ajánlott munkamenet / commit-sorrend (mindegyik önállóan zöld CI):**
`4.4 → 4.5 → 4.6 → 4.8 → 4.7` backend, közben `B3` (i18n) folyamatosan; majd `B4` codegen; végül `web 4.9–4.13`; a `mobile bootstrap + M4.9–M4.13` a web után vagy azzal párhuzamosan (más fejlesztő).

> A 4.8 (audit) szándékosan a 4.7 elé került: a 4.7 enqueue-helperje is auditálható, és az audit egyszerűbb tétel, így a 4.7 már a kész `audit_service`-re építhet.

---

# A. BACKEND

> **Minden backend-tétel ugyanazt a 4.3-ban rögzült réteg-mintát követi:**
> `migrations/versions/*` (tábla + RLS) → `db/models.py` (model) → `repositories/<x>.py` (explicit `household_id` szűrés, `session` paraméter) → `services/<x>_service.py` (RBAC-gate + dataclass view-k) → `api/<x>.py` (vékony controller, `current_membership()`, kivétel→HTTP) → `api/schemas.py` (Pydantic in/out) → `api/__init__.py` regisztráció → tesztek.
>
> **RLS-minta a migrációkban (kötelező, 4.3 `b1c2d3e4f5a6` szerint):** `ENABLE`+`FORCE ROW LEVEL SECURITY`, policy `USING/WITH CHECK (household_id = NULLIF(current_setting('app.current_household', true), '')::uuid)` (null-safe a pooled connection reset miatt), + a `bypass_tenant` GUC ágat tükrözni, ahogy a meglévő policy-k.
>
> **Session-minta a service-ekben:** tenant-művelet → `with session_scope(household_id=membership.household_id) as s:`; cross-household olvasás (ritka) → `bypass_tenant=True`.

---

## 4.4 — Teendők, ismétlődő RRULE

**Cél:** egyszeri + ismétlődő (RRULE) teendők felelőssel, **derivált** státusszal, complete/skip flow-val (ismétlődőnél a következő előfordulás generálása).

### 4.4.1 Migráció 🆕 `migrations/versions/<rev>_obligations.py`
- `obligations` tábla (`TenantMixin` → `household_id` FK + index automatikus):
  - `id` (UUID PK), `household_id` (FK, RLS), `created_at`/`updated_at`.
  - `title` (str, NOT NULL), `description` (text, null), `category` (str, null).
  - `due_date` (Date, NOT NULL), `rrule` (str, null).
  - `status` (str, NOT NULL, default `'UPCOMING'`) — **CHECK** az `ObligationStatus` értékekre.
  - `assignee_membership_id` (UUID FK → `memberships.id`, `ondelete=SET NULL`, null, index).
  - `estimated_amount_minor` (BigInteger, null), `actual_amount_minor` (BigInteger, null).
  - `currency` (CHAR(3), null) — **CHECK** `~ '^[A-Z]{3}$'`.
  - `lead_time_days` (Integer, NOT NULL, default 0).
  - `completed_at` (timestamptz, null), `deleted_at` (timestamptz, null).
- **Index:** összetett `ix_obligations_household_due_status (household_id, due_date, status)` (dashboard + scheduler ezt fésüli).
- **RLS-policy** a fenti null-safe mintával; `FORCE ROW LEVEL SECURITY`.
- Lefutás után: `alembic check` drift-mentes.

### 4.4.2 Model 🔧 `db/models.py`
- `class Obligation(UUIDPrimaryKeyMixin, TimestampMixin, TenantMixin)` — fenti oszlopok; `assignee` relationship a `Membership`-re (lazy, `viewonly` nem kell); `status` `Mapped[str]` (a domain enumot a service kezeli, a DB CHECK véd).

### 4.4.3 Repository 🆕 `repositories/obligations.py`
- `create(session, *, household_id, title, description, category, due_date, rrule, status, assignee_membership_id, estimated_amount_minor, actual_amount_minor, currency, lead_time_days) -> Obligation`
- `get(session, obligation_id) -> Obligation | None` (explicit nem-`deleted_at` szűrés).
- `list(session, *, status=None, assignee_membership_id=None, due_from=None, due_to=None) -> list[Obligation]` — szűrők, `deleted_at IS NULL`, rendezés `due_date`.
- `update(session, obligation, **fields) -> None`
- `soft_delete(session, obligation) -> None` (`deleted_at = now`).
- Minden metódus explicit `household_id`-re szűr (mélységi védelem az RLS mellett).

### 4.4.4 Service 🆕 `services/obligation_service.py`
- View dataclass: `ObligationView` (id, title, description, category, due_date, rrule, **derived_status**, assignee_membership_id, estimated_amount_minor/currency, actual_amount_minor, lead_time_days, completed_at).
- `create(membership, data) -> ObligationView` → **első sor `require_permission(membership, "obligation.write")`**; RRULE-validáció `domain/recurrence.py` (`next_occurrence` próbahívás / `rrulestr` parse) — hibás RRULE → `InvalidObligation` (új exception).
- `update(membership, obligation_id, data) -> ObligationView` → `obligation.write`; nem-létező → `ObligationNotFound`.
- `delete(membership, obligation_id) -> None` → `obligation.write`; soft-delete.
- `list(membership, filters) -> list[ObligationView]` → `obligation.read`; **CHILD-szűkítés service-szinten:** ha `membership.role == CHILD`, a lista kényszerítve `assignee_membership_id == <a CHILD membershipje>` (a CHILD csak a rá kiosztottat látja — nem UI-szűrés). A view státusza **`derive_status(due_date, status, completed_at, today, lead_time_days)`** szerint derivált (UPCOMING/DUE/OVERDUE), a DONE/SKIPPED megmarad.
- `complete(membership, obligation_id) -> ObligationView` → `obligation.write`; aktuális sor `DONE` + `completed_at=now`; **ha `rrule` van: `next = next_occurrence(rrule, after=due_date)` → új `Obligation` sor** ugyanazokkal a mezőkkel, `due_date=next`, `status=UPCOMING` (ha `next is None`, nincs új sor).
- `skip(membership, obligation_id) -> ObligationView` → `obligation.write`; `SKIPPED` + (ismétlődőnél) következő generálás, mint a complete.
- Új exceptionök 🔧 `services/exceptions.py`: `ObligationNotFound` (→404), `InvalidObligation` (→422/400).

### 4.4.5 Controller 🆕 `api/obligations.py`
- `obligations_bp` APIBlueprint, `@bearer_auth` védve, `current_membership()` a kontextushoz.
- `GET /api/obligations` (query: `ObligationListQuery`), `POST /api/obligations`.
- `GET /api/obligations/{id}`, `PATCH /api/obligations/{id}`, `DELETE /api/obligations/{id}`.
- `POST /api/obligations/{id}/complete`, `POST /api/obligations/{id}/skip`.
- Kivétel→HTTP: `PermissionDenied`→403 (központi handler), `ObligationNotFound`→404, `InvalidObligation`→422.

### 4.4.6 Sémák 🔧 `api/schemas.py`
- `ObligationIn` (create/update body), `ObligationOut` (a `derived_status`-szal), `ObligationListQuery` (`status`, `assignee`, `due_from`, `due_to`).
- Money-mezők: `estimated_amount_minor: int | None` + `currency: str | None` (regex `^[A-Z]{3}$`).

### 4.4.7 Regisztráció 🔧 `api/__init__.py`
- `app.register_blueprint(obligations_bp)`.

### 4.4.8 Tesztek
- `tests/unit/domain/test_recurrence.py` 🔧 — **közös fixture** (`tests/fixtures/recurrence_cases.json`) `FREQ=YEARLY` + `FREQ=MONTHLY;BYMONTHDAY=15`.
- `tests/integration/test_obligations.py` 🆕 — CRUD; ismétlődő `complete` → következő sor; szűrők; derivált státusz.
- `tests/security/test_obligation_child_scope.py` 🆕 — CHILD csak a rá kiosztottat listázza (más assignee → 0 sor); CHILD write → 403.

**Elfogadás:** ismétlődő befejezés a következőt szüli; CHILD-scope a szerveren tart; státusz derivált.
**Web/mobil kapcsolat:** az RRULE-előnézet és státusz-badge a `core` (`nextOccurrence`/`deriveStatus`) — közös; `obligationSchema` ✅ már él a `validation`-ben.
**Függőség:** 4.1, 4.2.

---

## 4.5 — Kiadások + havi áttekintő

**Cél:** kiadás-rögzítés egész minorban + soronkénti ISO-4217 pénznemmel; havi aggregáció `GROUP BY currency, category`, **FX nélkül** (döntés 10.1).

### 4.5.1 Migráció 🆕 `migrations/versions/<rev>_expenses.py`
- `expenses` tábla (`TenantMixin`):
  - `amount_minor` (BigInteger, NOT NULL), `currency` (CHAR(3), NOT NULL, CHECK `^[A-Z]{3}$`).
  - `occurred_on` (Date, NOT NULL), `category` (str, null).
  - `service_id` (UUID FK → `services.id`, null) — **a `services` tábla a Fázis 2; egyelőre nullable FK constraint nélkül vagy deferred** (döntés: oszlop most, FK a Fázis 2-ben; addig sima UUID null oszlop, hogy ne legyen lógó FK).
  - `note` (text, null), `is_recurring` (bool, NOT NULL, default false), `deleted_at` (timestamptz, null).
- **Index:** `ix_expenses_household_occurred (household_id, occurred_on)` (PLAN §11).
- RLS-policy + `FORCE`.

### 4.5.2 Model 🔧 `db/models.py`
- `class Expense(UUIDPrimaryKeyMixin, TimestampMixin, TenantMixin)`.

### 4.5.3 Repository 🆕 `repositories/expenses.py`
- `create / get / update / soft_delete` (mint az obligations).
- `list(session, *, year=None, month=None, category=None) -> list[Expense]`.
- `monthly_summary(session, *, year, month) -> list[Row]` — **SQL aggregáció `GROUP BY currency, category`** (`SUM(amount_minor)`, `COUNT`), külön a `is_recurring` szerinti bontás; az **előző hó** ugyanígy a delta-számításhoz (két lekérdezés vagy `GROUPING SETS`).

### 4.5.4 Service 🆕 `services/expense_service.py`
- View: `ExpenseView`, `MonthlyOverviewView` (per-currency tömb, azon belül per-category; `fixed_total`/`variable_total` `is_recurring` szerint; hó/hó `delta_minor`).
- CRUD → `require_permission(..., "expense.write")` / `"expense.read"`.
- `monthly_overview(membership, year, month) -> MonthlyOverviewView` → `expense.read`; az aggregációt **`Money` value object**-ekbe csomagolja **pénznemenként külön** (soha cross-currency összeadás); a delta a két hó per-(currency,category) különbsége.

### 4.5.5 Controller 🆕 `api/expenses.py`
- `GET/POST /api/expenses`, `GET/PATCH/DELETE /api/expenses/{id}`, `GET /api/expenses/overview?year&month`.

### 4.5.6 Sémák 🔧 `api/schemas.py`
- `ExpenseIn/Out`, `MonthlyOverviewOut` (per-currency → per-category tömbök + delta + fixed/variable).

### 4.5.7 Regisztráció 🔧 `api/__init__.py` — `expenses_bp`.

### 4.5.8 Tesztek
- `tests/integration/test_expenses.py` 🆕 — CRUD, egész minor a hálózaton.
- `tests/integration/test_monthly_overview.py` 🆕 — két hónap/kategória/pénznem → helyes per-(currency,category) összeg + hó/hó delta; **nincs cross-currency összeg**.
- `tests/integration/test_expense_query_plan.py` 🆕 — `EXPLAIN` az `(household_id, occurred_on)` indexet használja.

**Elfogadás:** per-kategória/per-pénznem összeg + trend helyes; sosem float; index-használat igazolt.
**Web/mobil kapcsolat:** Money-formázás + per-currency csoport a `core/money.ts` (`groupByCurrency`/`formatMoney` — lásd B2); `expenseSchema` ✅ él.
**Függőség:** 4.1, 4.2.

---

## 4.6 — Dashboard endpoint (szerepkör-érzékeny)

**Cél:** egy aggregáló endpoint a 4.4/4.5 indexeire; CHILD/VIEWER **szerver oldalon** kihagyja a pénzügyi blokkokat.

### 4.6.1 Service 🆕 `services/dashboard_service.py`
- `build_dashboard(membership) -> DashboardView`:
  - **közelgő teendők** (7–30 napos ablak `due_date`-re, felelőssel, derivált státusz) — az `obligation_service.list` / repo újrahasználata a `(household_id, due_date, status)` indexen.
  - **lejárati idővonal** (sorba rendezett közelgő esedékességek).
  - **havi költés + kategória + előző hó delta** — az `expense_service.monthly_overview` újrahasználata.
  - **esedékes befizetések** (overdue jelölve).
  - **aktív riasztások** (4.7 outbox `PENDING`/közelgő — ha a 4.7 már él; addig üres lista / seam).
  - **RBAC-szűrés a service-ben:** ha a role-nak nincs `expense.read` permissionje (≈ `isFinancialVisible` backend-párja → `has_permission(resolve_permissions(role), "expense.read")`), a **havi-költés + esedékes-befizetés blokk kimarad a válaszból** (`None`/hiányzó mező, nem csak UI-elrejtés).
- View dataclass-ok: `DashboardView` opcionális pénzügyi mezőkkel.

### 4.6.2 Controller 🆕 `api/dashboard.py` — `GET /api/dashboard`.
### 4.6.3 Séma 🔧 `api/schemas.py` — `DashboardOut` (opcionális pénzügyi mezők).
### 4.6.4 Regisztráció 🔧 `api/__init__.py` — `dashboard_bp`.

### 4.6.5 Tesztek
- `tests/integration/test_dashboard.py` 🆕 — role-mátrix: OWNER/ADMIN/MEMBER → minden widget; **CHILD/VIEWER → pénzügyi blokkok hiányoznak a JSON-ból**.
- `tests/integration/test_dashboard_perf.py` 🆕 — `EXPLAIN` az összetett indexet használja; cél <300 ms.

**Elfogadás:** role-érzékeny payload + index-használat.
**Web/mobil kapcsolat:** kétréteg — szerver elhagyja, kliens `isFinancialVisible` (core) kapuzza; web és mobil ugyanazt a helpert használja.
**Függőség:** 4.4, 4.5.

---

## 4.8 — Audit log alap (a 4.7 elé húzva)

**Cél:** append-only audit minden érzékeny műveletre; az app-szerep nem szerkeszt/töröl.

### 4.8.1 Migráció 🆕 `migrations/versions/<rev>_audit_log.py`
- `audit_log` tábla (`TenantMixin`, **csak `created_at`, nincs `updated_at`**): `actor_user_id` (UUID), `action` (str), `target_type` (str), `target_id` (UUID, null), `metadata` (JSONB), `ip` (str, null), `ua` (str, null).
- RLS-policy + `household_id` index.
- **`REVOKE UPDATE, DELETE ON audit_log FROM homeops_app;`** + opcionális `BEFORE UPDATE OR DELETE` trigger ami `RAISE EXCEPTION` (defense-in-depth).

### 4.8.2 Model 🔧 `db/models.py` — `class AuditLog(UUIDPrimaryKeyMixin, TenantMixin)` + saját `created_at` (nincs `TimestampMixin`).

### 4.8.3 Repository 🆕 `repositories/audit.py` — `append(session, *, household_id, actor_user_id, action, target_type, target_id, metadata, ip, ua) -> AuditLog` (csak insert).

### 4.8.4 Service 🆕 `services/audit_service.py` — `audit(membership, action, target_type, target_id=None, metadata=None, ip=None, ua=None) -> None` központi helper.

### 4.8.5 Beépítés 🔧 a meglévő/új service-ekbe:
- `household_service`: role-változás (`update_member_role`), tag-eltávolítás (`remove_member`), `delete_household`, `invite`/`accept_invitation`.
- `obligation_service` / `expense_service`: törlés (delete) auditálva.
- (4.7 után) connector-művelet — Fázis 2.

### 4.8.6 Tesztek
- `tests/integration/test_audit_log.py` 🆕 — role-váltás → 1 audit-sor a helyes mezőkkel.
- `tests/security/test_audit_immutable.py` 🆕 — `UPDATE audit_log` / `DELETE` a `homeops_app` szereppel → hiba.

**Elfogadás:** érzékeny művelet → immutábilis audit-sor; az app nem szerkeszt/töröl.
**Függőség:** 4.2, 4.3 (a hívási helyek).

---

## 4.7 — Értesítések: outbox + scheduler + idempotens worker

**Cél:** megbízható, idempotens e-mail-emlékeztető a Fázis 0 `EmailSender`-én; **külön processben** futó scheduler + worker.

### 4.7.1 Migráció 🆕 `migrations/versions/<rev>_notifications.py`
- `notifications` = **outbox** (`TenantMixin`): `type` (CHECK `NotificationType`), `channel` (CHECK `NotificationChannel`, most csak `EMAIL`), `status` (CHECK `NotificationStatus`, default `PENDING`), `scheduled_for` (timestamptz), **`dedup_key` (str, UNIQUE)**, `payload` (JSONB), `attempts` (int, default 0), `next_attempt_at` (timestamptz, null), `last_error` (text, null), `created_at`.
- `notification_preferences`: `user_id` (FK), `household_id` (FK, RLS), `type`, `channel`, `enabled` (bool, default true), `lead_times` (int[], default `'{}'`). UNIQUE `(user_id, household_id, type, channel)`.
- **Indexek:** `(status, next_attempt_at)` (worker claim), `dedup_key` UNIQUE. RLS-policy mindkettőn.

### 4.7.2 Model 🔧 `db/models.py` — `Notification`, `NotificationPreference`.

### 4.7.3 Repository 🆕 `repositories/notifications.py`
- `enqueue(session, *, household_id, type, channel, scheduled_for, dedup_key, payload) -> bool` — **`INSERT ... ON CONFLICT (dedup_key) DO NOTHING`** (idempotens; visszaadja, hogy beszúrt-e).
- `claim_batch(session, *, limit, now) -> list[Notification]` — **`SELECT ... WHERE status IN (PENDING) AND next_attempt_at <= now FOR UPDATE SKIP LOCKED LIMIT n`**.
- `mark_sent(session, n)`, `mark_failed(session, n, error, next_attempt_at)`, `mark_dead(session, n, error)`.
- Preferenciák: `get_preferences(session, user_id)`, `upsert_preference(...)`.

### 4.7.4 Service 🆕 `services/notification_service.py`
- preferenciák olvasás/írás (RBAC: saját preferencia — `member` szint).
- `enqueue_*` helper a többi service-nek (a `dashboard`/scheduler hívja).

### 4.7.5 Scheduler 🔧 `tasks/scheduler.py` (a Fázis 0 váz feltöltése)
- Napi pásztázó job: a `obligations`-ből a `(due_date - lead_time_days) == ma` (ill. ablak) sorokra → **idempotens outbox-insert** `dedup_key = f"{type}:{obligation_id}:{occurrence_date}"`.
- Heti digest job (vasárnap). A `create_scheduler().add_daily_job(...)` API-t használja.

### 4.7.6 Worker 🆕 `tasks/notification_worker.py`
- `run_once()`: `claim_batch` → minden elemre küldés `EmailSender`-rel a `payload`-ból (`build_*_email` a `messages.py`-ból) → `mark_sent`; hibánál `mark_failed` + **exponenciális backoff** (`next_attempt_at = now + base * 2**attempts`); `attempts >= MAX` → `mark_dead` (metrika/riasztás).
- `run_forever()` poll-loop (vagy a scheduler hívja periodikusan).

### 4.7.7 Process-belépés 🆕 `tasks/__main__.py` (vagy `flask worker` CLI)
- A scheduler + worker **külön belépési ponton** indul (`python -m app.tasks`), **nem** a `create_app()`-ben (PLAN §12.5). A Fázis 0 `__init__.py` ezt már tiszteletben tartja (a factory nem indít schedulert).

### 4.7.8 E-mail sablonok 🆕 `notifications/email/templates/` + `messages.py` 🔧
- `obligation_due`, `payment_due`, `overdue`, `weekly_digest` HTML+txt Jinja sablonok; `build_*_email(...)` factory-k (HU/EN, mint az `invitation`).

### 4.7.9 Tesztek
- `tests/integration/test_outbox_idempotency.py` 🆕 — kétszeri scheduler-futás ugyanarra az ablakra → **0 duplikált** outbox-sor (`dedup_key`).
- `tests/integration/test_worker_skip_locked.py` 🆕 — két worker párhuzamosan → nincs dupla küldés.
- `tests/integration/test_worker_retry.py` 🆕 — bukó küldés retry-zik (backoff) → kimerítve `DEAD`.

**Elfogadás:** 0 duplikált sor; 1 e-mail a Mailpitben; bukás retry, nem vész el; külön process.
**Web/mobil kapcsolat:** a `channel` enumban már ott az `EMAIL`; a push (Fázis 3) ugyanennek az outboxnak új csatornája — a worker-interfész változatlan. Preferencia-DTO közös (`types`).
**Függőség:** 4.4 (obligations a pásztázáshoz), Fázis 0 `EmailSender`, 4.8 (audit hívás, opcionális).

---

# B. MEGOSZTOTT CSOMAGOK (`packages/*`)

> A Fázis 1 web/mobil-közös magja. Minden itt szállított dolgot a mobil **változtatás nélkül** újrahasznál.

## B1 — `packages/validation` (✅ kvázi kész — finomítás)
**Állapot:** a sémák már léteznek (`obligationSchema`, `expenseSchema`, `serviceSchema`, `inviteSchema`, `householdSchema`, `roleSchema`, primitívek). **Teendő:**
- 🔧 Ellenőrizni/kiegészíteni: `notificationPreferenceSchema` (type/channel enum + `lead_times: number[]`), `householdSchema.default_currency` ISO-4217 regex, `obligationSchema` RRULE-szintaxis-validáció (refine: `rrulestr`-kompatibilis vagy üres).
- 🔧 Enumokat **`@homeops/core`-ból** importál (drift ellen) — már így van a `roleSchema`-nál; obligation status / billing cycle ugyanígy.
- ✅ Money-mező szabály: `z.number().int()` minor + ISO-4217 string mindenhol.
- **Tesztek:** Vitest valid/invalid fixture minden új/módosított sémára; enum-paritás teszt (`core` ↔ `validation`).

## B2 — `packages/core` (🔧 apró bővítés)
- ✅ `permissions.ts` (`can`, `isFinancialVisible`, `PERMISSIONS`, `ROLES`) — kész.
- 🔧 `money.ts`: `groupByCurrency(items)` + `formatMoney(money, locale)` helper a havi-áttekintő UI-hoz (web + mobil közös) — **csak ha a 4.11 UI igényli** (valószínűleg igen).
- ✅ `status.ts`, `recurrence.ts` — kész (csak a közös fixture-bővítés).
- **Backend-paritás teszt:** közös `tests/fixtures/recurrence_cases.json` + `permissions` paritás a backend `ROLE_PERMISSIONS`-szal (pytest + Vitest ugyanazt olvassa).

## B3 — `packages/i18n` (🔧 feltöltés — folyamatos, párhuzamos)
- A namespace-vázak léteznek (`common/auth/dashboard/obligations/expenses/services/settings/validation`). **Teendő:** a Fázis 1 szövegek feltöltése **HU (default) + EN**:
  - `obligations` (lista, státuszok UPCOMING/DUE/OVERDUE/DONE/SKIPPED, complete/skip, ismétlés-szerkesztő, előnézet).
  - `expenses` (rögzítés, havi áttekintő, kategóriák, per-pénznem, fix/változó, hó/hó delta).
  - `dashboard` (widget-címek, üres állapotok, riasztások).
  - `common` (akciók, üres állapotok, megerősítő dialógusok), `validation` (Zod hibakulcsok), `settings` (értesítés-preferenciák).
- **HU/EN kulcs-paritás kötelező** (`parity.test.ts` CI-gate).

## B4 — OpenAPI codegen: orval → `types` + `api-client` (🔧 aktiválás)
**Állapot:** `orval.config.ts` + `pnpm codegen` / `codegen:fetch` / `codegen:lint` scriptek + `customInstance` mutator **léteznek**; nincs még `src/generated/`. **Teendő — amint a 4.3–4.6 endpointok élnek:**
1. Backend `GET /api/openapi.json` tartalmazza a household/invitation/obligation/expense/dashboard/notification sémákat (a Pydantic in/out sémákból automatikus).
2. `pnpm codegen:fetch` → frissíti `openapi.snapshot.json`; `pnpm codegen` → generál: hookok `packages/api-client/src/generated`, DTO-k `packages/types/src/generated`.
3. `packages/api-client/src/index.ts` re-exportálja a generált hookokat (`useGetObligations`, `useCreateObligation`, `useCompleteObligation`, `useGetExpenses`, `useGetExpensesOverview`, `useGetDashboard`, `useSwitchHousehold`, `useCreateInvitation`, `useGetMembers`, …).
4. A **kézi interim stubok eltávolítása** (a hand-written `auth.ts`/`totp.ts` maradhat, ha a generált auth nem fedi a 2FA challenge-flow-t — döntés a codegen-kimenet alapján).
5. **A mutator változatlan** (web cookie+bearer; mobil ugyanaz secure-store-ból).
6. CI: `codegen` regenerál + `git diff --exit-code` (drift-gate) + Spectral lint (`codegen:lint`).

**Elfogadás:** futó backend → typed hookok + DTO-k; `apps/web` típus-helyesen importál; szándékos spec-változás megbukik a driften.
**Függőség:** 4.3–4.6 backend endpointok. **Blokkolja a web/mobil adat-kötött részeit (4.9–4.13 / M4.9–M4.13).**

---

# C. WEB (`apps/web`) — 4.9–4.13

> **Minden web-képernyő minta (Fázis 0-ban rögzült):** vékony `pages/*.tsx` + `features/<terület>/use-*.ts` hook + `mappers.ts` (DTO↔form) + `error-messages.ts`. UI **kizárólag** shadcn CLI-n át (`info`→`search`/`docs --base radix`→`add`→komponálás), a `src/components/ui/*` **kézzel nem szerkesztett**. Szerver-állapot a **B4 generált hookjaiból**; űrlap RHF + `@homeops/validation`; szöveg `@homeops/i18n`; jogosultság `can()`/`isFinancialVisible()` a `core`-ból.
>
> **A `features/<terület>/use-*.ts` + `mappers.ts` réteget úgy kell megírni, hogy platform-független legyen** (csak `api-client` + `validation` + `core`, semmi DOM) — így a mobil (M4.x) változtatás nélkül importálja. A DOM-specifikus rész kizárólag a `pages/*` + shadcn komponens.

## 4.9 — Háztartás + tagság + RBAC UI
- 🆕 `features/households/`: `use-create-household.ts`, `use-household-switch.ts`, `use-members.ts`, `use-invite.ts`, `use-member-role.ts`, `use-remove-member.ts`; `mappers.ts` (DTO↔form); `error-messages.ts`.
- 🆕 `pages/households.tsx`: tag-lista `Table`+`Badge` (role-pill); háztartás-létrehozás `Dialog`; meghívás `Dialog` (e-mail + role `Select`); role-kezelés `Select` (csak OWNER/ADMIN); tag-eltávolítás megerősítő `Dialog`.
- 🔧 Háztartás-váltó: a meglévő `nav-user.tsx`/sidebar seam bővítése valódi `useSwitchHousehold`-dal (a `memberships[0]` stub helyett lista + váltás új tokennel).
- ✅ Az `invite.tsx` (public accept) már létezik — a `use-invite`/accept hookra kötése.
- **Akció-kapuzás `can()`** (VIEWER read-only, gomb elrejtve).
- 🔧 shadcn komponensek hiányzók: `select`, `table` (`add`).
- *Elfogadás:* OWNER meghív/kezel; VIEWER csak olvas; meghívó-link Mailpitből aktivál (E2E).

## 4.10 — Teendők UI (egyszeri + RRULE)
- 🆕 `features/obligations/`: `use-obligations.ts` (lista+szűrő), `use-obligation-form.ts` (create/edit, `obligationSchema`), `use-obligation-actions.ts` (complete/skip), `mappers.ts`, `error-messages.ts`.
- 🆕 `pages/obligations.tsx`: lista `Table`+`Badge` (státusz `core/deriveStatus`-ból), szűrők; create/edit `Sheet` (cím, kategória, due date `Calendar`, felelős `Select`, becsült `Money`-mező egész minor + currency, lead-time); **ismétlés-szerkesztő + következő-előfordulás-előnézet `core/nextOccurrence`-szel**.
- 🔧 shadcn: `calendar`, `popover`, `sheet` (✅ van), `select`.
- 🔧 `App.tsx` route + sidebar (a `placeholder.tsx` cseréje).
- *Elfogadás:* `FREQ=MONTHLY;BYMONTHDAY=15` helyes előnézet; státusz-badge; CHILD csak a sajátját látja (szerver szűr).

## 4.11 — Kiadások + havi áttekintő UI
- 🆕 `features/expenses/`: `use-expenses.ts`, `use-expense-form.ts` (`expenseSchema`), `use-monthly-overview.ts`, `mappers.ts`, `error-messages.ts`.
- 🆕 `pages/expenses.tsx`: rögzítés (`Money` egész minor + pénznem `Select` + dátum `Calendar` + kategória + ismétlődő flag `Switch` + kapcsolt szolgáltatás seam); havi áttekintő shadcn **`Chart`**-tal (kategória-bontás + előző hó), **per-pénznem külön** (`core/groupByCurrency`+`formatMoney`).
- 🔧 shadcn: `chart`, `switch`.
- *Elfogadás:* összegek egész minorként a hálózaton; chart renderel; nincs cross-currency összeg.

## 4.12 — Dashboard UI (szerepkör-érzékeny widget-térkép)

| Widget | shadcn kompozíció | Láthatóság |
|---|---|---|
| Mai/közeli teendők (felelőssel) | `Card`+`Table`+`Badge`+`Avatar` | minden role |
| Lejárati idővonal | `Card`+`Separator`/`Badge`; `Empty` ha üres | minden role |
| Havi kiadás-összesítő | `Card`+`Chart` | **CHILD/VIEWER rejtve** |
| Esedékes befizetések (overdue piros) | `Card`+`Table`+`Badge variant=destructive` | **CHILD/VIEWER rejtve** |
| Aktív riasztások | `Card`+`Alert` lista | minden role (pénzügyi szűrve) |

- 🆕 `features/dashboard/use-dashboard.ts` (a `useGetDashboard` köré); widget-térkép `isFinancialVisible(role)`-lal kapuz **a szerver-szűrés mellett** (kétréteg).
- 🔧 `pages/dashboard.tsx` átírása (a Fázis 0 stub helyett a valódi widget-térkép).
- *Elfogadás:* MEMBER → minden widget; CHILD/VIEWER → pénzügyi widgetek hiányoznak (komponens-teszt + a szerver sem küldi); perf <300 ms.

## 4.13 — Értesítés-preferenciák UI
- 🆕 `features/notifications/use-notification-preferences.ts` (`notificationPreferenceSchema`).
- 🔧 `pages/settings.tsx` bővítés: csatorna/típus + előzetes-ablak (`lead_times`) űrlap; „aktív riasztások" nézet (Web Push a Fázis 3+).
- *Elfogadás:* preferenciák oda-vissza API-n; közelgő-esedékes e-mail a Mailpitben.

**Web tesztek:** komponens/hook unit (Vitest + Testing Library) a kapuzásra; E2E (Playwright) a §7 forgatókönyvvel.

---

# D. MOBIL (`apps/mobile`) — bootstrap + M4.9–M4.13

> **Az `apps/mobile` jelenleg csak váz (nincs `src/`).** A Fázis 1 mobil-ága először **bootstrapot** igényel, majd a webbel **azonos `features/<terület>/` hook+mapper réteget** használja (platform-független — lásd a C. szakasz keretét), **csak a prezentáció más** (gluestack-ui v4 + NativeWind RN, oldal-drawer).
>
> **Hook-megosztás stratégiája:** a `features/<terület>/use-*.ts` + `mappers.ts` réteget vagy (a) egy közös, platform-független helyre emeljük (pl. `packages/features` vagy `apps/web` re-export, amit a mobil importál), vagy (b) a mobil saját `features/`-ében ugyanazt a hármast (`api-client`+`validation`+`core`) köti. **Döntés a bootstrap során** — az ajánlott a közös `packages/features` csomag, hogy egyetlen forrás legyen.

## M0 — Mobil bootstrap 🆕 (a M4.9 előtt, egyszeri)
- Expo (Managed) projekt `apps/mobile`: `expo-router` (drawer), NativeWind (Tailwind v4, a `@homeops/tokens` `theme.css` CSS-változóit fogyasztja), gluestack-ui v4 telepítés.
- **House-style kit** (`src/components/`, a mobile design-system memória szerint): `Screen`/`ScreenTitle`, `SectionCard`, `IconBadge`, `EmptyState`, `FormField`, `FormAlert`, `QuickAction`, `AppIcon`, `AppDrawerContent` — gluestack `ui/` primitívek **fölött**, **csak szemantikus tokenek** (`bg-background`/`bg-card`/`bg-muted`, `text-foreground`/`text-muted-foreground`, `bg-primary`/`-foreground`, `bg-destructive`, `bg-success`/`warning`/`info`); a számozott gluestack-skála **tiltott**.
- Provider-stack: QueryClient (`@homeops/api-client`), i18next (`@homeops/i18n`), theme; **`token-store` secure-store seam** bekötése (a mutator már kész).
- **Auth-képernyők** (login/register/activate/2FA challenge) — a web auth-hookjainak (vagy a közös réteg) újrahasználata, RN UI-val; ez nem külön Fázis 1 tétel, de a M4.9 előfeltétele (belépés kell).
- Navigáció: **oldal-drawer** (`AppDrawerContent` household-lockup seam), nem bottom-tabs.

## M4.9 — Háztartás + tagság + RBAC (mobil)
- Hookok: **a 4.9 `features/households/` réteg újrahasználva** (platform-független).
- 🆕 Képernyők (`app/(app)/households/`): háztartás-lista `SectionCard` sorok + role-`IconBadge`; létrehozás/meghívás `Actionsheet` modal (`FormField` e-mail + role-picker `Actionsheet`); tag-lista `SectionCard` + role-pill; role-váltás `Actionsheet` (OWNER/ADMIN); üres állapot `EmptyState`.
- Háztartás-váltó az **app-drawer household-lockup seamjébe** köt (`AppDrawerContent`); a `switch` új access-tokent ad a token-store-ba.
- Akció-kapuzás `can()` (VIEWER read-only).
- *Elfogadás:* OWNER meghív/kezel; VIEWER csak olvas; meghívó **deep-link** (`homeops://invite/<token>` / universal link) → accept; háztartás-váltás új tokennel.

## M4.10 — Teendők (egyszeri + RRULE) (mobil)
- Hookok: **a 4.10 `features/obligations/` réteg újrahasználva.**
- 🆕 Képernyők: lista `SectionCard` + státusz-`IconBadge` (`core/deriveStatus` — azonos a webbel), szűrő `Actionsheet`; create/edit modal (cím, kategória, due date **natív date-picker**, felelős-picker, becsült `Money`, lead-time); **ismétlés-szerkesztő + következő-előfordulás-előnézet `core/nextOccurrence`-szel**; complete/skip swipe/gomb-akció.
- *Elfogadás:* `FREQ=MONTHLY;BYMONTHDAY=15` helyes előnézet; státusz-pill; CHILD csak a sajátját látja (szerver szűr).

## M4.11 — Kiadások + havi áttekintő (mobil)
- Hookok: **a 4.11 `features/expenses/` réteg újrahasználva.**
- 🆕 Képernyők: rögzítés modal (`Money` egész minor + pénznem-picker + dátum + kategória + ismétlődő `Switch` + kapcsolt szolgáltatás); havi áttekintő `SectionCard` kártyák kategória-bontással + előző hó delta, **per-pénznem külön** (`core/money`). Chart: RN-kompatibilis lib (`victory-native`/`react-native-svg`), de a **chart-adat-derivált a `core`-ból** — csak a render más.
- *Elfogadás:* egész minor a hálózaton; per-pénznem külön; nincs cross-currency összeg.

## M4.12 — Dashboard (szerepkör-érzékeny) (mobil)
- Hook: **a 4.12 `features/dashboard/use-dashboard.ts` újrahasználva.**
- 🆕 Widget-térkép `SectionCard`/`IconBadge`/`EmptyState` kompozícióval; havi-kiadás + esedékes-befizetés widget **CHILD/VIEWER-nél rejtve** (`isFinancialVisible` + a szerver sem küldi — kétréteg).
- *Elfogadás:* MEMBER → minden widget; CHILD/VIEWER → pénzügyi widgetek hiányoznak.

## M4.13 — Értesítés-preferenciák (mobil)
- Hook: **a 4.13 `features/notifications/use-notification-preferences.ts` újrahasználva.**
- 🆕 Settings-képernyő bővítés (csatorna/típus + előzetes-ablak `FormField`/`Switch`).
- A **push (Expo Notifications) a Fázis 3** — itt csak az `EMAIL`-preferencia UI; a push-csatorna seam a meglévő outbox-`channel` enumra épül (4.7), a worker-interfész nem változik.
- *Elfogadás:* preferenciák oda-vissza API-n.

---

# E. Migrációk és indexek (4.4-től)

| Migráció | Táblák | Index / kényszer | RLS |
|---|---|---|---|
| `obligations` (4.4) | obligations | **`(household_id, due_date, status)`**; status CHECK; currency CHECK | igen |
| `expenses` (4.5) | expenses | **`(household_id, occurred_on)`**; currency CHECK | igen |
| `audit_log` (4.8) | audit_log | `household_id` idx; **app-szerep UPDATE/DELETE REVOKE** (+ trigger) | igen |
| `notifications` (4.7) | notifications, notification_preferences | `dedup_key` UNIQUE; `(status, next_attempt_at)`; pref UNIQUE(user,household,type,channel) | igen |

**Minden migrációra kötelező:** `household_id` index + `ENABLE/FORCE ROW LEVEL SECURITY` + null-safe policy (`NULLIF(current_setting('app.current_household', true), '')::uuid`, a 4.3 `b1c2d3e4f5a6` minta); `alembic check` drift-mentes.

---

# F. Tesztelési mátrix (4.4-től)

- **Unit (pytest + Vitest):** `domain/` (recurrence/status/money — közös JSON fixture mindkét oldalon), `services/` magas lefedettség; `core`/`validation` Vitest + enum/permission-paritás.
- **Integráció (Testcontainers PG16, `homeops_app` nem-privilegizált szerep):** obligations / expenses / monthly_overview / dashboard (role-mátrix) / outbox (idempotencia + `SKIP LOCKED` + retry); **RLS negatív teszt** (`WHERE` nélkül 0 cross-tenant sor); EXPLAIN index-használat (expense + dashboard).
- **Security:** CHILD obligation-scope; RBAC role-mátrix minden új service-en; audit immutábilis; „titok sosem logban".
- **Contract:** OpenAPI-drift (`pnpm codegen && git diff --exit-code`) + Spectral.
- **E2E (Playwright, `https://homeops.localhost`):** register→aktiválás→login→háztartás→meghívó(Mailpit-link)→teendő(RRULE)→kiadás→dashboard(role-érzékeny)→scheduler→**1** e-mail a Mailpitben.

---

# G. Fázis 1 kilépési kritérium (a 4.4-től hátralévő része)

- [ ] Egyszeri + ismétlődő (RRULE) teendő felelőssel; complete→következő-előfordulás (4.4).
- [ ] Kiadás-rögzítés egész minorban; havi áttekintő per-pénznem, FX nélkül (4.5).
- [ ] Szerepkör-érzékeny dashboard (CHILD/VIEWER nem lát pénzügyet — szerver + kliens) (4.6).
- [ ] Audit-log érzékeny műveletekre, immutábilis (4.8).
- [ ] Nem-duplikált e-mail emlékeztető esedékesség előtt (outbox idempotencia, külön process) (4.7).
- [ ] B3 i18n HU/EN paritás; B4 codegen él, interim stubok cserélve.
- [ ] Web 4.9–4.13 képernyők a generált hookokra építve; minden üzleti döntés a `packages/*`-ban.
- [ ] Mobil bootstrap + M4.9–M4.13 a **közös** hook+mapper réteget használja, csak a prezentáció platform-specifikus.
- [ ] CI zöld: lint/typecheck/unit/integráció/contract(drift+Spectral)/deps/sast/i18n.

---

# H. Nyitott döntések / kockázatok

1. **Közös `features/` réteg helye** (M0): `packages/features` új csomag **vagy** web→mobil re-export. *Ajánlás: `packages/features` — egyetlen forrás, ESLint `no-restricted-imports` tiltja benne a DOM/RN-t.*
2. **`expenses.service_id` FK** a Fázis 2 `services` táblájára mutat — most nullable oszlop FK nélkül (vagy deferred FK), a Fázis 2 köti be. Jelezni a migrációban.
3. **Auth a generált codegen után** (B4): a 2FA challenge-flow miatt a hand-written `auth.ts`/`totp.ts` maradhat, ha a generált nem fedi tisztán — döntés a codegen-kimenet láttán.
4. **Worker ütemezés** (4.7): a worker poll-loop a scheduleren belül **vagy** önálló process — a `Scheduler` port mögött (Celery-csere később, döntés 10.6).
5. **Dashboard „aktív riasztások"** a 4.7 outboxra épül — ha a 4.7 még nincs kész a 4.6-kor, üres-lista seammel indul, és a 4.7 tölti fel.
