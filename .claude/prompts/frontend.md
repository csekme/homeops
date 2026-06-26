Frontend (React + shadcn/ui)
- TypeScript, komponens-alapú, **szerver-állapot** kezelése pl. TanStack Query-vel (cache + újratöltés), nem nyers fetch szétszórva.
- shadcn/ui a dizájn-rendszer alapja (konzisztens, akadálymentes komponensek) — **web-only** marad (5.8).
- i18n már az elején (magyar/angol) — később a SaaS-nál hasznos.
- Az **access token csak memóriában** él (nem localStorage — XSS-kockázat), a frissítés httpOnly cookie-val (lásd 7.1).
- A web a monorepo **`apps/web`** csomagja; a prezentáció-mentes rétegeket (`api-client`, `core`, `validation`, `i18n`, `tokens`) a `packages/`-ből húzza (5.8). A szerver-állapot hookjai a backend OpenAPI-jából **generált** `api-client`-ből jönnek.

Vannak schadcn skillek használjuk őket