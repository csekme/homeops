# Two-Factor Authentication (TOTP) — Feature terv

## Context

A HomeOps jelenleg egylépcsős, jelszó-alapú beléptetést használ (Argon2id + rövid életű
JWT access token + szerver-oldali refresh token rotációval, CSRF double-submit védelemmel).
A felhasználó kétlépcsős hitelesítést (2FA) kér: TOTP alapon, QR-kóddal beolvasható
Google/Microsoft Authenticatorhoz, egy valódi **Beállítások** oldallal és **recovery**
mechanizmussal. A cél a fiókvédelem erősítése anélkül, hogy a meglévő token-architektúrát
átírnánk — a 2FA egy köztes lépésként ékelődik a jelszó-ellenőrzés és a session kiadása közé.

A feladat kimenete **ez a tervdokumentum** a `docs/feature/twofactor.md` fájlban. A megvalósítás
(backend + frontend) a terv jóváhagyása után, külön lépésben történik.

Megerősített termékdöntések:
- **QR**: a backend `otpauth://` URI-t + base32 titkot ad vissza, a frontend `qrcode.react`-tel rajzolja.
- **Recovery**: 10 db egyszer használatos backup kód (csak hash tárolva), bejelentkezéskor TOTP helyett beírható, beállításokban újragenerálható.
- **Step-up**: 2FA kikapcsolásához / backup kód újragenerálásához **jelszó újra-megadása** kötelező.

Google Authenticator és Microsoft Authenticator is szabványos RFC 6238 TOTP-t használ (SHA-1, 6 számjegy, 30s lépés), így **egyetlen** implementáció mindkettőt kiszolgálja.

---

## Architektúra (összefoglaló)

A meglévő réteges minta megtartása: **route (vékony kontroller) → service → repository**, marshmallow input séma, `session_scope(bypass_tenant=True)` az auth-lekérdezésekhez (a 2FA táblák user-szintűek, nincs `household_id` → nem esnek RLS policy alá, mint a `users`/`refresh_tokens`).

A login kétlépcsőssé válik: ha a usernek aktív a 2FA, a jelszó-ellenőrzés után **nem** ad ki teljes sessiont, hanem egy rövid életű, korlátozott hatókörű **challenge JWT-t** (purpose=`mfa`). A második lépés (`/auth/totp/verify`) ezt a tokent + a 6 jegyű kódot (vagy egy backup kódot) ellenőrzi, és csak akkor adja ki a valódi access+refresh+CSRF hármast.

---

## Backend

### 1. Új függőség
- `pyotp>=2.9` a `backend/pyproject.toml`-ba (tiszta Python, nincs C-függőség). QR-t a frontend rajzol → **nem** kell `qrcode`/Pillow a backendre.

### 2. Adatmodell — `backend/app/db/models.py`
Két új tábla (a `RefreshToken`/`ActivationToken` mintát követve, hash-only / titkosított tárolás):

- **`UserTotp`** — 1:1 a userrel:
  - `user_id` (FK users, unique, ondelete CASCADE)
  - `secret_ciphertext`, `secret_wrapped_dek` (`LargeBinary`), `secret_kek_id` (String) — a base32 TOTP-titok **envelope-titkosítva** a meglévő `SecretCipher`-rel (lásd `SealedSecret`)
  - `confirmed_at` (nullable) — csak megerősítés után `enabled`
  - `last_used_step` (BigInteger, nullable) — **replay-védelem**: ugyanaz a kód kétszer nem fogadható el
  - `created_at`, `updated_at`
  - segéd `enabled` property: `confirmed_at is not None`
- **`RecoveryCode`** — N sor userenként:
  - `user_id` (FK users), `code_hash` (String(64), SHA-256 — magas entrópiájú kód, a refresh-token mintát követve), `used_at` (nullable), `created_at`
  - index `user_id`-re

A `User` modellbe nem teszünk titkot; a `memberships` mintát követve adhatunk `totp: Mapped[UserTotp | None] = relationship(...)`-t kényelemből.

### 3. Migráció — `backend/migrations/versions/`
Új Alembic revízió (autogenerate után átnézve): `user_totp` és `recovery_codes` táblák, FK-k, indexek. Az `initial_schema` migrációt **nem** módosítjuk. Mivel nem tenant-táblák, **nincs** RLS policy rájuk (igazodik a `users`/`activation_tokens` kezeléshez).

### 4. TOTP primitívek — `backend/app/security/totp.py` (új)
Vékony wrapper a `pyotp` köré, hogy a service ne függjön közvetlenül a libtől:
- `generate_secret() -> str` (base32)
- `provisioning_uri(secret, account_email, issuer="HomeOps") -> str`
- `verify(secret, code, *, valid_window=1) -> int | None` — visszaadja az elfogadott time-step indexet (replay-ellenőrzéshez), vagy `None`
- `now_step() -> int`

### 5. Recovery kódok — `backend/app/security/recovery_codes.py` (új)
- `generate(n=10) -> list[str]` — olvasható kódok (pl. `xxxx-xxxx-xxxx`, `secrets` modul)
- hash: a meglévő SHA-256 minta (`auth_service._hash` kiemelése egy közös helyre, vagy újrahasznosítás)

### 6. Service — `backend/app/services/totp_service.py` (új)
Minden 2FA üzleti logika itt, `session_scope(bypass_tenant=True)`-szal, a `auth_service` mintáját követve. Függvények:
- `start_setup(user_id) -> SetupView{provisioning_uri, secret}` — generál titkot, `confirmed_at=NULL`-lal eltárolja **titkosítva**, visszaadja az URI-t + base32-t (manuális beíráshoz). Felülír egy korábbi, meg nem erősített setupot.
- `confirm_setup(user_id, code) -> list[str]` — ellenőrzi a kódot; siker esetén `confirmed_at=now`, generál + tárol 10 recovery kódot (hash), és **egyszer** visszaadja a nyers kódokat.
- `verify_challenge(user_id, code) -> bool` — login 2. lépés: TOTP **vagy** backup kód elfogadása; TOTP-nél `last_used_step` frissítés (replay-véd), backup kódnál `used_at` beállítás (egyszer használatos).
- `disable(user_id, password) -> None` — **jelszó újraellenőrzés** (Argon2 verify a `get_passwords()`-szal), majd `UserTotp` + `RecoveryCode`-ok törlése.
- `regenerate_recovery(user_id, password) -> list[str]` — jelszó-check, régi kódok cseréje újakra.
- `status(user_id) -> {enabled, recovery_codes_remaining}` — a Beállítások oldalhoz.

Domain hibák a `app/services/exceptions.py`-ba: `TotpNotConfigured`, `TotpAlreadyEnabled`, `InvalidTotpCode`, `TotpReuse`.

### 7. Login flow változás — `backend/app/services/auth_service.py`
A `login()` a jelszó+ACTIVE ellenőrzés után megnézi, van-e **enabled** `UserTotp`:
- ha **nincs** → a jelenlegi viselkedés (teljes session kiadás), változatlan.
- ha **van** → **nem** ad ki sessiont; `MfaRequired` jelzéssel visszaad egy **challenge tokent** (rövid életű, ~5 perc JWT, claim `purpose="mfa"`, `sub`). Új helper `encode_access_token` mintájára a `jwt_tokens.py`-ban: `encode_mfa_challenge` / `decode_mfa_challenge`.
- a `bearer_auth` guardot kiegészítjük: a `purpose="mfa"` token **nem** fogadható el normál végpontokon (csak az access tokenek; a challenge külön dekódolóval megy).

Új service belépő: `complete_login(challenge_token, code, ip, user_agent) -> IssuedSession` — dekódolja a challenge-et, `verify_challenge`-et hív, majd a meglévő `_issue_session()`-t.

### 8. Input sémák — `backend/app/api/schemas.py`
`TotpConfirmIn{code}`, `TotpVerifyIn{challenge_token, code}`, `TotpDisableIn{password}`, `RecoveryRegenerateIn{password}`, `TotpSetupOut{provisioning_uri, secret}`, `TotpStatusOut{enabled, recovery_codes_remaining}`, `RecoveryCodesOut{codes}`, és a login válaszhoz egy `mfa_required`/`challenge_token` mezős kimenet.

### 9. Endpoints — `backend/app/api/auth.py` (vagy új `backend/app/api/totp.py` blueprint)
Mind `@auth_bp.auth_required(bearer_auth)` (kivéve a login-verify), `@limiter.limit(...)` a kód-beíró végpontokon:
- `POST /api/auth/totp/setup` (auth) → `TotpSetupOut`
- `POST /api/auth/totp/confirm` (auth) → `RecoveryCodesOut`
- `POST /api/auth/totp/disable` (auth, jelszó) → 204
- `POST /api/auth/totp/recovery/regenerate` (auth, jelszó) → `RecoveryCodesOut`
- `GET  /api/auth/totp/status` (auth) → `TotpStatusOut`
- `POST /api/auth/totp/verify` (NEM auth — challenge token a bodyban) → a `LoginOut` (access_token + cookie-k), `_attach_session_cookies`-szal
- A `POST /api/auth/login` válasza bővül: ha 2FA kell, `{mfa_required: true, challenge_token}` (HTTP 200), egyébként a mai full válasz.

### 10. Crypto újrahasznosítás
A titok titkosítása a meglévő `get_secret_cipher()` (`EnvelopeAesCipher`) + `SealedSecret`-en keresztül — **nincs** új kriptó. A `SealedSecret` három mezője (`ciphertext`, `wrapped_dek`, `kek_id`) leképeződik a `UserTotp` három oszlopára.

---

## Frontend

### 1. Types — `packages/types/src/index.ts`
Új DTO-k: `TotpSetupResponse{provisioning_uri, secret}`, `TotpStatusResponse{enabled, recovery_codes_remaining}`, `RecoveryCodesResponse{codes}`, `TotpVerifyRequest{challenge_token, code}`, `TotpConfirmRequest{code}`, `TotpDisableRequest{password}`; a `LoginResponse` kiegészül opcionális `mfa_required?: boolean; challenge_token?: string` mezőkkel.

### 2. Validation — `packages/validation/src/index.ts`
`totpCodeSchema` (6 számjegy, vagy backup-kód formátum), `totpDisableSchema{password}`. A kódbeírónál engedjük a backup-kód formátumot is.

### 3. api-client — `packages/api-client/src/totp.ts` (új), `auth.ts` kiegészítése
A meglévő `apiFetch` + hook-minta (`useLogin` stílus) szerint:
`useTotpSetup`, `useTotpConfirm`, `useTotpDisable`, `useTotpStatus`, `useRegenerateRecovery`, `useTotpVerify`. A `login()`-t úgy módosítjuk, hogy ha `mfa_required`, **ne** tárolja az access tokent (nincs is), hanem adja vissza a challenge-et a hívónak. A `useTotpVerify` sikerkor `setAccessToken` + `meQueryKey` cache (mint a `useLogin`).

### 4. features/security — új feature-mappa (a `features/auth` mintát követve)
- `use-totp-setup.ts` — enrollment wizard állapotgépe (setup → confirm → recovery codes megjelenítés)
- `use-totp-challenge.ts` — login 2. lépés form (kód vagy backup kód) + `useTotpVerify`
- `use-disable-2fa.ts` — jelszavas megerősítés form
- `mappers.ts`, `error-messages.ts` — a kódokat (`InvalidTotpCode`, `TotpReuse`, …) i18n kulcsokra képzi, a `features/auth/error-messages.ts` mintájára

### 5. Beállítások oldal — `apps/web/src/pages/settings.tsx` (új) + route
A jelenlegi placeholder lecserélése a `/settings` route-on (`apps/web/src/App.tsx`). shadcn `tabs` (már telepítve) — **Security** fül a 2FA szekcióval (`card`, `button`, `input`, `alert`, `badge`). Állapot a `useTotpStatus` szerint:
- **Kikapcsolt** → "Bekapcsolás" gomb → enrollment wizard (lásd lent).
- **Bekapcsolt** → státusz badge, "Kikapcsolás" (jelszós dialog), "Backup kódok újragenerálása" (jelszós dialog), hátralévő kódok száma.

Új shadcn komponensek a CLI-vel (a `shadcn-only` szabály szerint, **nem** kézzel): `dialog`, és ha kell, `input-otp` az 6-jegyű kódbeíráshoz. QR-hez `qrcode.react` npm csomag.

### 6. Enrollment wizard (Security fül komponensei)
1. `useTotpSetup().mutate()` → QR (`qrcode.react` az `provisioning_uri`-ból) + a base32 titok manuális beíráshoz, "Google/Microsoft Authenticatorral olvasd be" instrukció.
2. 6-jegyű kód beírása → `confirm` → siker.
3. **Recovery kódok** megjelenítése egyszer: másolás/letöltés gomb + "Nem jelenik meg újra" figyelmeztetés (`alert`), megerősítő pipa, hogy elmentette.

### 7. Login challenge képernyő — routing
A `useLoginForm` (`apps/web/src/features/auth/use-login-form.ts`) `onSuccess`-ét bővítjük: ha `mfa_required`, ne navigáljon `/`-ra, hanem egy 2FA-kód képernyőre (a challenge tokent state-ben/contextben átadva). Megoldás: `/login/verify` route + `use-totp-challenge` hook, vagy a login oldalon belüli állapotváltás. A challenge token **csak memóriában** (nem URL/localStorage). Sikeres verify után `navigate('/', {replace:true})`, ahogy ma.

### 8. i18n — `packages/i18n/src/`
Új kulcsok: `settings.security.*`, `twofactor.*` (wizard lépések, instrukciók), `errors.totpInvalid`, `errors.totpReuse`, `errors.recoveryInvalid`, `errors.totpAlreadyEnabled`. Magyar + meglévő nyelvek.

---

## Biztonsági megfontolások
- TOTP titok **soha** nem hagyja el a szervert nyersen a setupon kívül (setupkor szükséges a beírás miatt — ez standard); tárolva csak envelope-titkosítva.
- **Replay-védelem**: `last_used_step` — ugyanaz a 6-jegyű kód kétszer nem érvényes.
- **Backup kódok**: csak SHA-256 hash tárolva, egyszer használatosak (`used_at`).
- **Step-up**: kikapcsolás/regenerálás jelszót kér (átvett, már bejelentkezett session ne tudja kikapcsolni a védelmet).
- **Rate limit** a `confirm`/`verify`/`disable` végpontokon (`flask-limiter`, mint a login `10/min`).
- **Challenge token** rövid életű (~5 perc), `purpose=mfa` claim, normál végpontokon a `bearer_auth` elutasítja.
- **Enumeráció**: a `verify` generikus hibát ad érvénytelen kódra; a login válasz mfa-ágában nem szivárog több info.

## Érintett és új fájlok (reprezentatív)
**Backend**: `pyproject.toml` (pyotp), `app/db/models.py`, új `migrations/versions/<rev>_totp.py`, új `app/security/totp.py` + `app/security/recovery_codes.py`, új `app/services/totp_service.py`, `app/services/exceptions.py`, `app/services/auth_service.py` (login elágazás + `complete_login`), `app/security/jwt_tokens.py` (challenge token), `app/api/security.py` (guard), `app/api/auth.py` (+ esetleg új `app/api/totp.py`), `app/api/schemas.py`, `app/api/__init__.py` (blueprint regisztráció).
**Frontend**: `packages/types/src/index.ts`, `packages/validation/src/index.ts`, új `packages/api-client/src/totp.ts` + `auth.ts`, `apps/web/src/features/auth/use-login-form.ts`, új `apps/web/src/features/security/*`, új `apps/web/src/pages/settings.tsx` + `App.tsx` route, esetleg `/login/verify` képernyő, `packages/i18n/src/*`, új shadcn komponensek (`dialog`, `input-otp`) + `qrcode.react`.

## Tesztelés / verifikáció
- **Backend integrációs teszt** a `backend/tests/integration/test_auth_flow.py` mintájára: setup → confirm → login(mfa_required) → verify → me; backup kóddal login; replay (ugyanaz a step kétszer → 401); disable jelszó nélkül/rosszal → hiba; regenerate.
- **TOTP egységteszt**: `pyotp.TOTP(secret).now()` által generált kóddal a `totp.verify` zöld; ±1 ablak; replay None.
- **Frontend**: `pnpm --filter web build` + manuális végigjátszás (enrollment → kijelentkezés → 2FA-s belépés → recovery kód). A `verify` skillel az app futtatása.
- **GitNexus**: a `auth_service.login` és `bearer_auth` módosítása előtt `impact({target:..., direction:"upstream"})`, commit előtt `detect_changes({scope:"compare", base_ref:"main"})`.

## Megvalósítási fázisok
1. **Doc**: `docs/feature/twofactor.md` létrehozása ezzel a tervvel.
2. **Backend adat+kripto**: pyotp, modellek, migráció, `totp.py`, `recovery_codes.py`.
3. **Backend service+API**: `totp_service`, login elágazás, challenge token, végpontok, sémák, tesztek.
4. **Frontend alap**: types, validation, api-client `totp.ts`, login-flow elágazás + challenge képernyő.
5. **Frontend UI**: Settings oldal + Security fül + enrollment wizard + recovery UI + i18n + shadcn komponensek.
6. **Verifikáció**: tesztek, build, kézi végigjátszás, GitNexus impact/detect_changes.
