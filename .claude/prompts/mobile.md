Mobil (React Native)
- A token a platform **secure store**-jában (iOS Keychain / Android Keystore), nem sima async storage-ban.
- Push: FCM (Android) + APNs (iOS), device-token regisztráció a backend felé.
- A mobil a monorepo **`apps/mobile`** csomagja (**Expo**); ugyanazokat a `packages/` modulokat fogyasztja, mint a web, de saját **RN UI-réteggel** (**NativeWind**, a `tokens` témából) — shadcn nélkül.
- A web és mobil **ugyanazt a REST API-t** használja → egyetlen, **OpenAPI-ból generált** szerződés kevesebb duplikáció.

Expo (managed) + expo-router + expo-secure-store + gluestack-ui v4 + NativeWind.

- **Monorepo:** pnpm@10.14.0 + Turbo, `apps/*` + `packages/*`, Node >=22, `tsconfig.base.json` path-aliasokkal.
- **Újrahasználható, framework-agnostic csomagok:** `@homeops/types`, `@homeops/core`, `@homeops/validation`
  (zod), `@homeops/i18n` (i18next, EN/HU), `@homeops/tokens` (OKLCH).
- **`@homeops/api-client`** részben web-kötött: a `token-store.ts` (in-memory access token + `setOnSessionExpired`
  seam) **agnostic és újrahasználható**, de a `http.ts` web- specifikus (`document.cookie`, `credentials:'include'`,
  CSRF olvasás). Az `auth.ts`/`totp.ts` hookok (`useLogin`, `useMe`, `useLogout`, `useTotpVerify`, …) közvetlenül
  importálják az `apiFetch`-et.

  8. **UI réteg** — gluestack-ui v4 + NativeWind; `@homeops/tokens` (OKLCH → NativeWind/Tailwind config) mapping;
   auth-shell ekvivalens; Field/Input/Button/Alert/OTP-input natív megfelelők.
9. **Form & validáció** — react-hook-form `Controller`-rel; `@homeops/validation` zod sémák (login/register/totp)
   újrahasználata; zod-i18n hibatérkép (web `lib/zod-i18n.ts` mintájára).
10. **i18n** — `@homeops/i18n` + react-i18next; nyelvdetektálás `expo-localization`-nel; hibakód→i18n key
    mapper a web `error-messages.ts` mintájára.
11. **Képernyőnkénti tervek** — register, activate, login (+mfa elágazás), login/verify (OTP), logout, dashboard
    placeholder; mindegyikhez a megfelelő `@homeops/api-client` hook.