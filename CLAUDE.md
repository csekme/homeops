# Project: Household Management SaaS

Payments, official documents, utility services, documents, and tasks in a clear, easy-to-use interface for family-based, multi-user use.

**One-sentence vision:** HomeOps is a shared household “operating system” that keeps track of all recurring obligations, deadlines, expenses, and documents related to a home in one clear interface, and sends timely reminders before anything slips through the cracks.

**Who it serves:** primarily families / households where multiple responsible people — parents, and possibly older children — share the administrative burden. Secondarily, smaller shared rental households and property managers.

## Core Concepts — Domain Glossary

Without a shared glossary, the entire plan can easily become ambiguous. I use the following terms consistently throughout.

- **Household / Tenant:** the main isolation unit. All data belongs to a household. In the context of a multi-tenant SaaS, this is also the tenant.

- **User:** a global personal account tied to an email address. A user can be a member of multiple households — for example, someone may belong to both their own household and their parents’ household.

- **Membership:** the `User` ↔ `Household` relationship, which carries the role and permissions. **Important:** the role does not live on the user, but on the membership.

- **Role:** a predefined permission package, such as `OWNER`, `ADMIN`, `MEMBER`, `VIEWER`, or `CHILD`. It is extensible.

- **Permission:** a fine-grained operation-level authorization, such as `expense.read`, `document.delete`, or `connector.manage`. 
**A role is a set of permissions.**

## Architecture

Database: PostgreSQL
Backend: `/backend`: Python Flask /api
Email: Mailplit
Frontend:
    - `/apps/web`: React with schadcn components
    - `/apps/mobile`: React Native - gluestack ui v4
    - `/packages`: shared code between web and mobile
Reverse proxy based on nginx for developing cycle with self hosted cert.

HomeOps — Developer Experience (dev setup) `/docs/devex.md` 




Frontend (React + shadcn/ui)
- TypeScript, komponens-alapú, **szerver-állapot** kezelése pl. TanStack Query-vel (cache + újratöltés), nem nyers fetch szétszórva.
- shadcn/ui a dizájn-rendszer alapja (konzisztens, akadálymentes komponensek) — **web-only** marad (5.8).
- i18n már az elején (magyar/angol) — később a SaaS-nál hasznos.
- Az **access token csak memóriában** él (nem localStorage — XSS-kockázat), a frissítés httpOnly cookie-val (lásd 7.1).
- A web a monorepo **`apps/web`** csomagja; a prezentáció-mentes rétegeket (`api-client`, `core`, `validation`, `i18n`, `tokens`) a `packages/`-ből húzza (5.8). A szerver-állapot hookjai a backend OpenAPI-jából **generált** `api-client`-ből jönnek.