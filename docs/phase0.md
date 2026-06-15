
Mit építettem (a terv §3 szerinti sávokban)

Backend (backend/, A sáv 3.1–3.8)

- Réteges APIFlask create_app() factory, Dev/Test/Prod config, structlog (PII-redakció), egységes JSON hiba-envelope, ProxyFix.
- SQLAlchemy 2 modellek + Alembic migráció (alembic check drift-mentes); minden összeg *_amount_minor + ISO-4217 CHECK mintázat.
- Dupla tenant-izoláció: külön homeops_app (nem-superuser/nem-BYPASSRLS) app-szerep, FORCE RLS + app.current_household/app.bypass_tenant GUC-ok.
- Teljes auth: Argon2id, aktiváló e-mail, access JWT (body) + opaque refresh (SHA-256 hash), rotáció + reuse-detekció (család-visszavonás), CSRF double-submit, rate limit, SecretCipher envelope-seam.
OpenAPI 3.1 + Swagger/ReDoc (prod-ban kikapcsol), pinned openapi.snapshot.json.

Infra (C sáv 3.2/3.4/3.7) — docker-compose.yml (Postgres/Mailpit/nginx), reverse-proxy/nginx.conf, mkcert .pem cert, .env.example, docs/devex.md.

Monorepo + frontend (B sáv 3.9–3.13) — pnpm+Turborepo gyökér; core/validation/i18n/tokens/types/api-client csomagok; apps/web Vite+React+shadcn (b27JkRsW preset, téma a @homeops/tokens-ből), auth-oldalak (Field/RHF/Zod), app-shell (sidebar, HU/EN + dark toggle, háztartás-váltó), memória-token + single-flight refresh.

CI (3.14) — .github/workflows/ci.yml (lint/typecheck/unit/integráció/contract-drift/deps/sast/e2e-gate), .gitleaks.toml.

Ellenőrzések (lokálisan futtatva, mind zöld)

- https://homeops.localhost/api/health → 200 megbízható certtel, http→301; a frontend / HMR-rel kiszolgálva a proxyn át.
- Teljes register→activate→login→me→refresh(rotál)→reuse(401, család visszavonva)→logout — curl + integrációs teszt.
- RLS-izoláció integrációs teszttel bizonyítva (A mellett B sorai 0 db WHERE nélkül is).
- Backend: 22 teszt, ruff/mypy/bandit/pip-audit tiszta, alembic check drift-mentes.
- Frontend: turbo typecheck 7/7, test 4/4, build OK, Spectral 0 hiba.

→ A §3 kilépési kritérium minden pontja teljesül.

Amit közben elkaptam

Egy valódi biztonsági hiba: a refresh-reuse-detekciónál a család-visszavonás ugyanabban a session_scope-ban futott, amit a 401-et jelző kivétel visszagörgetett — így az ellopott (rotált) token érvényben maradt. Javítva: a visszavonás külön, commitált tranzakcióban fut.

Őszinte korlátok

- Playwright E2E: a terv gated-ként kezeli; a CI-ban most stub, a teljes folyamat-tesztet a Phase 1 képernyőkkel együtt érdemes megírni (a Mailpit REST + auth-flow alapok már működnek).
- A CI még nem futott GitHubon (nem pusholtam) — minden kaput lokálisan ellenőriztem.
- A web build egy >500 kB-os JS chunkot ad (csak tanács, Phase 0-ban így hagytam); a ui/sonner.tsx-et a projekt téma-hookjához igazítottuk (a shadcn alapból next-themes-t várt).
- pnpm audit a CI-ban jelenleg report-only, amíg a baseline triage-elve nincs.

Indítás

docs/devex.md szerint: docker compose up -d, majd host backend (uv run flask --app app run -p 8080) és frontend (pnpm --filter @homeops/web dev). A dev-folyamatokat és a stacket leállítottam, a working tree tiszta (semmit nem commitoltam — szólj, ha szeretnéd).


---

## Hibajavítások

1. Validációs hibák angolul → A @homeops/validation sémák fix angol üzeneteit eltávolítottam; a web most globális Zod errorMap-pel (apps/web/src/lib/zod-i18n.ts) lokalizál a hiba kódja alapján az új validation i18n névtérből (hu/en). Így a „Legalább 8 karakter szükséges" a beállított nyelven jelenik meg, és nyelvváltáskor is helyes.

2. Ugyanazzal az e-maillel újra-regisztráció nincs jelezve → Ez szándékos (spec §7.4 / terv §3.5f: user-enumeration elleni védelem). A backend mindig ugyanazt a generikus választ adja, akár létezik az e-mail, akár nem — így támadó nem tudja kitalálni, mely címek regisztráltak. Ezért jó így.

3. Regisztráció utáni angol üzenet → A register-oldal a backend válaszát írta ki nyersen. Most i18n kulcsot használ (t('register.checkEmail')), HU/EN-ül helyes.

4. Aktiválás beragad „folyamatban"-ra → Gyökérok: useMutation + useRef guard React StrictMode alatt — mount1 elindítja a kérést (siker → ACTIVE), StrictMode unmountol, mount2 friss idle observert kap, de a ref-guard blokkolja az újrafutást → a UI az idle (= „folyamatban") állapotot mutatja. Átírtam useQuery-re (token szerinti dedup + cache), ami StrictMode-biztos, és van rendes siker/hiba ág (features/auth/use-activation.ts).

5. Böngésző-refresh kiléptet → Gyökérok: a csrf_token cookie Path=/api/auth-tal ment ki, így a / oldalon a JS a document.cookie-ból nem olvasta → boot-refresh CSRF-fejléc nélkül → 403. Javítás: a CSRF cookie most Path=/ (a SPA bárhol olvassa), a refresh cookie marad Path=/api/auth (HttpOnly). Most a refresh után bejelentkezve maradsz.

## End-to-end teszt (Playwright)

Megírtam: apps/web/e2e/auth.spec.ts (+ mailpit.ts helper, playwright.config.ts, e2e/README.md). Két eset:

register → aktiváló e-mail (Mailpit REST) → aktiválás → login → reload után is bejelentkezve
aktiválás előtti login elutasítva
Indítás:


pnpm install
pnpm --filter @homeops/web test:e2e:install      # egyszer: Chromium letöltés
docker compose up -d                              # db + mailpit + nginx
(cd backend && uv run flask --app app run -p 8080)
pnpm --filter @homeops/web dev                    # :5173
pnpm --filter @homeops/web test:e2e
Lefuttattam a teljes stacken → 2 passed. Ez verifikálja a #4 és #5 javítást is.


## Sidebar (shadcn konvenció)
A kanonikus shadcn dashboard-mintára igazítottam: Sidebar collapsible="icon", brand a headerben SidebarMenuButton-ként, a user-/háztartás-menü a SidebarFooter-ben (NavUser-minta), SidebarRail (összecsukható él). A régi header-beli user-menu.tsx törölve.

## React-konvenció refaktor (a kérésed szerint)
Bevezettem egy apps/web/src/features/auth/ réteget:

DTO-mapping külön fájlban: mappers.ts (toLoginRequest, toRegisterRequest — camelCase ↔ snake_case).
Form + submit logika custom hookokban: use-login-form.ts, use-register-form.ts, use-activation.ts, error-messages.ts.
A page-ek vékonyak: login.tsx/register.tsx/activate.tsx már csak renderelnek + hookot hívnak.

## Verifikáció
pnpm turbo run typecheck test build → 12/12; web lint tiszta; backend ruff + 22 teszt zöld; Playwright 2/2. A dev-folyamatokat és a docker-stacket leállítottam.

Egy megjegyzés: a @homeops/validation user-facing mezőiről szándékosan levettem a szöveges üzeneteket (a kliens lokalizál kód alapján) — a nem-auth sémák (currency/date/stb.) egyelőre a zod default üzenetére esnek vissza, ezeket majd a Phase 1 képernyőknél érdemes ugyanígy kulcsozni.