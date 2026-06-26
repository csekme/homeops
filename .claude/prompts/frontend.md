Frontend (React + shadcn/ui)
- TypeScript, komponens-alapú, **szerver-állapot** kezelése pl. TanStack Query-vel (cache + újratöltés), nem nyers fetch szétszórva.
- shadcn/ui a dizájn-rendszer alapja (konzisztens, akadálymentes komponensek) — **web-only** marad (5.8).
- i18n már az elején (magyar/angol) — később a SaaS-nál hasznos.
- Az **access token csak memóriában** él (nem localStorage — XSS-kockázat), a frissítés httpOnly cookie-val (lásd 7.1).
- A web a monorepo **`apps/web`** csomagja; a prezentáció-mentes rétegeket (`api-client`, `core`, `validation`, `i18n`, `tokens`) a `packages/`-ből húzza (5.8). A szerver-állapot hookjai a backend OpenAPI-jából **generált** `api-client`-ből jönnek.

Vannak schadcn skillek használjuk őket

## Elrendezés (layout) — kötelező szabály új oldalakhoz

Egyetlen **globális tartalmi konténer** van, az `AppShell`-ben (`apps/web/src/components/app-shell.tsx`):
a `ScrollArea`-n belül egy `w-full max-w-7xl p-4 md:p-6` `div`, ami az `<Outlet />`-et tartja.
Ez ad **minden oldalnak** egységes bal élt, szélesség-plafont és reszponzív paddinget.

Szabályok új oldalakhoz (a `pages/` alatt):
- Az oldal komponense **csak a tartalmat** rendereli — **soha ne** tegyen rá saját külső
  paddinget (`p-4`/`p-6`…) és **soha ne** állítson saját oldal-szintű külső szélességet vagy
  `mx-auto` középre igazítást. Ezt a shell intézi.
- A tartalom **balra igazított** (a tartalmi terület bal éléhez horgonyzik); a fölösleg hely
  **jobbra** esik. Tilos a tartalmat középre úsztatni — az modális-érzetet kelt, nem admin-felületet.
- **Adat-sűrű / áttekintő oldalak** (dashboard, listák, táblák): hagyd kitölteni a konténert
  (`max-w-7xl`), pl. reszponzív griddel (`grid gap-4 md:grid-cols-2 lg:grid-cols-3`).
- **Űrlap- / beállítás-oldalak**: adj az oldal gyökerének egy szűkebb, olvasható **önkorlátot**
  balra igazítva — `max-w-2xl` egyszerű űrlaphoz, `max-w-4xl` ha lista is van mellette
  (pl. `household.tsx`). Egyetlen, magányos input mezőt fogd `max-w-md`-re — a teljes szélességű
  input „töröttnek" hat.
- Vertikális kitöltés: a tartalmi oldalak **nem** nyúlnak függőlegesen (a `SidebarInset`
  `min-h-svh`); rövid oldalnál az alsó üres terület normális, nem hiba.

Breakpointok (Tailwind alap-skála): `base` (<768px) folyékony, teljes szélesség; `md` (≥768px)
nagyobb padding + életbe lép a `max-w-*` plafon; `lg`+ a plafon tartja, a többlet jobb margó lesz.

A breadcrumb-címkék a `SEGMENT_LABEL_KEYS` map-ből jönnek (`app-shell.tsx`) — **új védett útvonalhoz
vedd fel az első path-szegmenst** ehhez a map-hez, különben a dashboard címkéjére esik vissza.