# HomeOps — Mobil (React Native) Phase 0 végrehajtási terv

> Forrás-igazság: [`docs/PLAN.md`](./PLAN.md) §6 (Fázis 3 — mobil), §3 (web Phase 0),
> [`docs/phase0.md`](./phase0.md) (a kész web-állapot) és
> [`docs/domain/two-factor-auth.md`](./domain/two-factor-auth.md) (TOTP 2FA).
> Ez a dokumentum az `apps/mobile`-t a **web Phase 0-val (auth + shell + 2FA) azonos
> érettségi szintre** viszi a meglévő megosztott csomagok újrahasználásával.

---

## 0. Kontextus és cél

A `PLAN.md` a mobilt eredetileg a **Fázis 3**-ba sorolja (push, csatorna-preferenciák).
Ez a terv azonban **nem a Fázis 3 teljes scope-ját** célozza, hanem azt, hogy a mobil
app elérje **ugyanazt a „Phase 0" alapot, amit a web már tud** — push és értesítés
nélkül. Konkrétan a mobil érje el a [`phase0.md`](./phase0.md)-ben leírt és a
[`two-factor-auth.md`](./domain/two-factor-auth.md)-ben dokumentált funkcionális
paritást:

- teljes **regisztráció → aktiváló e-mail → aktiválás → login → refresh (rotáció +
  reuse-detekció) → logout** folyamat,
- **kétlépcsős hitelesítés (TOTP)**: login 2. lépés (challenge token), enrollment wizard
  (QR + manuális kulcs), recovery kódok, jelszós disable/regenerate,
- **app-shell**: hitelesített navigáció, **háztartás-váltó**, **HU/EN nyelvváltó**,
  **világos/sötét téma**, user-menü logout-tal,
- **i18n boot-tól**, **toast** visszajelzések, **splash** a boot-refresh alatt,
- a védett képernyők route-guarddal, session-lejárat kezelése.

**Vezérelv (a `PLAN.md` §5.8 + §6.1 szerint):** a mobil **maximálisan újrahasználja** a
`packages/*` rétegeket. Platform-specifikus csak az, ami muszáj: a UI (NativeWind a
`@homeops/tokens`-ből, **nincs shadcn**), a navigáció (Expo Router) és a
**token-perzisztencia** (`expo-secure-store`, cookie helyett).

A mobil-érett „Phase 0" **nem** tartalmaz: push/FCM/APNs-t, értesítés-preferenciákat,
naptárt, mérőórát, dokumentum/konnektor UI-t — ezek a Fázis 1–3 web-képernyőivel együtt
jönnek (PLAN §4–§6).

---

## 1. Scope

### Benne van (mobil Phase 0)
| Terület | Tartalom |
|---|---|
| Auth | register, activate (deep link / token), login, **2FA challenge**, refresh (silent boot + reaktív 401), logout |
| 2FA | enrollment (QR + base32), confirm, recovery kódok megjelenítése, disable/regenerate (jelszós step-up), status |
| Shell | tab/drawer navigáció, háztartás-váltó, nyelvváltó, téma-váltó, user-menü |
| Platform | Expo + Expo Router, NativeWind a tokensből, `expo-secure-store`, i18n, toast, splash |
| Minőség | typecheck/lint/unit a CI-ban, RN komponens-tesztek a megosztott logika fölött |

### Nincs benne (későbbi fázis)
Push/FCM/APNs (PLAN §6.3), értesítés-preferenciák, dashboard üzleti widgetjei az
adatkötéssel (Fázis 1), dokumentumok/konnektorok (Fázis 2), Stripe/entitlement (Fázis 4).
A dashboard a mobilon **statikus/placeholder** marad, ahogy a web Phase 0-ban is csak a
shell + a néhány alap widget kerete áll.

---

## 2. Lezárt architekturális döntések

| # | Kérdés | Döntés |
|---|---|---|
| M.1 | Keretrendszer | **Expo (managed) + Expo Router** (file-based routing), TypeScript strict. |
| M.2 | UI / stílus | **gluestack-ui v3** (NativeWind v4 alapokon), CLI-vel vendor-olt komponensek a `src/components/ui/`-ben. **Nincs shadcn** (DOM/Radix). A brand-szín (`primary`) a `@homeops/tokens` kék skálájára (`#2563eb`) van állítva a provider `config.ts`-ében. Vékony adapterek csak ott, ahol kell: `FormField` (RHF↔`FormControl`+`Input`) és `CodeInput` (szegmentált TOTP-mező). *(Eredeti döntés: saját NativeWind primitívek — felülírva gluestack-ui v3-ra.)* |
| M.3 | Access token | **Csak memóriában** (a meglévő `token-store` modul-scope holdere), `Authorization: Bearer`. Reload után silent refresh rehidratál. |
| M.4 | Refresh token | **`expo-secure-store`** (iOS Keychain / Android Keystore). Cookie **nincs** mobilon → a backend a refresh tokent a **body-ban** adja vissza mobil kliensnek (lásd §4 backend-delta). |
| M.5 | CSRF | A double-submit CSRF a **cookie-alapú** web-folyamat védelme. Bearer/body-alapú mobil-refresh **nem cookie-függő**, így nincs ambient-cookie CSRF-vektor → mobilon CSRF-header **nincs**. |
| M.6 | api-client | **Nem duplikáljuk.** A `@homeops/api-client`-et egy **injektálható session/refresh adapterrel** bővítjük; a web a jelenlegi (cookie) defaultot tartja, a mobil secure-store + body-refresh stratégiát injektál. A hookok (`useLogin`, `useMe`, `useTotp*`) **változatlanul** közösek. |
| M.7 | Megosztott csomagok | `@homeops/{core,validation,i18n,types}` **érintetlenül** újrahasznosul. `@homeops/tokens` **additívan** bővül egy RN-barát (hex/rgb) palettával (RN nem kezel megbízhatóan `oklch`-t). |
| M.8 | Dev-elérés | A device/emulátor **nem** éri a `homeops.localhost`-ot. Dev base URL `EXPO_PUBLIC_API_BASE` env-ből (host LAN IP, pl. `https://192.168.1.10`), a mkcert **root CA** a készülékre telepítve (lásd §8.4). |
| M.9 | Deep link | Custom scheme `homeops://` + (később) universal/app link. Aktiváló/meghívó tokenek `homeops://activate/:token`, `homeops://invite/:token`. Dev fallback: kézi token-beillesztés. |
| M.10 | Navigáció szerkezet | Publikus stack (`login`, `login/verify`, `register`, `activate`, `invite`) + védett shell (tabok: dashboard/obligations/expenses/services/documents/settings) — a web `App.tsx` route-térképének tükre. |

---

## 3. Újrahasználati térkép (mit reuse-olunk, mit adaptálunk, mi új)

### 3.1 Változatlanul újrahasznosul (nincs DOM/web-kötés)
- **`@homeops/core`** — Money, RRULE, státusz-derivált, `can()`/permission-helperek.
- **`@homeops/validation`** — Zod sémák (`loginSchema`, `registerSchema`, `activateSchema`,
  `totpChallengeSchema`, `totpConfirmSchema`, `totpDisableSchema`, …) + RHF resolver.
- **`@homeops/i18n`** — `i18nConfig`, `resources`, `supportedLngs`, `ns`. A `react-i18next`
  RN-ben ugyanúgy fut; a fordítási namespace-ek (`common`/`auth`/`settings`/…) **azonosak**.
- **`@homeops/types`** — összes DTO (`LoginResponse`, `TotpSetupResponse`, …).
- **`@homeops/api-client` hookjai** — `useLogin`, `useMe`, `useRegister`, `useActivate`,
  `useLogout`, `useTotp{Setup,Confirm,Disable,Status,Verify}`, `useRegenerateRecovery`.

### 3.2 Adaptálandó (kis, additív seam — a web-viselkedés a default)
- **`@homeops/api-client` transport-réteg** (`http.ts` + `token-store.ts`): injektálható
  refresh- és session-perzisztencia-stratégia (§5). A web semmit nem változik (default),
  a mobil egy adaptert regisztrál.
- **`@homeops/tokens`**: additív RN-paletta (hex/rgb) a NativeWind-témához (§6.2).

### 3.3 Új, mobil-specifikus (`apps/mobile`)
- Expo váz, Expo Router fa, NativeWind konfig.
- RN UI-primitívek (a web `components/ui/*` shadcn-megfelelői, NativeWinddel).
- Képernyők: auth (login/verify/register/activate/invite), shell, settings/security.
- Platform-providerek: i18n init, téma (color scheme), QueryClient, AuthBoot, session-expired.
- `expo-secure-store` token-perzisztencia adapter.

> **CLAUDE.md kötelezettség:** a `@homeops/api-client` és a backend `refresh`/`login`
> szimbólumainak szerkesztése előtt **`impact({target: "...", direction: "upstream"})`**
> futtatandó, és HIGH/CRITICAL kockázat esetén előzetes figyelmeztetés a felhasználónak;
> commit előtt **`detect_changes({scope: "compare", base_ref: "main"})`**.

---

## 4. Backend-delta (mobil refresh body-ban) — kötelező előfeltétel

A jelenlegi backend a refresh tokent **kizárólag HttpOnly cookie-ként** adja ki és a
`refresh` végpont a **cookie-ból** olvas + CSRF-header-t vár
([`backend/app/api/auth.py`](../backend/app/api/auth.py) `issue_session_response`,
`refresh`). Mobilon nincs cookie-tár → minimális, **additív** backend-változás kell, a
meglévő token-architektúra (rotáció + reuse-detekció + család-visszavonás) **érintetlenül**.

**Kliens-jelzés:** a mobil minden auth-kérésen `X-Client-Type: mobile` fejlécet küld.

| Végpont | Web (változatlan) | Mobil (új ág) |
|---|---|---|
| `POST /api/auth/login` | refresh+CSRF cookie, body: `access_token`+`user` | + body `refresh_token` (cookie elhagyható), CSRF **nem** kerül ki |
| `POST /api/auth/totp/verify` | mint login | mint login (body `refresh_token`) |
| `POST /api/auth/refresh` | cookie + `X-CSRF-Token` | refresh token a body-ból (`{"refresh_token": "..."}`) vagy `X-Refresh-Token` fejlécből; **CSRF-check kihagyva** ha nincs cookie-alapú kérés |
| `POST /api/auth/logout` | cookie alapján revokál | body `refresh_token` alapján revokál |

**Implementációs vázlat** (`backend/app/api/auth.py`, vékony controller — a service-réteg
nem változik):
- `issue_session_response(issued, *, mobile: bool)`: ha `mobile`, a `_attach_session_cookies`
  helyett (vagy mellett) a válasz-body kap `refresh_token` + `csrf_token` **nélkül** mezőt.
  Mobil ágon a `refresh_token` a body-ba kerül.
- `refresh()`: a `request.cookies.get(REFRESH_COOKIE)` mellett fallback a
  `request.json.get("refresh_token")` / `X-Refresh-Token` fejlécre; ha a kérés
  **cookie-mentes mobil** (nincs `csrf_token` cookie), a `verify_csrf` **kihagyva**
  (a bearer/body-refresh nem CSRF-érzékeny — nincs ambient hitelesítő).
- `LoginOut`/`RefreshOut` schema (`backend/app/api/schemas.py`): opcionális `refresh_token: str`.
- **OpenAPI/types drift:** a `refresh_token` opcionális mező megjelenik az OpenAPI-ban →
  `openapi.snapshot.json` frissítése + `@homeops/types` igazítása (`LoginResponse`,
  `RefreshResponse`).

**Biztonsági feltételek:**
- A `refresh_token` body-ban **csak `X-Client-Type: mobile`** kérésre kerül ki (a web
  továbbra is HttpOnly cookie-t kap — XSS-exfiltráció ellen a böngészőben).
- A refresh token mobilon **kizárólag `expo-secure-store`-ba** kerül (sosem AsyncStorage,
  sosem logba).
- A rotáció + reuse-detekció **ugyanaz**: rotált/visszavont token újrajátszása → család
  visszavonva + 401 (a `two-factor-auth.md` és `phase0.md` szerinti viselkedés).

**Elfogadás (backend):** integrációs teszt mobil-fejléccel: login → body `refresh_token`,
nincs `Set-Cookie`; refresh body-tokennel rotál; régi body-token újrajátszása → 401 +
család visszavonva; logout body-tokennel revokál. `alembic` érintetlen (nincs séma-változás).

---

## 5. `@homeops/api-client` — injektálható session/refresh seam

A cél: **egyetlen** api-client, két transport-stratégiával. A `configureApiClient` bővül,
a web defaultja a jelenlegi cookie-viselkedés marad.

### 5.1 `token-store.ts` bővítés
- Megmarad az in-memory access token + `exp`-alapú proaktív lejárat + `setOnSessionExpired`.
- **Új:** opcionális **session-persistence adapter**:
  ```ts
  export interface SessionPersistence {
    loadRefreshToken(): Promise<string | null>;
    saveRefreshToken(token: string | null): Promise<void>;
  }
  export function setSessionPersistence(p: SessionPersistence | null): void;
  ```
  A web nem regisztrál adaptert (cookie tárol) → no-op. A mobil az `expo-secure-store`
  adaptert regisztrálja.
- A `setAccessToken` mellé egy `setSession({ access, refresh })` belépés: az access
  memóriába, a refresh (ha van persistence adapter) a secure store-ba.
- A `atob`-alapú JWT-exp olvasás Hermesen működik (RN ≥ 0.74); ha a cél-runtime nem adja,
  kis base64-fallback. (A `Date.now()` RN-ben elérhető — a token-store-ban marad.)

### 5.2 `http.ts` bővítés (a kulcs-seam)
- `configureApiClient` bővül:
  ```ts
  configureApiClient({
    baseUrl,
    credentials,        // web: 'include' (default); mobil: 'omit'
    refreshStrategy,    // 'cookie' (default) | 'body'
    extraHeaders,       // mobil: { 'X-Client-Type': 'mobile' }
  });
  ```
- `refreshAccessToken()` elágazik:
  - **cookie** (web, default): a jelenlegi viselkedés — `credentials: 'include'` +
    `X-CSRF-Token` a `document.cookie`-ból.
  - **body** (mobil): a `loadRefreshToken()`-ből vett tokent küldi
    `POST /auth/refresh` body-ban; siker → `setSession({ access, refresh })`
    (új refresh perzisztálva); bukás → `clearAccessToken()` + `saveRefreshToken(null)`.
- A `readCookie`/`document` hivatkozások **csak a cookie-ágon** futnak (RN-ben nincs
  `document`; a body-ág sosem éri el).
- `apiFetch`: a `credentials` és `extraHeaders` a konfigból; minden más változatlan
  (proaktív + reaktív 401-refresh, single-flight).

### 5.3 `auth.ts` / `totp.ts` hookok
- `login()` / `totpVerify()`: a `result.access_token` mellett, ha jött `result.refresh_token`,
  `setSession({ access, refresh })` (mobilon perzisztál; weben a refresh undefined → no-op).
  **Web-viselkedés nem változik** (a backend webnek nem ad `refresh_token`-t body-ban).
- `logout()`: mobilon a `loadRefreshToken()` tokent küldi a body-ban, majd
  `saveRefreshToken(null)`.

**Elfogadás (api-client):** a meglévő web Vitest-ek (`http.test.ts`) zöldek maradnak
(default = cookie); új unit a body-stratégiára (mock persistence: login perzisztál,
refresh rotál+perzisztál, session-expired töröl).

---

## 6. `apps/mobile` — váz, sávok, lépések

### Sávok (a web Phase 0 A/B/C mintájára)
- **M sáv (váz/platform):** M0 → M1 → M2 (a workspace + Expo + NativeWind + providerek).
- **S sáv (megosztott seam):** S1 (api-client ref0r) + S2 (backend-delta) — a web nem törhet el.
- **U sáv (UI/képernyők):** U1 (auth) → U2 (shell) → U3 (settings/security).
- **Q sáv (minőség/CI):** Q1 a teljes szakaszon át.

---

### M0 — Workspace-bekötés és Expo váz
- **Mit:** `apps/mobile` Expo app (`npx create-expo-app@latest apps/mobile -t expo-template-blank-typescript`),
  workspace-be kötve (a `pnpm-workspace.yaml` `apps/*` már fedi). `app.json`/`app.config.ts`
  (`scheme: "homeops"`, név, ikon-placeholder). `metro.config.js` **monorepo-aware**
  (watchFolders = repo gyökér, `nodeModulesPaths`, `disableHierarchicalLookup`), hogy a
  `@homeops/*` workspace-csomagokat feloldja.
- **Kulcsfájlok:** `apps/mobile/package.json` (`@homeops/{core,validation,i18n,types,tokens,api-client}`
  workspace-deps, `expo`, `expo-router`, `expo-secure-store`, `expo-linking`,
  `nativewind`, `@tanstack/react-query`, `react-hook-form`, `@hookform/resolvers`,
  `zod`, `i18next`, `react-i18next`, `react-native-qrcode-svg`, toast lib pl. `burnt`
  vagy `sonner-native`), `apps/mobile/metro.config.js`, `apps/mobile/tsconfig.json`
  (extends `tsconfig.base.json`, `@/*` alias).
- **Elfogadás:** `pnpm --filter @homeops/mobile start` (Expo) elindul; a `@homeops/core`
  importja feloldódik; `pnpm typecheck` a mobil csomagot is fedi.
- **Függőség:** 3.9 monorepo váz (kész). S1-től független.

### M1 — NativeWind + téma a tokensből
- **Mit:** NativeWind v4 init: `tailwind.config.js` a `@homeops/tokens` palettájából
  generált `theme.extend.colors`/`spacing`/`borderRadius`; `global.css` (`@tailwind`
  direktívák + a tokens `@theme` változók RN-kompatibilis része); `babel.config.js`
  (`nativewind/babel`); `nativewind-env.d.ts`. **Sötét mód:** NativeWind `dark:` +
  `useColorScheme()` (Appearance API) — a web `class`-toggle helyett a RN color scheme.
- **Tokens additív bővítés (`packages/tokens`):** RN nem kezel megbízhatóan `oklch`-t →
  a meglévő `colors` (oklch) mellé egy **derivált hex/rgb paletta** (light + dark),
  ugyanabból a forrásból. Pl. `export const colorsRgb = { light: {...}, dark: {...} }`.
  Egyetlen igazságforrás marad; a web továbbra is a `theme.css` oklch-t használja.
- **Elfogadás:** egy próba-képernyő `bg-background`/`text-foreground`/`text-primary`
  helyesen renderel light és dark alatt is; a téma a tokensből jön (nincs hardcode szín).
- **Függőség:** M0.

### M2 — Platform-providerek és belépési pont
- **Mit (a web `main.tsx` + `lib/*` RN-megfelelői):**
  - `apps/mobile/app/_layout.tsx` (Expo Router root): providerek kompozíciója —
    `ThemeProvider` (RN), `QueryClientProvider` (a web `lib/query.ts` `queryClient`
    konfig **újrahasznosítható**: ugyanaz a `QueryClient` opció), `AuthBootProvider` (RN),
    `Toaster`, `Suspense`/Splash.
  - `apps/mobile/src/lib/i18n.ts`: `react-i18next` init a `@homeops/i18n` configból; a
    nyelv-perzisztencia `expo-secure-store` **vagy** `AsyncStorage` (nem titok → AsyncStorage
    is OK), boot-kor a mentett nyelv betöltése. (A web `localStorage` helyett.)
  - `apps/mobile/src/lib/theme.tsx`: téma-context (`light|dark|system`), perzisztálás,
    `Appearance`/`useColorScheme` követés. (A web `theme.tsx` logikájának RN-portja.)
  - `apps/mobile/src/lib/auth.tsx`: `AuthBootProvider` — boot-kor `refreshAccessToken()`
    (body-stratégia: a secure-store refresh tokenből rehidratál), amíg fut → splash.
  - `apps/mobile/src/lib/api.ts`: `configureApiClient({ baseUrl: EXPO_PUBLIC_API_BASE,
    credentials: 'omit', refreshStrategy: 'body', extraHeaders: { 'X-Client-Type': 'mobile' } })`
    + `setSessionPersistence(secureStoreAdapter)` + `setOnSessionExpired(...)` (cache-törlés
    + redirect a login route-ra + toast, ha `wasAuthenticated`).
  - `apps/mobile/src/lib/secure-store.ts`: `SessionPersistence` adapter `expo-secure-store`-ral
    (`getItemAsync`/`setItemAsync`/`deleteItemAsync`, kulcs `homeops.refresh`).
- **Elfogadás:** hidegindításkor splash → ha van érvényes refresh a secure store-ban,
  silent refresh rehidratál és a védett shell töltődik; ha nincs/lejárt → login.
- **Függőség:** M1 + S1 (api-client seam). Backend-delta (S2) kell az élő refreshhez.

---

### S1 — api-client seam refaktor
Lásd **§5**. Web-regresszió tilos (a `http.test.ts` zöld marad).
- **Elfogadás:** web build + `http.test.ts` zöld; új body-stratégia unit zöld;
  `detect_changes` csak az api-client érintett szimbólumait jelzi.
- **Függőség:** nincs (előbb mehet, mint M2).

### S2 — backend-delta
Lásd **§4**.
- **Elfogadás:** §4 backend integrációs teszt zöld; OpenAPI-drift kezelve
  (`openapi.snapshot.json` + `@homeops/types` frissítve, `pnpm codegen:lint` zöld);
  web auth-flow **változatlan** (cookie ág).
- **Függőség:** `impact()` a `refresh`/`login`/`logout` szimbólumokra **kötelező** előtte.

---

### U1 — Auth képernyők
A web `pages/{login,login-verify,register,activate,invite}.tsx` +
`features/auth/{use-login-form,use-register-form,use-activation,mappers,error-messages}.ts`
**logikája újrahasznosul** (a hookok api-client + validation alapúak); csak a megjelenítés
RN. A `react-router-dom` `useNavigate`/`state` → **Expo Router** `useRouter`/
`router.push({ pathname, params })` és `useLocalSearchParams`.

- **`app/(auth)/login.tsx`** — e-mail/jelszó `Field` (RHF + `loginSchema`), submit
  `useLogin`. `mfa_required` esetén navigálás `login/verify`-re a challenge tokennel
  **router state-ben** (nem URL, nem secure store — illékony, mint a weben).
- **`app/(auth)/login/verify.tsx`** — `totpChallengeSchema` (6 jegyű kód vagy recovery),
  `useTotpVerify`; siker → shell. Reload/visszalépés → vissza a login-ra (a challenge
  token elveszik). OTP beviteli mező RN-ben (pl. `react-native-otp` vagy saját 6-cellás).
- **`app/(auth)/register.tsx`** — `registerSchema`, `useRegister`; siker → „nézd meg az
  e-mailed" üzenet (`t('register.checkEmail')`).
- **`app/(auth)/activate.tsx`** — token a deep linkből (`useLocalSearchParams`) **vagy**
  kézi beillesztés (dev fallback, §8.5); `useActivate`. A web StrictMode-gotcha (useQuery
  dedup) RN-ben kevésbé éles, de a token-szerinti dedup mintát megtartjuk.
- **`app/(auth)/invite.tsx`** — meghívó token (Phase 0-ban placeholder/elfogadás-váz, a
  household-flow a Fázis 1-ben teljesedik ki — a webhez igazítva).
- **i18n:** az `auth` + `settings.twofactor.challenge` namespace-ek **változatlanul** jók.
- **Elfogadás:** register → (Mailpit e-mail) → activate (token) → login → 2FA-s fióknál
  verify → shell; aktiválás előtti login → 403 üzenet; rossz 2FA kód → generikus 401 üzenet.
- **Függőség:** M2.

### U2 — App-shell + navigáció
A web `components/{app-shell,app-sidebar,nav-user,language-toggle,theme-toggle,require-auth,splash}.tsx`
megfelelői RN-ben (Expo Router tab/drawer).
- **`app/(app)/_layout.tsx`** — **RequireAuth**: `useMe` alapján, ha nincs session →
  `<Redirect href="/login" />`; egyébként tab/drawer navigátor a `nav.*` kulcsokkal
  (dashboard/obligations/expenses/services/documents/settings).
- **Háztartás-váltó:** a `useMe().memberships` listából (a web `nav-user`/sidebar mintája);
  Phase 0-ban a váltó **UI + kiválasztás** áll, az aktív háztartás-context a Fázis 1
  háztartás-endpointjaival köt be élesen (a webhez igazítva, ahol a memberships még `[]`).
- **Nyelv- és téma-váltó:** a `lib/i18n` + `lib/theme` context-jeire kötve (header/menü).
- **User-menü + logout:** `useLogout` → cache-törlés + secure-store refresh törlés →
  login route.
- **`app/(app)/index.tsx` (dashboard):** placeholder (mint a web Phase 0), a widgetek a
  Fázis 1-ben.
- **Elfogadás:** hitelesített shell működő navigációval, háztartás-választóval, HU/EN +
  dark toggle-lel; logout után login-ra dob; session-lejárat (refresh bukás) → toast +
  login.
- **Függőség:** U1.

### U3 — Settings → Security (2FA) képernyő
A web `pages/settings.tsx` + `features/security/*` RN-portja. A hookok
(`useTotpStatus/Setup/Confirm/Disable/Status`, `useRegenerateRecovery`) **újrahasznosulnak**.
- **`app/(app)/settings.tsx`** — fülek: profil (placeholder) + **Biztonság**.
- **Biztonság kártya:** állapot-badge (`status.enabled`, `recovery_codes_remaining`),
  Enable/Disable/Regenerate gombok (`settings.security.*` kulcsok).
- **Enrollment wizard (modal/sheet):** `useTotpSetup` → `provisioning_uri` QR-ként
  (**`react-native-qrcode-svg`** a web `qrcode.react` helyett) + base32 másolható;
  6 jegyű kód `useTotpConfirm`; siker → **recovery kódok** egyszeri megjelenítése
  (másolás/megosztás Share API + „elmentettem"). A web `useTotpConfirm`-gotcha (status-query
  **nem** invalidálódik confirmkor, hogy a dialog ne unmountoljon) **megtartandó** — a
  status frissítés a wizard bezárásakor (`reset`).
- **Disable/Regenerate:** jelszós step-up dialog (`totpDisableSchema`), `useTotpDisable`/
  `useRegenerateRecovery`.
- **i18n:** a `settings` namespace **változatlanul** jó.
- **Elfogadás:** enable → QR + manuális kulcs → confirm → 10 recovery kód egyszer →
  status „Enabled"; disable rossz jelszóval → hiba, jó jelszóval → „Disabled"; regenerate
  jelszóval → új kódok, régiek érvénytelenek.
- **Függőség:** U2.

---

### Q1 — Minőség / CI (a teljes szakaszon át)
- **Typecheck/lint:** `apps/mobile` bekötve a turbo `typecheck`/`lint` pipeline-ba
  (`tsconfig` extends, ESLint flat config kiterjesztve RN-re — `eslint-plugin-react-native`
  vagy az `expo` lint preset). A `no-restricted-imports` szabály a `packages/*`-ban
  továbbra is tiltja a DOM/RN importot (a megosztott rétegek platform-tiszták maradnak).
- **Unit:** a megosztott `core`/`validation`/`i18n` Vitest-ek fedik a logikát; RN
  komponens-teszt (`@testing-library/react-native` + Jest/Expo preset) néhány kulcs-képernyőre
  (login submit, 2FA verify ág, household-váltó render).
- **api-client:** §5.3 body-stratégia unit (mock secure-store persistence).
- **CI (`.github/workflows/ci.yml` bővítés):** mobil `typecheck` + `lint` + RN unit job;
  a meglévő OpenAPI-drift gate a `@homeops/types` mobil-érintettségét is fedi. **EAS build
  gated** (mint a web Playwright: nem merge-blokkoló Phase 0-ban).
- **Elfogadás:** `pnpm turbo run lint typecheck test` zöld a mobillal együtt; web
  pipeline-ok változatlanul zöldek.

---

## 7. Mobil → backend kompatibilitási mátrix

| Web-mechanizmus (Phase 0) | Mobil-megfelelő |
|---|---|
| access token memóriában | **azonos** (`token-store`) |
| refresh HttpOnly cookie | **`expo-secure-store`** + body-refresh (§4–§5) |
| CSRF double-submit | **nincs** (bearer/body nem cookie-függő, §M.5) |
| boot silent refresh (cookie) | boot silent refresh (secure-store token) |
| 401 → single-flight refresh → retry | **azonos** (közös `http.ts`) |
| session-expired → redirect /login + toast | **azonos** seam (`setOnSessionExpired`) |
| reuse-detekció → család visszavonva + 401 | **azonos** (backend változatlan logika) |
| aktiváló/meghívó link (web URL) | deep link `homeops://` + dev kézi token (§8.5) |
| shadcn UI | **gluestack-ui v3** (NativeWind), brand-szín a `@homeops/tokens`-ből |
| i18n (localStorage nyelv) | i18n (AsyncStorage/secure-store nyelv) |
| téma (`dark` class + localStorage) | téma (`useColorScheme` + perzisztált pref) |

---

## 8. Biztonság és dev-üzemeltetés

- **8.1 Token-tárolás:** access **csak memóriában**; refresh **csak `expo-secure-store`**
  (Keychain/Keystore), sosem AsyncStorage, sosem log. A refresh body-token csak
  `X-Client-Type: mobile` kérésre kerül ki (web marad HttpOnly cookie).
- **8.2 Challenge token (2FA):** csak router-state-ben (illékony), sosem secure store /
  URL. Reload → elveszik → vissza loginra (a web-viselkedés tükre).
- **8.3 Log-higiénia:** a structlog PII/titok-redakció backend-oldalon áll; mobil-oldalon
  semmilyen token/jelszó nem kerül console-ra (lint-szabály + review).
- **8.4 Cert-bizalom (dev):** a mkcert **root CA**-t a készülékre/emulátorra telepíteni
  kell (iOS: profil + Trust; Android: user CA + `network_security_config` dev-build),
  vagy a base URL egy fejlesztői tunnel (pl. Expo/Cloudflare) HTTPS-végpontja. A
  `homeops.localhost` a készülékről **nem** oldódik fel → `EXPO_PUBLIC_API_BASE` = host
  LAN IP / tunnel.
- **8.5 Deep link / aktiválás dev-ben:** a Mailpit-beli aktiváló link a **web origin**-ra
  mutat. Mobil-teszthez: (a) a token kézi beillesztése az `activate` képernyőn (dev
  fallback), vagy (b) Expo Linking `homeops://activate/<token>` séma + a token kimásolása
  a Mailpit REST API-ból (az E2E-helper mintájára). Universal/app-link (associated domains
  / assetlinks) a Fázis 3 production-feladata.

---

## 9. Tesztelési stratégia

- **Unit (újrahasznosított):** `@homeops/core`/`validation`/`i18n` Vitest — változatlanul.
- **api-client:** body-refresh stratégia unit (mock `SessionPersistence`): login perzisztál,
  refresh rotál + perzisztál, session-expired töröl; web cookie-ág regresszió-mentes.
- **RN komponens (`@testing-library/react-native`):** login submit (mfa-ág navigáció),
  2FA verify, settings/security enrollment render, household-váltó.
- **Backend integráció (§4):** mobil-fejléces login/refresh/logout + reuse-detekció.
- **Manuális end-to-end mátrix (iOS + Android):** register → activate → login → (2FA) →
  shell → háztartás-váltó → nyelv/téma → settings/security enroll → disable → logout →
  hidegindítás (silent refresh) → session-lejárat (refresh érvénytelenítés → login).
- **Detox E2E:** **opcionális/gated** (mint a web Playwright Phase 0-ban) — a vázat
  előkészítjük, a teljes futtatás későbbre.

---

## 10. Phase 0 (mobil) kilépési kritérium

A mobil app a `https://<dev-host>` backend ellen:
1. **Boot:** splash → silent refresh a secure-store tokenből → shell vagy login.
2. **Teljes auth:** register → aktiváló e-mail (Mailpit) → activate → login →
   refresh (rotál) → régi refresh újrajátszása → 401 + család visszavonva → logout.
3. **2FA:** enable (QR + base32 + confirm + recovery kódok) → login 2. lépés (TOTP **és**
   recovery kód) → step-up disable/regenerate jelszóval.
4. **Shell:** hitelesített navigáció, háztartás-váltó, HU/EN, világos/sötét, user-menü logout.
5. **Session-lejárat:** refresh-bukás → toast + login (silent boot-probe némán).
6. **Minőség:** `pnpm turbo run lint typecheck test` zöld a mobillal; a web pipeline-ok és
   az auth-flow **változatlanul** zöldek; OpenAPI-drift kezelve.

→ Ekkor a **teljes projekt** (web + mobil) eléri a Phase 0 (+ 2FA) érettségi szintet.

---

## 11. Függőségek és kritikus út

```
S1 api-client seam ─┐
S2 backend-delta ───┼─► M2 providerek ─► U1 auth ─► U2 shell ─► U3 settings/security
M0 Expo váz ─► M1 NativeWind/tokens ─┘
Q1 CI/teszt ── a teljes szakaszon át
```

**Kemény sorrend-kötések:**
1. **S2 (backend-delta) az élő mobil-refresh előtt** — anélkül a mobil nem tud sessiont
   rehidratálni (nincs cookie). `impact()` a `refresh`/`login` szimbólumokra kötelező.
2. **S1 (api-client seam) az M2 előtt** — a mobil providerek a body-stratégiát konfigolják.
3. **`@homeops/tokens` RN-paletta (M1) a UI előtt** — különben hardcode színek szivárognak.
4. **A megosztott csomagok platform-tiszták maradnak** — a `no-restricted-imports` tiltja
   az RN/DOM importot a `packages/*`-ban; a platform-kód kizárólag `apps/mobile`-ban.
5. **Web-regresszió tilos** — S1/S2 defaultja a jelenlegi web-viselkedés; a web tesztek
   minden lépésnél zöldek.

---

## 12. Őszinte korlátok

- **Backend-delta szükséges:** a mobil Phase 0 **nem** áll elő tisztán frontend-munkából —
  a refresh body-ág (§4) kis, additív backend-változás. Enélkül csak cookie-jar-hack
  menne, ami ellentmond a `PLAN.md` §6.2-nek.
- **Dev-elérés súrlódás:** a `homeops.localhost` + mkcert a készüléken nem triviális
  (§8.4); a legtisztább dev-út egy HTTPS-tunnel vagy a root CA telepítése.
- **Deep link dev-ben félkész:** universal/app-link production-konfiguráció (associated
  domains / assetlinks) a Fázis 3-é; Phase 0-ban a custom scheme + kézi token elég a
  verifikációhoz.
- **NativeWind oklch:** a tokens oklch a webhez készült; az RN-paletta derivált hex/rgb —
  a két platform színei vizuálisan egyeznek, de a forrásértékek konverzióját egyszer
  validálni kell (snapshot a két palettára).
- **Push nincs (szándékosan):** ez Phase 0-mobil, nem Fázis 3 — a push-csatorna, a
  device-token-regisztráció és a csatorna-preferenciák a `PLAN.md` §6.3 szerint később.
- **EAS build / store:** a natív build + áruház-pipeline gated; Phase 0 a dev-kliensen
  (Expo Go / dev build) verifikál.

---

## 13. Létrehozandó / érintett fájlok

**Új — `apps/mobile/`:**
- `package.json`, `app.config.ts`, `metro.config.js`, `babel.config.js`, `tsconfig.json`,
  `tailwind.config.js`, `global.css`, `nativewind-env.d.ts`, `.env.example`
  (`EXPO_PUBLIC_API_BASE`).
- `app/_layout.tsx` (providerek), `app/(auth)/{login,register,activate,invite}.tsx`,
  `app/(auth)/login/verify.tsx`, `app/(app)/_layout.tsx` (RequireAuth + tabok),
  `app/(app)/{index,settings}.tsx`.
- `src/lib/{api,i18n,theme,auth,query,secure-store}.ts(x)`.
- `src/components/ui/*` (RN primitívek: Button, Field, Card, Badge, Dialog/Sheet, OTP-input),
  `src/features/auth/*` (a web hookok import-újrahasznosítása + RN-mappers, ha kell),
  `src/features/security/*` (enrollment wizard, recovery-codes, disable/regenerate).

**Adaptált — megosztott:**
- `packages/api-client/src/token-store.ts` (`SessionPersistence`, `setSession`).
- `packages/api-client/src/http.ts` (`credentials`/`refreshStrategy`/`extraHeaders`,
  body-refresh ág).
- `packages/api-client/src/{auth.ts,totp.ts}` (refresh-token perzisztálás, ha jött body-ban).
- `packages/tokens/src/index.ts` (RN-barát hex/rgb paletta, additív).
- `packages/types/src/index.ts` (`refresh_token?` a `LoginResponse`/`RefreshResponse`-ban).

**Adaptált — backend (§4):**
- `backend/app/api/auth.py` (`issue_session_response` mobil-ág, `refresh`/`logout` body-token),
  `backend/app/api/schemas.py` (`refresh_token` opcionális), `backend/tests/integration/`
  (mobil-fejléces flow), `openapi.snapshot.json` (drift), `.github/workflows/ci.yml`
  (mobil job-ok).

**Forrás-igazság:** `docs/PLAN.md` (§3, §5.8, §6), `docs/phase0.md`,
`docs/domain/two-factor-auth.md`, `docs/specification.md` (§5.4, §5.5, §5.8).
