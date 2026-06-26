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