# Bugfix & Feature Plan — Household Smoke Test Findings

Forrás: Household smoke teszt (webapp). Négy megállapítás, hatás szerinti sorrendben.

---

## #4 — Meghívási folyamat (bugfix, backend + web) — *legnagyobb hatás*

**Kiváltó ok:** A meghívók email-hez kötöttek, nincs `user_id` kapcsolat. Miután egy
regisztrálatlan meghívott regisztrál → aktivál → belép, semmi nem köti össze a függőben
lévő meghívót az új fiókkal, így üres dashboardra érkezik értesítés nélkül. Ezen felül a
meghívó oldal csak **Elfogad** gombot mutat (nincs elutasítás), és a token elveszik, amikor
a regisztráció/belépés körútján megy keresztül.

**Tervezési döntés:** Beleegyezés-alapú megjelenítés, *nem* automatikus elfogadás. A riport
kifejezetten kéri az elutasítás lehetőségét (b hiba), így az aktiváláskori csendes
auto-csatlakozás hibás lenne. Helyette megjelenítjük a függő meghívókat, és a user dönt.

Változások:
1. **Backend — új végpont** `GET /api/invitations/mine`: visszaadja a függő meghívókat,
   ahol `email == bejelentkezett user email-je` (bypass-tenant módban fut, mint a meglévő
   accept flow, az RLS megfontolás szerint). Nem kell új `user_id` oszlop — olvasáskor email
   alapján kérdezünk, ami konzisztens a meglévő biztonsági modellel.
2. **Backend — elutasítás végpont** `POST /api/invitations/decline` + `declined_at` oszlop az
   `Invitation` modellen (migráció, a `revoked_at`/`accepted_at` mintájára). Megkülönbözteti a
   meghívott-elutasítást a meghívó-visszavonástól.
3. **Web — megjelenítés a dashboardon:** "függő meghívók" banner/kártya (Elfogad / Elutasít
   meghívónként), ha a `useMyInvitations()` ad vissza találatot. Tokentől függetlenül megoldja
   az üres-dashboard-regisztráció-után esetet.
4. **Web — meghívó oldal (`invite.tsx`):** **Elutasít** gomb az Elfogad mellé; a meghívó token
   megőrzése a regisztráció/belépés során egy `redirect` paraméterrel, hogy a user auth után
   visszatérjen a meghívó oldalra.
5. `openapi.snapshot.json` frissítése + `pnpm codegen` a két új végponthoz.

## #3 — Háztartás kontextus láthatósága (web feature)

Minden adat már most a `useGetMe()`-ből jön (a membership tartalmazza a `household_name`-et és
a `role`-t); ez tisztán UI-kompozíció.

1. **Új `HouseholdSwitcher`** a `SidebarHeader`-ben (shadcn team-switcher minta): az **aktuális
   háztartás nevét + szerepkört** mutatja, lenyíló a háztartások közti váltáshoz (a meglévő
   `useHouseholdSwitcher()`-t használja) és egy "Háztartás létrehozása" akció.
2. **`nav-user.tsx` lábléc:** a user **szerepkörének** megjelenítése a lenyíló fejlécében (a név/email
   mellett); a most már duplikált háztartás-váltó kivétele, megtartva a fiók-akciókat (beállítások
   kezelése, kijelentkezés).

## #1 — Elfelejtett / jelszó visszaállítás (teljes vertikális szelet, backend + web)

**Backend:**
- Új `PasswordResetToken` modell + migráció (az `ActivationToken` tükre: hashelt token, lejárat,
  egyszer használatos).
- `POST /api/auth/forgot-password` (email) → mindig generikus sikert ad vissza (nincs user
  enumeráció), reset emailt csak akkor küld, ha a user létezik & aktív. Rate-limit, mint a registernél.
- `POST /api/auth/reset-password` (token + új jelszó) → validálja/elhasználja a tokent, frissíti a
  `password_hash`-t, **és visszavonja az összes refresh-token családot** (bevett gyakorlat — élő
  munkamenetek érvénytelenítése jelszó-visszaállításkor).
- `build_password_reset_email()` + `password_reset.{html,txt}.j2` sablonok hu/en szöveggel.
- Repo metódus a jelszó frissítéséhez; új sémák.

**Web:**
- `/forgot-password` oldal + hook; `/reset-password/:token` oldal + hook.
- "Elfelejtett jelszó?" link a login oldalon (a konkrét riport-megállapítás javítása).
- Route-ok + i18n (hu/en).
- Snapshot újragenerálás + codegen.

## #2 — Jelszó megerősítés a regisztrációnál (web, csak frontend)

- `confirmPassword` mező hozzáadása a register Zod sémához a `packages/validation`-ben egy
  `.refine()` egyezés-ellenőrzéssel; második input a `register.tsx`-be; i18n hibaüzenet. Nincs
  backend/API változás (csak a `password` megy ki).

---

**Scope megjegyzés:** Mind a négy megállapítás a **web** smoke tesztből származik, ezért
**csak web** a terv. A mobil appban van párhuzamos register/auth/invite kód, ami ugyanazt a
kezelést igényelné #1, #2, #4 esetén — ez kimarad, hacsak nem kell paritás.

**Sorrend:** #4 → #3 → #1 → #2 (hatás szerint). A #4 és #1 backend változásai igénylik az
OpenAPI snapshot újragenerálását (bootolt backend kell) mielőtt a generált hookok léteznének —
ezt a backend és web munka között intézem.
