# Phase 0 — Mobile (HomeOps) végrehajtási terv dokumentum

## Context

A webes alap elkészült (`apps/web`): regisztráció, e-mail aktiválás, belépés (jelszó + opcionális 2FA),
kilépés, login/register/activate/verify oldalak. A `apps/mobile` könyvtár **teljesen üres**.
A feladat: létrehozni a **`docs/phase0-mobile.md`** dokumentumot, amely végrehajtási tervet ad a
mobil (React Native) app felépítésére a webbel azonos funkcionalitásig.

**Ez a deliverable maga a tervdokumentum** — nem a mobil app implementációja. A `docs/phase0-mobile.md`
az egyetlen fájl, amit a jóváhagyás után létrehozok.

### Megerősített döntések (felhasználói válaszok alapján)
1. **Token-transport:** backend kap egy mobil-barát refresh utat (refresh token JSON body-ban,
   `expo-secure-store`-ban tárolva, CSRF kihagyva bearer/body esetén). Web érintetlen marad.
2. **RN alap:** Expo (managed) + expo-router + expo-secure-store + gluestack-ui v4 + NativeWind.
3. **2FA:** a login 2FA verify lépés bekerül (TOTP enrollment/setup nem — az későbbi fázis).

## Kulcs-megállapítások a kódbázisból

- **Monorepo:** pnpm@10.14.0 + Turbo, `apps/*` + `packages/*`, Node >=22, `tsconfig.base.json` path-aliasokkal.
- **Újrahasználható, framework-agnostic csomagok:** `@homeops/types`, `@homeops/core`, `@homeops/validation`
  (zod), `@homeops/i18n` (i18next, EN/HU), `@homeops/tokens` (OKLCH).
- **`@homeops/api-client`** részben web-kötött: a `token-store.ts` (in-memory access token + `setOnSessionExpired`
  seam) **agnostic és újrahasználható**, de a `http.ts` web- specifikus (`document.cookie`, `credentials:'include'`,
  CSRF olvasás). Az `auth.ts`/`totp.ts` hookok (`useLogin`, `useMe`, `useLogout`, `useTotpVerify`, …) közvetlenül
  importálják az `apiFetch`-et.
- **Backend auth contract** (`backend/app/api/auth.py`, `totp.py`):
  - `POST /api/auth/register` → 202, `{message}`
  - `POST /api/auth/activate` `{token}` → `{message}`
  - `POST /api/auth/login` `{email,password}` → `{access_token,token_type,user}` **vagy** `{mfa_required:true,challenge_token}`; refresh+csrf jelenleg **HttpOnly cookie**-ban
  - `POST /api/auth/totp/verify` `{challenge_token,code}` → ugyanaz mint login siker
  - `POST /api/auth/refresh` → cookie + `X-CSRF-Token` szükséges, `{access_token}`
  - `POST /api/auth/logout` → 204
  - `GET /api/auth/me` (Bearer) → user + memberships
  - Sémák: `LoginOut`, `RefreshOut` (`backend/app/api/schemas.py`).

## A `docs/phase0-mobile.md` tervezett tartalma (vázlat)

1. **Cél és scope** — mit jelent a "webbel azonos pont" mobilon; mi marad ki (TOTP setup, household UI).
2. **Architektúra-döntések** — Expo managed, expo-router, gluestack-ui v4 + NativeWind, secure-store token,
   shared package újrahasználat. Web↔mobile token-transport különbség indoklása.
3. **Backend módosítás (mobil refresh path)** — minimális, web-kompatibilis:
   - Mobil kliens minden kérésben küld egy jelző fejlécet (pl. `X-Auth-Transport: bearer`).
   - `/login` és `/totp/verify`: ha a fejléc jelen van → `refresh_token` a JSON body-ban (`LoginOut`-ba
     opcionális `refresh_token` mező), **nincs** Set-Cookie. Egyébként a jelenlegi cookie-viselkedés.
   - `/refresh`: ha body/`Authorization` tartalmazza a refresh tokent → body-ból validál, **CSRF kihagyva**,
     új `refresh_token` a body-ban. Egyébként cookie+CSRF út változatlan.
   - `/logout`: mobilnál refresh token a body-ból.
   - Web 100%-ban érintetlen (nem küldi a fejlécet → cookie út).
4. **`@homeops/api-client` transport-adapter seam** — a hookok újrahasznosíthatók maradjanak:
   - `configureApiClient()` kibővítése: `includeCredentials`, `readCsrfToken?`, és refresh-token tár
     adapter (`loadRefreshToken`/`saveRefreshToken`/`clearRefreshToken`).
   - `login()`/`totpVerify()` a body-ban kapott `refresh_token`-t az adapteren át menti.
   - `refresh()` mobil módban a tárolt tokent body-ban küldi, CSRF nélkül.
   - Web a meglévő alapértelmezett (cookie) adaptert kapja → változatlan viselkedés.
5. **Mobil projekt scaffold** — `apps/mobile` Expo app a monorepóba illesztve (pnpm workspace, tsconfig
   extends, Metro a workspace-symlinkekhez), scriptek.
6. **Token & boot réteg** — `expo-secure-store` refresh-token adapter; `token-store.ts` újrahasználata
   (in-memory access token); boot-flow: induláskor refresh a secure-store tokennel → access token rehidrálás
   → `useMe`; Splash amíg boot. `setOnSessionExpired` → secure-store törlés + query cache clear + redirect login.
7. **Navigáció (expo-router)** — `(auth)` group: `login`, `login/verify`, `register`, `activate/[token]`;
   `(app)` group védett, `index` (dashboard placeholder). Root layout auth-alapú redirect (RequireAuth megfelelő).
   Deep-link: `homeops://` scheme az `activate/[token]`-hez + token-beíró fallback; universal links későbbi fázis.
8. **UI réteg** — gluestack-ui v4 + NativeWind; `@homeops/tokens` (OKLCH → NativeWind/Tailwind config) mapping;
   auth-shell ekvivalens; Field/Input/Button/Alert/OTP-input natív megfelelők.
9. **Form & validáció** — react-hook-form `Controller`-rel; `@homeops/validation` zod sémák (login/register/totp)
   újrahasználata; zod-i18n hibatérkép (web `lib/zod-i18n.ts` mintájára).
10. **i18n** — `@homeops/i18n` + react-i18next; nyelvdetektálás `expo-localization`-nel; hibakód→i18n key
    mapper a web `error-messages.ts` mintájára.
11. **Képernyőnkénti tervek** — register, activate, login (+mfa elágazás), login/verify (OTP), logout, dashboard
    placeholder; mindegyikhez a megfelelő `@homeops/api-client` hook.
12. **Feladatlista / sorrend** — checklistába rendezett, fázisokra bontva (backend seam → api-client seam →
    scaffold → token/boot → nav → UI → screens → i18n).
13. **Verifikáció** — backend pytest a mobil refresh úthoz; api-client unit teszt az adapterre; Expo app
    futtatása (`pnpm --filter mobile start`), end-to-end kézi folyamat: register → Mailpit aktiváló link →
    activate → login → (2FA) → me → logout; web regressziós ellenőrzés (cookie út változatlan).

## Kritikus fájlok, amelyeket a doc megnevez (implementációs fázisra)
- Backend: `backend/app/api/auth.py`, `backend/app/api/totp.py`, `backend/app/api/schemas.py`,
  `backend/app/security/csrf.py`, `backend/app/services/auth_service.py`.
- Shared: `packages/api-client/src/http.ts`, `token-store.ts`, `auth.ts`, `totp.ts`, `index.ts`.
- Web minta: `apps/web/src/features/auth/*`, `apps/web/src/lib/{auth.tsx,query.ts,i18n.ts,zod-i18n.ts}`,
  `apps/web/src/pages/{login,login-verify,register,activate}.tsx`.
- Új: `apps/mobile/*` (Expo scaffold).

## Megjegyzés
A tervdokumentum scope-ja: a `docs/phase0-mobile.md` megírása. Az abban leírt backend- és api-client-módosítások,
valamint a mobil scaffold **a következő, implementációs lépés** — ezeket a doc részletezi, de most nem hajtom végre.
