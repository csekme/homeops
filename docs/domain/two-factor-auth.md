# Kétlépcsős hitelesítés (TOTP 2FA) — domain dokumentáció

> Állapot: **megvalósítva** (2026-06). Terv: [`docs/feature/twofactor.md`](../feature/twofactor.md).
> A meglévő token-architektúrát (Argon2id + access JWT + rotált refresh token + CSRF
> double-submit) **nem** írtuk át — a 2FA egy köztes lépésként ékelődik a jelszó-ellenőrzés
> és a session kiadása közé.

## 1. Mit ad a felhasználónak

- **TOTP** alapú második faktor, RFC 6238 (SHA-1, 6 számjegy, 30s lépés) → Google és
  Microsoft Authenticator is kiszolgálva **egyetlen** implementációval.
- **Beállítások → Biztonság** fül: be-/kikapcsolás, állapot, hátralévő tartalék kódok száma.
- **Enrollment wizard**: QR-kód (+ kézi base32 kulcs) → 6 jegyű kód megerősítés →
  **10 egyszer használatos recovery kód** egyszeri megjelenítése (másolás/letöltés).
- **Recovery**: ha nincs kéznél az authenticator, a 10 backup kód bármelyike beírható a
  TOTP helyett a beléptetés 2. lépésében.
- **Step-up védelem**: 2FA kikapcsolásához és a recovery kódok újragenerálásához a
  **jelszó újra-megadása** kötelező (átvett, már bejelentkezett session ne tudja
  kikapcsolni a védelmet).

## 2. Domain modell

Két **user-szintű** tábla. Nincs `household_id` → **nem** esnek RLS policy alá (a
`users`/`refresh_tokens`/`activation_tokens` kezeléséhez igazodva), kizárólag no-tenant
módban (`session_scope(bypass_tenant=True)`) érjük el.

### `user_totp` (1:1 a userrel)
| oszlop | típus | szerep |
|---|---|---|
| `user_id` | UUID FK→users, **unique**, ON DELETE CASCADE | tulajdonos |
| `secret_ciphertext`, `secret_wrapped_dek` | `LargeBinary` | a base32 TOTP-titok **envelope-titkosítva** |
| `secret_kek_id` | `String(64)` | a titkosító KEK azonosítója |
| `confirmed_at` | `timestamptz?` | NULL → setup elkezdve; kitöltve → **enabled** |
| `last_used_step` | `BigInteger?` | **replay-védelem**: a legutóbb elfogadott TOTP time-step |

Segéd: `UserTotp.enabled` property = `confirmed_at is not None`.

A három `secret_*` oszlop a meglévő `SecretCipher` (`EnvelopeAesCipher`) `SealedSecret`
három mezőjét képezi le 1:1-ben — **nincs új kriptográfia**, és a nyers titok soha nem
kerül a DB-be.

### `recovery_codes` (N sor / user)
| oszlop | típus | szerep |
|---|---|---|
| `user_id` | UUID FK→users (indexelt), CASCADE | tulajdonos |
| `code_hash` | `String(64)`, unique | a kód **SHA-256** hash-e (magas entrópiájú kód → nem kell jelszó-hash) |
| `used_at` | `timestamptz?` | egyszer használatos jelölés |

Migráció: `migrations/versions/a1b2c3d4e5f6_totp_2fa.py` (az `initial_schema` érintetlen;
nincs RLS policy; az app-szerep a default privileges grant révén jut hozzá).

## 3. Beléptetési folyamat (két lépcső)

```
POST /api/auth/login (email + jelszó)
        │  jelszó OK + ACTIVE
        ├── nincs enabled 2FA ──► teljes session (a régi viselkedés, változatlan)
        │
        └── van enabled 2FA  ──► 200 { "mfa_required": true, "challenge_token": "<JWT>" }
                                   (NINCS access/refresh/CSRF kiadva)

POST /api/auth/totp/verify  { challenge_token, code }   (NEM auth-olt)
        │  challenge token érvényes + (TOTP VAGY backup kód) elfogadva
        └──► teljes session: access_token (body) + refresh/CSRF (cookie)
```

- A **challenge token** rövid életű (~5 perc, `MFA_CHALLENGE_TTL_MINUTES`), `purpose="mfa"`
  claim-mel. A `bearer_auth` guard (`decode_access_token`) **elutasít** minden `purpose`-tag
  tokent → a challenge token semmilyen normál végponton nem hitelesít.
- A `verify` + a session kiadása **egy tranzakcióban** fut (`complete_login`): a felhasznált
  TOTP-step / backup kód atomikusan, a sessionnel együtt commitál.

## 4. Replay- és egyszer-használat védelem

- **TOTP**: `totp.verify()` visszaadja az elfogadott time-step indexet. Beléptetéskor, ha
  `step <= last_used_step` → `TotpReuse` (401). Sikerkor `last_used_step = step`.
  A `confirm_setup` is beállítja a `last_used_step`-et, így a megerősítő kód a következő
  belépésnél már nem érvényes.
- **Backup kód**: a normalizált (kisbetűs, kötőjel/szóköz nélküli) kód SHA-256 hash-ét
  keressük `used_at IS NULL` szűrővel; találatra `used_at = now` → egyszer használatos.

## 5. Service API (`app/services/totp_service.py`)

| függvény | mit csinál |
|---|---|
| `start_setup(user_id) → SetupView` | titkot generál, **titkosítva** (unconfirmed) eltárol; visszaadja az `otpauth://` URI-t + base32-t. Felülír egy korábbi, meg nem erősített setupot; ha már enabled → `TotpAlreadyEnabled`. |
| `confirm_setup(user_id, code) → list[str]` | ellenőrzi a kódot; `confirmed_at=now`, 10 recovery kód generálása+tárolása (hash), a nyers kódok **egyszeri** visszaadása. |
| `verify_challenge(session, user_id, code)` | login 2. lépés: TOTP (replay-véddel) **vagy** backup kód; hibára `InvalidTotpCode`/`TotpReuse`. |
| `disable(user_id, password)` | **jelszó-check**, majd `user_totp` + `recovery_codes` törlése. |
| `regenerate_recovery(user_id, password) → list[str]` | **jelszó-check**, régi kódok cseréje 10 újra. |
| `status(user_id) → StatusView` | `{enabled, recovery_codes_remaining}` a Beállítások oldalhoz. |
| `is_enabled(session, user_id) → bool` | a login-elágazás használja. |

Domain hibák (`app/services/exceptions.py`): `MfaRequired` (challenge tokent hordoz),
`TotpNotConfigured`, `TotpAlreadyEnabled`, `InvalidTotpCode`, `TotpReuse`.

## 6. HTTP végpontok (`app/api/totp.py`, prefix `/api/auth/totp`)

| metódus + út | auth | válasz | rate limit |
|---|---|---|---|
| `POST /setup` | bearer | `{provisioning_uri, secret}` | 10/min |
| `POST /confirm` | bearer | `{codes: [...]}` | 10/min |
| `POST /disable` | bearer (+jelszó) | 204 | 10/min |
| `POST /recovery/regenerate` | bearer (+jelszó) | `{codes: [...]}` | 10/min |
| `GET  /status` | bearer | `{enabled, recovery_codes_remaining}` | — |
| `POST /verify` | **nincs** (challenge a bodyban) | `LoginOut` (+ session cookie-k) | 10/min |

A `POST /api/auth/login` válasza bővült: 2FA esetén `{mfa_required, challenge_token}`
(HTTP 200), egyébként a korábbi teljes válasz.

**Enumeráció ellen**: a `verify` minden step-2 hibára (rossz/lejárt kód, reuse, lejárt
challenge) **generikus 401**-et ad.

## 7. Frontend

- **api-client** (`packages/api-client/src/totp.ts`): `useTotpSetup/Confirm/Disable/Status`,
  `useRegenerateRecovery`, `useTotpVerify`. A `login()` MFA-ágban **nem** tárol access
  tokent; a `useTotpVerify` sikerkor `setAccessToken` + `me` cache (mint a `useLogin`).
- **Beléptetés 2. lépés**: a `useLoginForm` `mfa_required` esetén a `/login/verify` route-ra
  navigál; a **challenge token csak memóriában** utazik (React Router `state`, nem URL,
  nem localStorage). Reload → vissza a loginra.
- **Settings → Security fül** (`apps/web/src/pages/settings.tsx` +
  `features/security/*`): állapot-badge, enrollment wizard (QR `qrcode.react` + `input-otp`),
  recovery kód megjelenítés (másolás/letöltés/„elmentettem”), jelszós disable/regenerate
  `dialog`-ok.
- **i18n**: új `settings` namespace (HU+EN), `errors.totp*` kulcsokkal.

### Megjegyzés a recovery kódok megjelenítéséről (enrollment)
A recovery kódok **közvetlenül a setup megerősítése után**, az enrollment dialogban
jelennek meg (nem csak újragenerálásnál). Ehhez a `useTotpConfirm` **szándékosan nem**
invalidálja a status-lekérdezést sikerkor — különben az `enabled=true` átfordulás
unmountolná a dialogot, mielőtt a recovery-lépés megjelenne. A status frissítés a wizard
**dialogjának bezárásakor** történik (`useTotpEnrollment.reset`).

## 8. Biztonsági összefoglaló

- A TOTP titok nyersen **csak** a setup-válaszban hagyja el a szervert (a beíráshoz
  szükséges — standard); tárolva kizárólag envelope-titkosítva.
- Replay-védelem (`last_used_step`) + egyszer használatos backup kódok (`used_at`).
- Step-up (jelszó) a kikapcsoláshoz/regeneráláshoz.
- Rate limit a kód-beíró végpontokon; generikus hibák (no enumeration).
- Challenge token rövid életű, `purpose=mfa`, normál végpontokon elutasítva.

## 9. Tesztek

- **Egységteszt** (`backend/tests/unit/test_totp.py`): `totp.verify` ±1 ablak, replay-step,
  recovery kód formátum/hash normalizálás.
- **Integrációs teszt** (`backend/tests/integration/test_totp_flow.py`): setup → confirm →
  login(mfa_required) → verify → me; backup kódos belépés (+fogyás); TOTP replay → 401;
  disable rossz/jó jelszóval; regenerate (régi kódok érvénytelenné válnak).
- Teljes backend suite: **34 teszt zöld**; frontend `pnpm --filter web build` + lint zöld.

## 10. Érintett fájlok

**Backend**: `pyproject.toml` (pyotp), `app/db/models.py`, `migrations/versions/a1b2c3d4e5f6_totp_2fa.py`,
`app/security/totp.py`, `app/security/recovery_codes.py`, `app/security/jwt_tokens.py`
(challenge token + guard-szigorítás), `app/services/totp_service.py`,
`app/services/auth_service.py` (login-elágazás + `complete_login`), `app/services/exceptions.py`,
`app/api/totp.py`, `app/api/auth.py`, `app/api/schemas.py`, `app/api/__init__.py`, `app/config.py`.

**Frontend**: `packages/types/src/index.ts`, `packages/validation/src/index.ts`,
`packages/api-client/src/{totp.ts,auth.ts,index.ts}`, `apps/web/src/features/auth/use-login-form.ts`,
`apps/web/src/features/security/*`, `apps/web/src/pages/{settings.tsx,login-verify.tsx}`,
`apps/web/src/App.tsx`, `packages/i18n/src/locales/{hu,en}/settings.json` (+ `index.ts`),
shadcn `dialog`/`input-otp` + `qrcode.react`.
