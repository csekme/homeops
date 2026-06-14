# HomeOps — Részletes végrehajtási terv

## 0. Kontextus

A `docs/specification.md` egy teljes termék- és architektúra-specifikációt ad a **HomeOps** háztartás-menedzsment SaaS-hoz (befizetések, okmányok, közüzem, dokumentumok, teendők; családi, több-felhasználós, multi-tenant). A repo jelenleg **greenfield**: csak a specifikáció, a dev-tanúsítvány váz (`certs/`), a shadcn skillek és a gitnexus index létezik — alkalmazás-kód nincs.

**Ennek a tervnek a célja:** a specifikációt konkrét, sorrendezett, végrehajtható lépésekké fordítani — fázisonként (spec §9: Fázis 0–4), minden fázis azonos mélységben, megnevezett fájlokkal/modulokkal, könyvtárakkal, parancsokkal és elfogadási kritériumokkal. A terv a spec architekturális döntéseit követi (réteges Flask, közös séma + RLS, OpenAPI-vezérelt kódgenerálás, monorepo web+mobil megosztással, envelope-titkosítás).

**Lezárt döntések (spec §10 + a tervezés során felmerült egyeztetések):**

| # | Kérdés | Döntés |
|---|---|---|
| 10.1 | Pénznem | **Soronkénti ISO-4217 pénznem** (ahogy a §6 ERD mutatja) + háztartás `default_currency`. Összesítők `GROUP BY currency`; nincs FX-átváltás MVP-ben. Multi-currency később nem igényel migrációt. |
| 10.2 | CHILD szerepkör mélysége | **Csak korlátozott nézet** MVP-ben (nincs gamifikált házimunka-lista). A séma/RBAC kész a CHILD-re; a gamifikáció későbbi additív modul. |
| 10.3 | Naptár-szinkron | **Elhalasztva**; saját idővonal elég. A `due_date`/`rrule` naptár-export-kész. |
| 10.4 | Mérőóra-modul | **Elhalasztva** az MVP után (önálló alrendszer). |
| 10.5 | Titokkezelés szintje | **MVP: pgcrypto + env-kulcs** egy `SecretCipher` interfész mögött; **KMS/Vault** a Fázis 4-ben drop-in adapterrel, hívási hely változtatása nélkül. |
| 10.6 | Ütemező | **APScheduler** (egy process) MVP-re egy `Scheduler` port mögött; **Celery beat + broker** a Fázis 3/4-ben, ha a worker-skálázás megköveteli. |
| 10.7 | Csomag-limitek | Konkrét limitek **elhalasztva** (üzleti döntés); a `Subscription`/`Plan` modell + központi entitlement-seam már a Fázis 1-ben elkészül „free" planre. |
| — | Cert fájlnév | A `certs/` jelenleg `localhost.crt/.key`; a spec nginx.conf-ja `homeops.localhost.pem` / `homeops.localhost-key.pem` (mkcert default). **Áttérünk `.pem`-re**, `certs/.gitignore` bővül `*.pem`-mel, a privát kulcs sosem kerül verziókövetésbe. |
| — | shadcn elhelyezés | shadcn **csak az `apps/web`-ben** él (DOM/Radix); a `packages/`-ben **nincs** `packages/ui` (a spec §5.8 az UI-t platformfüggőnek jelöli). A monorepo vázat kézzel állítjuk fel, a shadcn `init` az `apps/web`-en belül fut (nem `--monorepo`). |
| — | Backend elhelyezés | A Python backend a `backend/` könyvtárban (repo gyökér), elkülönítve a pnpm/Turborepo JS-workspace-től; a dev-proxy `host.docker.internal:8080`-on éri el. |

---

## 1. Tech stack és vezérelvek

**Backend:** Python 3.12, **uv** (függőség + venv), **APIFlask** (Pydantic-alapú, auto OpenAPI 3), **SQLAlchemy 2.x** + **Alembic**, **PostgreSQL 16**, **argon2-cffi** (Argon2id), **PyJWT**, **Flask-Limiter**, **APScheduler**, **structlog**, **cryptography** (AES-256-GCM), **ruff** (lint+format), **mypy** (strict a `domain`/`services` rétegen), **pytest** + **pytest-cov** + **Testcontainers**, **pip-audit**, **bandit**/**semgrep**.

**Frontend/monorepo:** **pnpm workspaces + Turborepo**, **TypeScript** (strict), **Vite + React + shadcn/ui** (preset `b27JkRsW`, Tailwind v4, Radix, lucide), **TanStack Query**, **React Router**, **react-hook-form + Zod**, **i18next** (HU default / EN), **orval** (OpenAPI→hookok+típusok), **Vitest + RTL + MSW**, **Playwright** (E2E), **Spectral** (OpenAPI lint).

**Mobil (Fázis 3):** **Expo (React Native)**, **NativeWind** (a `packages/tokens` témából), **Expo Router**, **expo-secure-store**, FCM/APNs.

**DevEx:** **docker-compose** (Postgres 16 + Mailpit + nginx), **single-origin HTTPS** `https://homeops.localhost` (mkcert), frontend (`:5173`) és backend (`:8080`) a host gépen.

**Vezérelvek (a spec §4/§5.3 alapján, az első naptól kötelező):**
- Vékony controller, vastag service, repository absztrakció (Dependency Inversion).
- Money soha nem float — egész `*_amount_minor` (bigint) + ISO-4217 `currency`.
- Strukturált log: `request_id` + `household_id` + `user_id`, **soha titok/PII**.
- Tenant-szűrés két rétegben: app-szintű `WHERE household_id` **ÉS** PostgreSQL RLS mint védőháló.
- DRY: paginálás, hibakezelés, entitlement-check, audit egy-egy központi helyen.

---

## 2. Cél monorepo-struktúra

```
homeops/
  apps/
    web/                 # React + Vite + shadcn/ui (Fázis 0–1)
    mobile/              # Expo / React Native (Fázis 3)
  packages/
    types/               # OpenAPI-ból generált DTO-k/enumok
    api-client/          # típusos kliens + TanStack Query hookok
    core/                # Money, RRULE, státusz-derivált, jogosultság-helper (tiszta TS)
    validation/          # Zod sémák (web + mobil közös)
    i18n/                # HU/EN fordítások + i18n konfig
    tokens/              # dizájn-tokenek (web Tailwind + mobil NativeWind közös forrás)
  backend/
    app/
      __init__.py        # create_app() factory
      config.py          # Dev/Test/Prod env-vezérelt konfig
      extensions.py      # db, migrate, jwt, scheduler singletonok
      api/               # APIFlask blueprintek (vékony controller)
      services/          # üzleti logika
      repositories/      # SQLAlchemy adatelérés + RLS session-scope
      domain/            # entitások, value object-ek, enumok
      security/          # auth, jwt, jelszó-hash, RBAC, secrets (SecretCipher)
      integrations/      # connector adapterek (gdrive/onedrive/webdav)
      notifications/     # outbox + scheduler + EmailSender SMTP-absztrakció
      tasks/             # háttér-jobok (scheduler/worker)
      db/                # Base, session, RLS wiring, modellek
    migrations/          # Alembic env.py + versions/
    tests/               # unit / integration / contract / security
    pyproject.toml       # uv projekt + ruff/mypy/pytest konfig
  reverse-proxy/
    nginx.conf           # single-origin HTTPS (spec §5.7)
  certs/                 # mkcert .pem-ek (gitignore-olt)
  docker-compose.yml     # Postgres + Mailpit + nginx
  orval.config.ts        # OpenAPI → types + api-client
  turbo.json             # build/test/codegen pipeline + cache
  pnpm-workspace.yaml
  package.json
  tsconfig.base.json
  .github/workflows/ci.yml
  docs/                  # specification.md, PLAN.md, devex.md
```

---

## 3. FÁZIS 0 — Alapozás (spec §9 „0. fázis")

**Cél:** `docker compose up` + `pnpm dev` + a host backend → a teljes dev-stack él a `https://homeops.localhost`-on, single-origin, valódi cookie-k, HMR a proxyn át; a factory bootol, migrációk futnak, RLS bekapcsolva; teljes regisztráció → aktiváló e-mail → login → refresh (rotáció + reuse-detekció) → logout működik; CI zöld.

### 3.0 Párhuzamos sávok
- **A sáv (backend):** 3.1 → 3.3 → 3.4 → 3.6 (RLS) → 3.5 (auth) → 3.8 (OpenAPI).
- **B sáv (monorepo/frontend):** 3.9 → 3.10 (megosztott csomagok) → 3.12 (web váz) → 3.13 (app-shell UI). Codegen (3.11) a backend OpenAPI-ra vár (interim stub addig).
- **C sáv (infra):** 3.2 (docker-compose/nginx/mkcert) → 3.7 (SMTP/Mailpit) → 3.14 (CI).

### Backend

**3.1 Projekt-váz és tooling**
- *Mit:* a `backend/` réteges csomagváz (lásd §2), `pyproject.toml` (uv: deps + ruff + mypy + pytest), `app/__init__.py` `create_app()` factory, `app/config.py` (Dev/Test/Prod), `app/extensions.py`.
- *create_app() felelőssége:* konfig betöltés `APP_ENV` szerint; extension-init (engine/session, JWT-mgr, APScheduler — a scheduler **csak a worker processben** indul, nem a web-workerben); blueprint-regisztráció; egységes JSON hiba-envelope (DRY); structlog konfig; `ProxyFix` (3.4).
- *Kulcsfájlok:* `backend/app/__init__.py`, `backend/app/config.py`, `backend/app/extensions.py`, `backend/pyproject.toml`.
- *Elfogadás:* `uv run flask --app app run` bootol; `GET /api/health` → `{"status":"ok"}`; `ruff check`, `mypy app`, `pytest` zöld üres suite-on; `pip-audit` tiszta.
- *Függőség:* nincs — első lépés.

**3.3 Adatbázis-mag, base modell, migrációk**
- *Mit:* `app/db/base.py` (SQLAlchemy 2.x `DeclarativeBase`, `TenantMixin` indexelt `household_id`-vel, `TimestampMixin`, UUID PK); `app/db/session.py` (engine + sessionmaker + per-request session életciklus, lásd 3.6); Alembic bekötve (autogenerate); első migráció: `users`, `households`, `roles`, `memberships`.
- *Money-szabály:* minden összeg `BigInteger *_amount_minor` + `String(3) currency`, `CHECK (currency ~ '^[A-Z]{3}$')`, soha nem float. Háztartás kap `default_currency`-t.
- *Elfogadás:* `alembic upgrade head` létrehozza a sémát; `alembic check` (autogen drift) tiszta; smoke-teszt user-t ír/olvas.
- *Függőség:* 3.1 után.

**3.4 Reverse-proxy tudatosság (ProxyFix)**
- *Mit:* WSGI app `ProxyFix(app, x_for=1, x_proto=1, x_host=1)` a factoryben → Flask megbízik az `X-Forwarded-Proto: https`-ben (nginx), így a generált aktiváló/meghívó URL-ek `https://homeops.localhost`-osak és a `Secure` cookie helyesen kerül ki.
- *Elfogadás:* proxyn át hívott abszolút-URL-t építő endpoint `https://`-t ad; refresh cookie `Secure`.
- *Függőség:* 3.1 után; a 3.5 cookie-tesztelés előtt.

**3.5 Auth — regisztráció, aktiválás, login, token-páros (spec §7.1)**
- **3.5a Jelszó + user-életciklus:** `app/security/passwords.py` Argon2id (`argon2-cffi`: `hash`/`verify`/`needs_rehash`, paraméterek konfigból, memória ≥ 64 MiB). User állapotok: `PENDING → ACTIVE` (+ `DISABLED`).
- **3.5b Aktiváló flow (§9 Fázis-0 explicit):** regisztrációkor egyszer használatos, lejáró aktiváló token (csak hash tárolva, `expires_at`), e-mail az SMTP-absztrakción (3.7) → Mailpit. `POST /api/auth/activate` aktiválja a usert. **Nem-ACTIVE user login-ja elutasítva.** Logika az `auth_service`-ben.
- **3.5c Access + refresh token:** Access JWT (PyJWT, 10–15 perc, HS256 env-kulcsból) a **login válasz body-ban** (web: memória, mobil: secure store); claims `sub`, `exp`, `iat`, `jti`, aktív `household_id` + role. Refresh opaque random (≥256 bit), **szerver oldalon SHA-256 hash-elve** `refresh_tokens` táblában (`family_id`, `prev_id`, `used_at`, `revoked_at`, `expires_at`, `ip`, `user_agent`); a weben `HttpOnly; Secure; SameSite=Strict` cookie a refresh-útra szűkítve.
- **3.5d Rotáció + reuse-detekció (§7.1):** minden refreshkor új token a családon belül, a régi `used`; már felhasznált/visszavont token újrahasználata → **az egész család visszavonása** + 401 + audit + metrika.
- **3.5e CSRF a refreshen (§7.1):** double-submit (nem-HttpOnly CSRF cookie + egyező `X-CSRF-Token` header) + `SameSite=Strict`.
- **3.5f Rate limit (§7.4):** Flask-Limiter a `/login`, `/register`, `/refresh`, `/activate` végpontokon (IP + account kulcs), generikus hibák (nincs user-enumeration).
- *Endpointok:* `POST /api/auth/{register,activate,login,refresh,logout}`, `GET /api/auth/me`.
- *Elfogadás:* aktiválás előtt login → 403; aktiváló e-mail a Mailpitben; refresh rotál; régi refresh újrajátszása → család visszavonva + 401; CSRF nélkül → 403.
- *Függőség:* 3.3 (users), 3.4 (cookie/HTTPS), 3.7 (e-mail). Az auth minden hitelesített funkciót blokkol.

**3.6 Multi-tenancy + RLS (spec §5.2, §7.2) — a dupla réteg**
- *DB-réteg:* minden tartalom-táblán `household_id` + index; migráció bekapcsolja: `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` + policy `USING (household_id = current_setting('app.current_household')::uuid) WITH CHECK (...)`. Az app **nem-superuser, nem-`BYPASSRLS`** szerepkörrel csatlakozik (a superuser megkerüli az RLS-t — klasszikus hiba); a migrációk külön privilegizált szereppel futnak.
- *Session-wiring:* `app/db/rls.py` minden tranzakció elején `SET LOCAL app.current_household = :hid` (és `app.current_user`) — a token claimből, sosem kliens-body-ból. „No-tenant" mód az auth/household-létrehozás nem-tenant tábláira.
- *App-réteg:* a repository-k továbbra is explicit `household_id`-re szűrnek (mélységi védelem).
- *Elfogadás (integráció, Testcontainers):* két háztartással, `app.current_household = A` mellett B sorai 0 db még a `WHERE` elhagyásával is; cross-tenant API-kérés → 404/403.
- *Függőség:* 3.3 után; az auth-tal (3.5) együtt fejlesztve. Minden tenant-adat funkciót blokkol.

**3.7 SMTP-absztrakció + Mailpit (spec §3.8, §5.7)**
- *Mit:* `app/notifications/email/` `Mailer`/`EmailSender` port + SMTP adapter; konfig választ: dev/test → Mailpit (`:1025`), prod → tranzakciós szolgáltató (Postmark/SES). Jinja HTML sablonok (aktiváló, meghívó), i18n szövegekkel.
- *Elfogadás:* aktiváló e-mail a Mailpitben, helyesen renderel; unit-teszt a mailer hívására; E2E-helper a linket a Mailpit REST API-ból olvassa.
- *Függőség:* a 3.5b előtt.

**3.8 OpenAPI szerződés-felület (spec §5.9)**
- *Mit:* APIFlask auto-generál OpenAPI 3-at a Pydantic sémákból; `GET /api/openapi.json`, Swagger UI `/api/docs`, ReDoc `/api/redoc`. **Prod:** a docs konfig-flaggel kikapcsolva vagy auth mögött (§7.4 security misconfiguration).
- *Elfogadás:* a spec tükrözi az auth-endpointokat; docs dev-ben elérhető, prod-konfigban 404/401; Spectral lint zöld.
- *Függőség:* folyamatosan bővül; az alapot az auth-endpointok adják.

### Monorepo / Frontend / Infra

**3.2 Dev-környezet: docker-compose + nginx single-origin HTTPS + Mailpit (spec §5.7)**
- *Mit:* `docker-compose.yml` (postgres:16-alpine, axllent/mailpit `:1025`/`:8025`, nginx:1.27-alpine) `extra_hosts: host.docker.internal:host-gateway`, portok `80:80`/`443:443`, `pgdata` volume — pontosan a spec §5.7 szerint. `reverse-proxy/nginx.conf` a spec **szó szerinti** konfigja (`upstream frontend`→`:5173`, `upstream backend`→`:8080`, 80→443 redirect, `location /api/`→backend `X-Forwarded-Proto https` + WS upgrade, `location /`→frontend + WS upgrade Vite HMR-hez, `client_max_body_size 16m`).
- *Tanúsítvány:* `mkcert -install` (egyszer/gép) majd `mkcert homeops.localhost` a `certs/`-ben → `homeops.localhost.pem` + `homeops.localhost-key.pem`; `certs/.gitignore` += `*.pem`; `certs/README.md` frissítés; `/etc/hosts`: `127.0.0.1 homeops.localhost`.
- *Dok:* rövid `docs/devex.md` (egyszeri setup + napi `docker compose up -d` / `pnpm dev` loop). `.env.example` (SMTP target, `VITE_*` publikus változók — titok nélkül).
- *Elfogadás:* mindhárom konténer egészséges; `https://homeops.localhost` betölt **megbízható** certtel (nincs böngésző-figyelmeztetés); `http://` → 301 HTTPS; Mailpit UI `:8025`.
- *Függőség:* app-kódtól független; a Vite (3.12) és backend (3.1) host-binding kell a végpont-teszthez.

**3.9 Root monorepo váz (pnpm + Turborepo)**
- *Mit:* `pnpm-workspace.yaml` (`apps/*`, `packages/*`), root `package.json` (`private`, `packageManager: pnpm`, `engines.node >= 22`, turbo-scriptek: `dev/build/lint/test/typecheck/codegen`), `turbo.json` pipeline (`build` `dependsOn ^build` outputs `dist/**`; `typecheck` cacheable; `codegen` `cache:false` outputs `src/generated/**`; `dev` `persistent`), `tsconfig.base.json` (strict, `moduleResolution: bundler`, workspace-aliasok), valódi root `.gitignore` (`node_modules`, `dist`, `.turbo`, `.env*` kivéve `.env.example`, `coverage`, `playwright-report`).
- *Elfogadás:* `pnpm install` hiba nélkül, egy `pnpm-lock.yaml`; `pnpm turbo run build --dry=json` helyes függőség-éleket listáz; `pnpm typecheck` lefut.
- *Függőség:* nincs (B sáv első lépése).

**3.10 Megosztott leaf-csomagok: `tokens`, `core`, `validation`, `i18n`**
- *Prezentáció-mentes, tiszta TS (nincs DOM/RN import).* Mind külön workspace-csomag (`type: module`, `exports`, saját `tsconfig` + Vitest).
- `packages/tokens`: dizájn-tokenek (szín OKLCH a `b27JkRsW` palettával, spacing, tipográfia, radius) typed objektumként + generált `theme.css` (`@theme` változók: `--primary`, `--background`, `--sidebar-*`, `--chart-*`), amit az `apps/web/src/index.css` importál.
- `packages/core`: **Money** (egész minor + ISO-4217, aritmetika csak azonos pénznemen, formázás, soha float); **RRULE** next-occurrence (`rrule` lib, spec §3.3); **státusz-derivált** (`UPCOMING→DUE→DONE/OVERDUE/SKIPPED`); **jogosultság-helperek** (`can(perms,"expense.read")`, `isFinancialVisible(role)` a dashboard pénzügyi blokk-elrejtéshez).
- `packages/validation`: Zod sémák (login, register, household, invite, obligation, expense, service); `core`-ból importál enumokat a drift ellen.
- `packages/i18n`: i18next + HU(default)/EN bundle-ök (`common/auth/dashboard/obligations/expenses/services`), typed `t`.
- *Elfogadás:* magas unit-lefedettség a `core`/`validation`-ön (Money kerekítés, RRULE BYMONTHDAY=31/DST, státusz-átmenetek, Zod fixture-ök); ESLint `no-restricted-imports` tiltja a DOM/RN importot; HU/EN kulcs-paritás.
- *Függőség:* `core` előbb, utána `validation`; `tokens`/`i18n` párhuzamos. 3.9 után.

**3.12 Web váz: Vite + React + TS + shadcn preset (spec §5.4)**
- *Mit (sorrend számít):* (1) `pnpm create vite apps/web --template react-ts`, workspace-be kötve. (2) **shadcn init az `apps/web`-en belül** (nem `--monorepo`): `npx shadcn@latest init --preset b27JkRsW --template vite` → Tailwind v4 + `b27JkRsW` téma, `cn`, `components.json` (base radix, lucide), `@/*` alias. (3) Konfig-ellenőrzés: `npx shadcn@latest info --json` (vite/radix/v4/lucide). (4) A web Tailwind-témát a `@homeops/tokens`-höz kötjük. (5) Workspace-deps: `@homeops/{core,validation,i18n,tokens}`, `@tanstack/react-query`, `react-router-dom`, `react-hook-form`, `@hookform/resolvers`, `zod`, `i18next`/`react-i18next`, `sonner`. (6) Vite proxy-konfig: `server.hmr = { clientPort: 443, protocol: 'wss', host: 'homeops.localhost' }`, `server.allowedHosts = ['homeops.localhost']`; API base relatív `/api` (same-origin, nincs CORS).
- *App-architektúra:* szerver-állapot **kizárólag TanStack Query**; **access token csak memóriában** (modul-scope holder, sosem localStorage), `Authorization: Bearer`; 401-re single-flight refresh a `/api/auth/refresh`-re (a böngésző küldi a httpOnly cookie-t), új token memóriába, retry; boot-kor néma refresh a token rehidratálásához; `<RequireAuth>` route-guard; React Router (publikus: `/login`, `/register`, `/activate/:token`, `/invite/:token`; védett shell: `/`, `/obligations`, `/expenses`, `/services`, `/documents`, `/settings`) + háztartás-váltó; i18n boot-tól; `sonner` toastok.
- *Elfogadás:* `pnpm --filter web dev` `:5173`-on; `https://homeops.localhost/` működő HMR-rel a proxyn át; `info --json` rendben; light/dark renderel; `pnpm --filter web build` → `dist/`; `pnpm typecheck` zöld.
- *Függőség:* 3.9 + 3.10; HMR-ellenőrzés 3.2.

**3.13 App-shell + navigáció (shadcn CLI workflow)**
- *Mit (minden UI a shadcn CLI-n át: `info` → `search`/`docs --base radix`/`view` → `add` → komponálás):* Sidebar shell (`Sidebar`, `Breadcrumb`, `Separator`, `ScrollArea`, `DropdownMenu` user-menü + háztartás-váltó, `Avatar`, HU/EN + dark-mode toggle); auth-oldalak (`Field`/`FieldGroup`/`FieldError` + RHF + Zod resolver a `packages/validation`-ból, `Card`, `Button`+`Spinner`, `Alert`); közös (`Empty`, `Skeleton`, `Badge`, `Table`, `Dialog`/`Sheet`/`AlertDialog`, `Tabs`).
- *Elfogadás:* hitelesített shell működő navigációval, háztartás-váltóval, nyelv/dark toggle-lel; minden űrlap `Field`/`FieldGroup` (nincs csupasz `Label`+`Input`); `src/components/ui/*` nincs kézzel szerkesztve.
- *Függőség:* 3.12.

**3.11 OpenAPI kódgenerálás: orval → `types` + `api-client` (spec §5.9)**
- *Kemény sorrend-kötés:* a generálás a backend `GET /api/openapi.json`-jára vár. Addig **kézzel írt interim stub** a `packages/api-client`-ben (azonos hook-alakok), majd csere a generáltra, amint a backend auth+household+obligation+expense endpointjai élnek.
- *Mit:* `orval.config.ts` (input: pinned `openapi.snapshot.json` a determinisztikus CI-hez; `pnpm codegen:fetch` frissíti a futó backendből; output `tags-split`, `client: react-query` → `packages/api-client/src/generated`, `schemas` → `packages/types/src/generated`; custom mutator: memória-token + `/api` base + `credentials: include`). Re-export csomagonként. Root scriptek: `codegen`, `codegen:fetch`, `codegen:lint`.
- *Elfogadás:* futó backend → `pnpm codegen` typed hookokat (`useGetObligations`, `useCreateExpense`) + DTO-kat ad; az `apps/web` típus-helyesen importál; szándékos, nem-regenerált spec-változás megbukik a CI drift-jén; `codegen:lint` (Spectral) zöld; az interim stub eltávolítva.
- *Függőség:* backend OpenAPI (3.8). A Fázis 1 adat-kötött részeit blokkolja (a statikus shellt nem).

### Keresztmetszeti (Fázis 0-tól)

**3.7-mail + 3.14 CI + biztonsági-mag** — lásd a §8 (Biztonság), §9 (Tesztelés), §10 (CI/CD) szekciókat; a Fázis 0-ban a minimum: lint+typecheck+unit+integráció(Testcontainers)+pip-audit+Spectral+OpenAPI-drift, structured logging, `/healthz`+`/readyz`, `SecretCipher` seam (pgcrypto+env).

**Fázis 0 kilépési kritérium:** factory bootol a HTTPS-proxy mögött; teljes register→activate→login→refresh(rotál+reuse-detektál)→logout; RLS integrációs teszttel bizonyítva; OpenAPI+docs él; web-shell renderel; CI zöld.

---

## 4. FÁZIS 1 — MVP mag (spec §9 „1. fázis")

**Cél:** háztartások, tagok, RBAC; teendők (egyszeri + ismétlődő RRULE) felelőssel; kiadások + havi áttekintő; szerepkör-érzékeny dashboard; e-mail értesítés ütemező + outbox révén.

### Backend

**4.1 Domain-réteg: value object-ek és enumok**
- `app/domain/`: `Money` (lásd `core` párja), enumok (`Role`, `ObligationStatus`, `BillingCycle`, `NotificationType/Channel/Status`, `ConnectorProvider`). Tiszta Python.
- *Elfogadás:* unit — Money elutasít floatot és cross-currency összeadást, minor/major oda-vissza; státusz-átmenetek dokumentálva.

**4.2 RBAC motor (spec §3.2, §7.2)**
- `Role` sorok seedelése (OWNER/ADMIN/MEMBER/VIEWER/CHILD) `permissions jsonb`-vel; finomszemcsés stringek (`expense.read`, `obligation.write`, `document.delete`, `connector.manage`, `member.invite`, `household.delete`, `billing.manage`). `app/security/rbac.py`: központi `require_permission(membership,"…")` **a service-rétegben** (minden művelet áthalad). CHILD/VIEWER nem kap `expense.read`-et.
- *Elfogadás:* security-tesztek — VIEWER write → 403; CHILD nem olvas kiadást; OWNER törölhet háztartást, ADMIN nem.

**4.3 Háztartások, tagságok, meghívók (spec §3.1)**
- `POST /api/households` → létrehozó OWNER lesz; háztartás-váltó endpoint → új access token a `household_id`/role contextszel; meghívók (egyszer használatos, lejáró token e-mailben, 3.7 mailer), `POST /api/invitations/accept`; több-háztartású tagság; soft delete + archív.
- *Elfogadás:* owner meghív → meghívó a Mailpitben → elfogadás → membership a kívánt role-lal; user két háztartásban vált; cross-tenant izoláció tart.

**4.4 Teendők, ismétlődő RRULE (spec §3.3)**
- `obligations` tábla (§6: `title, description, category, due_date, rrule, status, assignee_membership_id, estimated_amount_minor, currency, lead_time_days`); összetett index `(household_id, due_date, status)`. RRULE `python-dateutil rrulestr`; `app/domain/recurrence.py` `next_occurrence(rrule, after)` (a `core` RRULE-lal tükrözött); befejezéskor a következő előfordulás generálása; státusz-derivált; assignee; CRUD + complete/skip (RBAC+RLS).
- *Elfogadás:* unit RRULE `FREQ=YEARLY` és `FREQ=MONTHLY;BYMONTHDAY=15`; ismétlődő befejezése a következőt szüli; CHILD csak a rá kiosztottat látja.

**4.5 Kiadások + havi áttekintő (spec §3.4)**
- `expenses` tábla (§6: `amount_minor, currency, occurred_on, category, service_id?`); index `(household_id, occurred_on)`. Havi aggregáció: kategória-bontás, fix vs változó, hó/hó trend, **`GROUP BY currency, category`** (a pénznem-döntés szerint); `Money`-t ad csoportonként, nincs cross-currency összeg.
- *Elfogadás:* integráció — két hónap/kategória → helyes per-kategória/per-pénznem összeg + trend; sosem float.

**4.6 Dashboard endpoint (spec §3.7, §4 perf)**
- `GET /api/dashboard`: közelgő teendők (7–30 nap, felelőssel), lejárati idővonal, havi költés + kategória + előző hó delta, esedékes befizetések (overdue jelölve), aktív riasztások. **Szerepkör-érzékeny:** CHILD/VIEWER válasz kihagyja a pénzügyi blokkokat (szerver oldali RBAC-szűrés). A 4.4/4.5 összetett indexeire épít (<300 ms cél).
- *Elfogadás:* OWNER → minden widget; CHILD → pénzügyi blokkok hiányoznak (komponens-teszt); EXPLAIN az összetett indexet használja.

**4.7 Értesítések: outbox + scheduler + idempotens worker (spec §3.8, §5.6)**
- `notifications` = **outbox** (`type, channel, status, scheduled_for, dedup_key UNIQUE, payload jsonb, attempts, next_attempt_at, last_error`). **Scheduler** (`app/tasks/scheduler.py`, APScheduler): napi pásztázás a közelgő esedékességekre a lead-time szerint → idempotens outbox-insert (`ON CONFLICT (dedup_key) DO NOTHING`). **Worker** (`app/tasks/notification_worker.py`): `SELECT … FOR UPDATE SKIP LOCKED`, küldés a Mailerrel, `SENT`/`FAILED` + exponenciális backoff, kimerített retry → `dead` (riaszt). `Scheduler` port mögött (Celery-csere később). Esemény-típusok: közelgő lejárat, esedékes fizetés, overdue, meghívó, heti digest. Preferenciák: `notification_preference(user_id, household_id, type, channel, enabled, lead_times int[])`.
- *Elfogadás:* a scheduler kétszeri futása ugyanarra az ablakra **0 duplikált** outbox-sor; worker kétszeri futása **1** e-mail a Mailpitben; bukó küldés retry-zik, nem vész el. **A scheduler külön processben fut** (nem a web-workerben).

**4.8 Audit log alap (spec §7.5)**
- Append-only `audit_log` (`household_id, actor_user_id, action, target_type, target_id, metadata jsonb, ip, ua, created_at`); az app-szerep `UPDATE/DELETE`-je megvonva (grant + trigger); központi `audit(...)` helper a service-rétegből (role-változás, tag-változás, törlés). RLS-szkópolt.
- *Elfogadás:* role-váltás 1 immutábilis audit-sor; az app nem szerkeszt/töröl audit-sort.

### Frontend (Fázis 1 képernyők — minden UI shadcn CLI, szerver-állapot generált hookok, űrlapok RHF+`validation`, szöveg `i18n`)

**4.9 Háztartás + tagság + RBAC UI:** háztartás-létrehozás (`Dialog`+form), háztartás-váltó, tagok lista (`Table`+`Badge`), meghívás (`Dialog`, e-mail + role `Select`), role-kezelés OWNER/ADMIN-nak; akciók `core` jogosultság-helperrel kapuzva. *Elfogadás:* OWNER meghív/kezel, VIEWER csak olvas, meghívó-link a Mailpitből aktivál.

**4.10 Teendők UI (egyszeri + RRULE):** lista szűrőkkel (`Table`+`Badge`), create/edit `Sheet` (cím, kategória, due date `Calendar`, felelős `Select`, prioritás, becsült/tényleges `Money`, előzetes-figyelmeztetés, csatolt dokumentumok később); ismétlés-szerkesztő `core` RRULE-lal + következő-előfordulás-előnézet. *Elfogadás:* `FREQ=MONTHLY;BYMONTHDAY=15` helyes következő; státusz-badge UPCOMING/DUE/OVERDUE.

**4.11 Kiadások + havi áttekintő UI:** kiadás-rögzítés (`Money` egész minor, pénznem, dátum, kategória, ismétlődő flag, kapcsolt szolgáltatás); havi áttekintő shadcn `Chart`-tal (kategória-bontás + előző hó). *Elfogadás:* összegek egész minorként; chart renderel.

**4.12 Dashboard UI (szerepkör-érzékeny widget-térkép):**

| Widget (§3.7) | shadcn kompozíció | Láthatóság |
|---|---|---|
| Mai/közeli teendők (felelőssel) | `Card`+`Table`+`Badge`+`Avatar` | minden role |
| Lejárati idővonal | `Card`+`Separator`/`Badge` timeline; `Empty` ha üres | minden role |
| Havi kiadás-összesítő | `Card`+`Chart` | **CHILD/VIEWER rejtve** |
| Esedékes befizetések (overdue piros) | `Card`+`Table`+`Badge variant=destructive` | **CHILD/VIEWER rejtve** |
| Aktív riasztások | `Card`+`Alert` lista | minden role (pénzügyi szűrve) |

*Elfogadás:* MEMBER → minden widget; CHILD/VIEWER → pénzügyi widgetek hiányoznak (komponens-teszt); perf <300 ms.

**4.13 Értesítés-preferenciák UI (olvasó oldal):** csatorna/típus + előzetes-ablak űrlap; „aktív riasztások" nézet (Web Push a Fázis 3+). *Elfogadás:* preferenciák oda-vissza API-n; közelgő-esedékes e-mail a Mailpitben.

**Fázis 1 kilépési kritérium:** több-tagú, szerepkörös háztartás; egyszeri+ismétlődő teendő felelőssel; kiadás-rögzítés + helyes, szerepkör-érzékeny dashboard/havi áttekintő; nem-duplikált e-mail emlékeztető esedékesség előtt.

---

## 5. FÁZIS 2 — Dokumentumok és szolgáltatások (spec §9 „2. fázis")

**Cél:** szolgáltatás/előfizetés modul; első tárhely-konnektor (Google Drive) valódi envelope-titkosítással; dokumentum-referenciák.

**5.1 Titokkezelés: `SecretCipher` interfész + pgcrypto adapter (spec §7.3, §10.5)**
- `app/security/secrets/cipher.py`: `SecretCipher` port — `encrypt(plaintext)->(ciphertext, encrypted_dek)`, `decrypt(ciphertext, encrypted_dek)->plaintext`. Envelope: per-secret DEK, KEK-kel csomagolva (AES-256-GCM, per-secret nonce, `kek_id`/`key_version`). **MVP adapter:** pgcrypto + KEK env-ből (`KeyProvider` absztrakció). **Least privilege:** csak a worker process tartja a KEK-et / tud feloldani; az API nem. Feloldott titok sosem logba/válaszba/hibába (redakciós filter). **Kulcs-rotáció:** KEK-csere a DEK-ek újra-csomagolásával, a titkok újra-titkosítása nélkül.
- *Elfogadás:* round-trip; DB-dump csak ciphertext + wrapped DEK; az API nem old fel (negatív teszt); log-scan: plaintext sosem; KEK-rotáció re-wrap-el újra-titkosítás nélkül.

**5.2 Szolgáltatás / előfizetés modul (spec §3.5)**
- `services` tábla (§6: `provider_name, fee_amount_minor, currency, billing_cycle, contract_end, cancellation_deadline`); auto-generál ismétlődő kiadást + teendőt (4.4/4.5/4.7 újrahasználat); **felmondási-ablak** riasztás a scheduleren.
- *Elfogadás:* havi szolgáltatás → ismétlődő kiadás + megújítás-teendő; felmondási ablakba lépés → 1 outbox-értesítés.

**5.3 Első konnektor — Google Drive (spec §3.6, §8)**
- `connectors` tábla (§6: `provider, encrypted_secret bytea, encrypted_dek, status`). OAuth flow (§8): `init` (state + PKCE, minimális scope pl. `drive.file`) → consent → callback (state-validáció) → code-csere → refresh token **envelope-titkosítva** (5.1) tárolva; access token nem perzisztált (a worker on-demand mint). `app/integrations/gdrive.py` `StorageConnector` port mögött. **SSRF-védelem** (§7.4): allowlistolt provider-hosztok, validált URL. **Lecsatolás:** titkok törlése, referenciák „árva" jelzéssel.
- *Elfogadás:* OAuth round-trip titkosított tokent tárol (DB-ben csak ciphertext); a worker rövid életű URL-t old fel; lecsatolás töröl + árvít; az API nem old fel (least-privilege teszt).

**5.4 Dokumentumok (csak referencia) (spec §3.6, §1)**
- `documents` tábla (§6: `connector_id, external_ref, name, mime_type, size_bytes, checksum`) — **csak referencia + metaadat, soha bájt** (§1/§5.7 kis body-limit). Csatolás teendőhöz/szolgáltatáshoz; metaadat-keresés; on-demand rövid életű megnyitás (signed URL / friss token), sosem tartós nyilvános link.
- *Elfogadás:* Drive-fájl teendőhöz csatolva; keresés visszaadja; „megnyitás" rövid életű URL; HomeOps sosem tárol bájtot; tenant-izoláció tart.

**Fázis 2 kilépési kritérium:** szolgáltatások kiadást/teendőt generálnak felmondási-ablak riasztással; Drive-konnektor envelope-titkosított titkokat tárol és dokumentumokat referenciaként köt be, rövid életű URL-lel.

---

## 6. FÁZIS 3 — Mobil + push (spec §9 „3. fázis")

**Cél:** Expo (React Native) app a megosztott csomagok újrahasználatával; secure-store tokenek; FCM/APNs/Web Push az outbox új csatornájaként; csatornánkénti preferenciák.

**6.1 `apps/mobile` váz (Expo):** Expo app a workspace-be; `packages/{types,api-client,core,validation,i18n,tokens}` változatlanul (TanStack Query RN-ben fut, csak `fetch` kell). **Nincs shadcn** — RN UI **NativeWind**-del a `packages/tokens`-ből, hogy a vizuális nyelv egyezzen a webbel. Navigáció: Expo Router. *Elfogadás:* a mobil a generált klienst fogyasztja; tokenek NativeWinddel renderelnek.

**6.2 Auth/tárolás mobilon (spec §5.5):** access token **expo-secure-store**-ban (iOS Keychain / Android Keystore), nem async storage; api-client mutator mobil-variánsa (nincs cookie; bearer a secure store-ból). *Elfogadás:* token a secure store-ban; refresh működik bearer-rel.

**6.3 Push-csatorna (spec §3.8):** device-token regisztrációs endpoint a backenden; FCM (Android) + APNs (iOS) + Web Push; a push az outbox **új csatornája** (4.7 interfész). Csatorna/típus preferenciák UI mobilon + weben. *Elfogadás:* esedékesség előtt push érkezik; preferenciák gátolják a csatornát/típust; az outbox idempotencia push-ra is tart.

**6.4 Mobil tesztelés + codegen-drift:** a codegen-drift CI a mobil típusokat is fedi; RN komponens-tesztek a megosztott logika fölött. *Elfogadás:* mobil-build zöld, a drift-gate fogja a mobilt is.

**Fázis 3 kilépési kritérium:** működő mobil app a közös API-szerződéssel, secure-store tokennel, push-értesítéssel és csatornánkénti preferenciákkal.

---

## 7. FÁZIS 4 — SaaS érettség (spec §9 „4. fázis")

**Cél:** Subscription/Plan + entitlement-gate; további konnektorok (OneDrive, WebDAV); KMS/Vault titokkezelés; Stripe számlázás; önkiszolgáló GDPR export/törlés.

**7.1 Subscription / Plan + entitlement-gate (spec §3.9):** `subscriptions` (§6: `plan, status, valid_until`) + `Plan` definíciók (limitek `max_members`, `max_services`, `max_connectors`, `max_storage_refs`, feature-flagek pl. push). **Egyetlen központi `entitlement` ellenőrzés** (`app/services/entitlements.py`), amin minden korlátos művelet áthalad (DRY). Háztartás „free"-n indul; konkrét limitek üzleti döntés (§10.7). *Elfogadás:* `max_members` túllépés free-n → 402/403 egyetlen kódútról; limit-emelés azonnal felold.

**7.2 KMS/Vault titok-adapter (spec §7.3, §10.5):** a `SecretCipher`/`KeyProvider` KMS/Vault adapter a meglévő port mögött; KEK sosem hagyja el a KMS-t; konfig-csere, hívási hely nem változik. *Elfogadás:* staging-konfigban KMS-en át titkosít/old fel; DB-dump önmagában haszontalan; KEK-rotáció.

**7.3 További konnektorok (OneDrive, WebDAV) (spec §3.6, §8):** új `StorageConnector` adapterek; WebDAV user+jelszó ugyanazzal a `SecretCipher`-rel; SSRF-allowlist. *Elfogadás:* OneDrive OAuth + WebDAV basic-auth ugyanúgy titkosított titkot tárol és referenciát szolgál.

**7.4 Fizetés-integráció (Stripe) (spec §9 Fázis 4):** Stripe checkout + webhook → `Subscription` állapotfrissítés; számlázás OWNER-nek (`billing.manage`); idempotens webhook-feldolgozás (outbox-szerű). *Elfogadás:* plan-váltás Stripe-on át frissíti az entitlementet; webhook idempotens.

**7.5 GDPR önkiszolgáló export/törlés (spec §4, §3.1, §7.5):** per-háztartás export (JSON/zip metaadat — nem külső bájt); **soft-delete → purge** (retenciós ablak utáni hard-delete), titkok azonnali törlése, árva referenciák a lecsatolás-flow szerint; minden auditálva. *Elfogadás:* export minden háztartás-adatot ad; törlés RLS-szkópolt sorokat távolít + audit-nyom.

**Fázis 4 kilépési kritérium:** csomag-limitek központi entitlement-gate-tel; KMS-titokkezelés; több konnektor; Stripe-számlázás; önkiszolgáló GDPR.

---

## 8. Biztonság (keresztmetszeti, spec §7) — minden fázisban

- **Auth (§7.1):** Argon2id; rövid access JWT (memória/secure store); refresh hash-elve + rotáció + reuse-detekció (család-visszavonás); CSRF double-submit a refreshen; rate limit a login/refresh/activate-en. → Fázis 0.
- **Authorizáció (§7.2):** RBAC permission-check minden service-műveletre + PostgreSQL RLS (`FORCE`, nem-`BYPASSRLS` app-szerep) — dupla réteg. → Fázis 0–1.
- **Titokkezelés (§7.3):** envelope (DEK/KEK); MVP pgcrypto+env, KMS/Vault később; least privilege (csak worker old fel); titok sosem logba/válaszba; KEK-rotáció re-wrap-pel. → Fázis 2 (interfész), Fázis 4 (KMS).
- **OWASP Top 10 (§7.4) → konkrét kontrollok:** Broken Access Control = RBAC+RLS+cross-tenant tesztek; Crypto Failures = Argon2/AES-GCM/TLS/HSTS/secure cookie; Injection = paraméterezett ORM + Pydantic; Insecure Design = threat-model + felelősség-elv; Security Misconfig = secure header-ek (CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) + docs prod-ban auth mögött + titok nem a kódban; Vulnerable Components = pip-audit/pnpm audit + Renovate; Auth Failures = rotáció+reuse+rate limit; Integrity = lockfile + aláírt artefakt (cosign/SLSA) + OpenAPI-drift; Logging = strukturált + audit, sosem PII/titok; SSRF = connector allowlist + URL-validáció.
- **Audit log (§7.5):** immutábilis bejegyzés minden érzékeny műveletre (ki/mit/mikor/melyik háztartás). → Fázis 1-től.

---

## 9. Tesztelési stratégia (keresztmetszeti, spec §9) — minden fázisban

- **Unit** (`backend/tests/unit`, `packages/*` Vitest): domain + service magas lefedettség — Money, RRULE next-occurrence, státusz-derivált, RBAC, entitlement, Zod sémák. Coverage-gate a `domain`/`services` és `core`/`validation` felett.
- **Integráció** (`backend/tests/integration`, Testcontainers Postgres 16): migrációk, repository-k, **RLS-izoláció** (a negatív teszt elhagyja az app-szintű `WHERE`-t és bizonyítja, hogy az RLS blokkol), outbox idempotencia/`SKIP LOCKED`, dashboard query-terv (EXPLAIN).
- **API/contract** (CI): OpenAPI-drift (regenerál + `git diff --exit-code` a generált `types`/`api-client`-en) + Spectral lint; opcionálisan `schemathesis` fuzz.
- **E2E** (Playwright, `https://homeops.localhost`): register→aktiválás(**Mailpit REST API**-ból olvasott link)→login→háztartás→meghívó(Mailpit-link)→teendő→ütemezett értesítés(e-mail a Mailpitben); connector-bekötés (stub provider). Valódi cookie/HTTPS/SameSite a single-origin proxyn.
- **Biztonsági:** cross-tenant authz (A tagja nem éri B-t), reuse-detekció család-visszavonás, login rate-limit, „titok sosem logban", security-header-jelenlét, SSRF-allowlist.

---

## 10. CI/CD (keresztmetszeti, spec §9, §5.9, §7.4)

GitHub Actions (cache-elt pnpm + turbo + uv), párhuzamos job-ok:
1. `setup` — checkout, Python (uv) + Node (pnpm), cache; **`--frozen-lockfile`** (integritás).
2. `lint-backend` (`ruff check` + `ruff format --check`), `lint-frontend` (`eslint` + `prettier --check`).
3. `typecheck-backend` (`mypy app/`), `typecheck-frontend` (`tsc --noEmit`).
4. `test-unit` (pytest domain/service + vitest `core`/`validation`, coverage-gate).
5. `test-integration` (pytest + Testcontainers Postgres — RLS/repo/outbox).
6. `test-contract` — app indítás, `/api/openapi.json`, **orval regenerálás + `git diff --exit-code`** (drift-bukás) + **Spectral** lint.
7. `deps-scan` (`pip-audit` + `pnpm audit`, high/critical bukás; Renovate).
8. `sast` (`bandit` + `semgrep`, `eslint-plugin-security`, `gitleaks`; opcionálisan CodeQL).
9. `i18n-check` (HU/EN kulcs-paritás).
10. `test-e2e` (gated: PR-to-main/nightly) — Playwright a compose-stacken, Mailpit REST.
11. `build-artifacts` (main) — image build + **cosign aláírás** + SLSA provenance + registry push.
- *Merge-gate:* lint/typecheck/unit/integration/contract/deps/sast zöld kötelező.

---

## 11. Megfigyelhetőség és NFR (keresztmetszeti, spec §4)

- **Strukturált log** (`structlog` JSON): minden sor `request_id` + `household_id` + `user_id`, **soha titok/PII** (redakciós filter).
- **Metrikák** (Prometheus): latencia/hibaarány, outbox queue-mélység + küldés siker/bukás, reuse-detekció szám, authz-denial arány, scheduler-futás.
- **Health:** `/healthz` (liveness) + `/readyz` (DB+SMTP+Redis).
- **Riasztás:** reuse-detekció spike, outbox `dead`, authz-denial spike, scheduler-bukás.
- **Teljesítmény:** dashboard <~300 ms az összetett indexekre (`OBLIGATION(household_id,due_date,status)`, `EXPENSE(household_id,occurred_on)`, minden tartalom-táblán `household_id`); cache csak ha mérés indokolja.
- **Skálázhatóság:** állapotmentes API (JWT + Redis a megosztott rate-limit/revokációhoz) → vízszintes skálázás; a worker külön skálázik (`SKIP LOCKED` mellett több worker is biztonságos).
- **GDPR:** adatminimalizálás (referencia nem bájt, minimális OAuth scope), export, soft-delete→purge, auditált hozzáférés (önkiszolgáló a Fázis 4-ben, de a séma — `deleted_at`, audit-hook — a Fázis 0-tól támogatja).

---

## 12. Függőségek és kritikus út

```
F0: 3.1 váz ─┬─ 3.3 db/migr ─┬─ 3.5 auth ─┬─ 3.6 RLS ───── (kapu minden tenant-adathoz)
             │   3.4 ProxyFix┘   3.7 SMTP ─┘
3.2 compose ─┘   3.8 OpenAPI (nő)   3.14 CI (nő)
3.9 monorepo → 3.10 csomagok → 3.12 web-váz → 3.13 shell ;  3.11 codegen ⟵ 3.8 (addig stub)
F1: 4.1 domain → 4.2 RBAC → 4.3 háztartás/meghívó
    4.1 → 4.4 teendők(RRULE) ┐
    4.1 → 4.5 kiadások ───────┼→ 4.6 dashboard → (4.9–4.13 web)
    3.7+4.4 → 4.7 outbox/scheduler/worker ;  4.2+4.3 → 4.8 audit
F2: 5.1 SecretCipher(pgcrypto) → 5.3 gdrive → 5.4 dokumentumok ; 4.x → 5.2 szolgáltatások
F3: 6.1 mobil-váz → 6.2 secure-store → 6.3 push(outbox-csatorna) → 6.4 mobil-teszt
F4: 7.1 entitlement ; 5.1 → 7.2 KMS ; 5.3 → 7.3 konnektorok ; 7.4 Stripe ; 4.8 → 7.5 GDPR
```

**Kemény sorrend-kötések:** (1) **RLS (3.6) minden tenant-funkció előtt** — utólag minden repository-t át kéne dolgozni. (2) **SMTP (3.7) az aktiválás (3.5b) előtt.** (3) **`SecretCipher` interfész (5.1) bármely konnektor előtt** — connector sosem tárol plaintext titkot. (4) **Domain VO-k (4.1) a service-ek (4.4/4.5) előtt.** (5) **A scheduler külön processben** (nem a web-workerben — dupla-ütemezés veszély). (6) **Az app nem-`BYPASSRLS` Postgres-szereppel csatlakozik** (különben az RLS némán hatástalan). (7) **Codegen (3.11) a backend OpenAPI-ra vár** — szoros stub-szerződés a rework minimalizálására.

---

## 13. Verifikáció (end-to-end)

**Lokális stack:**
```
mkcert -install && (cd certs && mkcert homeops.localhost)   # egyszer
# /etc/hosts: 127.0.0.1 homeops.localhost
docker compose up -d                                          # db + mailpit + nginx
(cd backend && uv run flask --app app run -p 8080)            # host backend
pnpm --filter web dev                                         # host frontend :5173
```
- **Smoke:** `https://homeops.localhost/api/health` → 200 (megbízható cert); `https://homeops.localhost/` betölt HMR-rel.
- **Auth-flow:** regisztráció → aktiváló e-mail a Mailpit UI-ban (`:8025`) → aktiválás → login (refresh cookie `HttpOnly; Secure; SameSite`; access token a body-ban) → refresh rotál → régi refresh újrajátszása 401 + család visszavonva.
- **RLS:** integrációs teszt (Testcontainers) — `app.current_household=A` mellett B sorai 0 db a `WHERE` nélkül is.
- **MVP-folyamat:** háztartás → meghívó (Mailpit-link) → teendő (ismétlődő RRULE) → kiadás → dashboard (szerepkör-érzékeny: CHILD nem lát pénzügyet) → scheduler-futtatás → **1** e-mail a Mailpitben (kétszer futtatva sincs duplikátum).
- **Tesztek:** `pnpm turbo run lint typecheck test build`; `(cd backend && uv run pytest)`; OpenAPI-drift: `pnpm codegen && git diff --exit-code packages/types packages/api-client`; Spectral: `pnpm codegen:lint`; E2E: Playwright a register→aktiválás→…→értesítés folyamatra (Mailpit REST API-ból olvasott link).
- **Biztonság:** cross-tenant authz teszt (A tagja → B 404/403); „titok sosem logban" scan; security-header-jelenlét.

---

## 14. Kritikus létrehozandó fájlok (greenfield)

**Backend mag:**
- `backend/app/__init__.py` — `create_app()` factory (extension-init, ProxyFix, blueprint + hibakezelő).
- `backend/app/config.py` — Dev/Test/Prod (DB URL, JWT-kulcs, Argon2-paraméterek, SMTP-target, KEK, docs-flag).
- `backend/app/db/rls.py` — tenant session-wiring (`SET LOCAL app.current_household` tranzakciónként) — a dupla-rétegű izoláció sarokköve.
- `backend/app/security/refresh_tokens.py` — refresh issue/rotate/revoke + reuse-detekció.
- `backend/app/security/secrets/cipher.py` — `SecretCipher` envelope-interfész + pgcrypto adapter (KMS/Vault drop-in seam).
- `backend/app/notifications/` — outbox + scheduler + `EmailSender` SMTP-absztrakció.

**Infra / monorepo:**
- `docker-compose.yml` + `reverse-proxy/nginx.conf` — dev single-origin HTTPS stack (spec §5.7, szó szerint).
- `certs/` — `.pem`-ek (gitignore-olt) + `certs/.gitignore` (`*.pem`) + frissített `certs/README.md`.
- `pnpm-workspace.yaml`, `package.json`, `turbo.json`, `tsconfig.base.json` — monorepo váz.
- `apps/web/components.json` — a shadcn `init --preset b27JkRsW` hozza; minden web-UI ezen át.
- `orval.config.ts` + `.spectral.yaml` + `openapi.snapshot.json` — OpenAPI → types + api-client + drift-gate.
- `.github/workflows/ci.yml` — lint/typecheck/test/integráció/contract/deps/sast/e2e/aláírt-artefakt.
- `docs/devex.md` — egyszeri setup + napi loop.

**Forrás-igazság:** `docs/specification.md` (§5.2, §5.3, §5.7, §5.8, §5.9, §6, §7, §8, §9, §10).
