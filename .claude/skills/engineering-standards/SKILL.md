---
name: engineering-standards
description: The baseline, stack-agnostic engineering standard that makes generated code defensible in a code review instead of "vibecoded". Use this skill WHENEVER building, extending, or reviewing a real application — backend, frontend, mobile, scripts — regardless of language or framework, and ALWAYS in combination with the relevant stack-specific skill (e.g. shadcn web, Flask, react-native-expo). It defines the architecture, security, data, documentation, and agent-extensibility bar plus the Definition of Done that the code-reviewer and security-reviewer agents enforce. Apply it for any task like "build a feature", "set up the project", "add an endpoint/screen", "wire up auth", or "is this production-ready". This is the apex layer; stack skills specialize it, they don't replace it.
---

# Engineering standards (anti-vibecoding baseline)

Vibecoding ships code that *runs in the demo* and collapses under review: inconsistent architecture, secrets in the bundle, hallucinated schemas, no migrations, undocumented decisions, a black box nobody can own. This skill is the baseline that prevents that — the standard a senior engineer would hold the work to, expressed so it holds across any stack.

It is intentionally generic. The concrete "how" for a given stack lives in the stack skill (shadcn/web, Flask/Python, react-native-expo, etc.). **Always load both**: this skill for the bar, the stack skill for the idioms. This skill defines *what good looks like* and *how it gets verified*; it does not duplicate framework specifics.

## How this binds (read this first)

A standard the building agent merely *reads* is advisory — the same agent optimizing for "make it work" decides whether it complied. Real enforcement is layered:

1. **This skill + the stack skill** — followed during construction.
2. **Independent review** — the `code-reviewer` and `security-reviewer` subagents re-read the diff in a fresh context with an adversarial objective. Run them before calling a change done. (They don't inherit skills — their checklists are embedded.)
3. **A gate that can't be skipped** — a hook (e.g. on `Stop`/`SubagentStop`) or CI that fails on lint, typecheck, tests, missing migrations, and secret scan.

Treat 1 as necessary-but-insufficient. The guarantees below only become real when 2 and 3 exist. If the project has no gate yet, setting one up is part of "production-ready".

## The standard, by concern

### Architecture — modular, typed, owns its boundaries
- **Layer with a clear dependency direction.** Dependencies point inward (UI → service → domain → data), never the reverse. Domain logic must not import framework/UI.
- **Small, single-purpose units.** No god-files, no 300-line functions, no catch-all `utils` dumping ground. If a file does five things, split it.
- **Type everything at the boundaries.** Public function signatures, API payloads, DB rows, and external responses are typed (TS types, Python type hints + a validation lib, etc.). `any`/untyped escape hatches are flagged, not shipped.
- **Explicit contracts between modules.** A boundary is an interface/schema/type, not "whatever this function happens to return today". Changing internals must not silently change a contract.
- **No dead code, no commented-out blocks, no TODO that means "I gave up here".** Either do it or file it.

### Security — assume the client is hostile
- **No secrets in client-shippable code.** API keys, service-role tokens, signing keys never live in frontend/mobile bundles or `PUBLIC_*`/`EXPO_PUBLIC_*` env vars. Secrets stay server-side / in edge functions / in a secrets manager.
- **Authorization is enforced at the data layer, not the UI.** Hiding a button is not access control. Enforce with row-level security / server-side ownership checks / policy middleware. Every read and write is authorized as the acting user, least-privilege by default.
- **Validate and sanitize all external input** at the trust boundary (request bodies, query params, uploads, webhook payloads) with a schema. Never interpolate untrusted input into SQL/shell/HTML — use parameterized queries and safe APIs.
- **Fail closed.** Missing/invalid auth → deny. Unknown error → generic message to the client, detail to the logs (never leak stack traces or internal IDs to users).
- **Dependency hygiene.** No unpinned or abandoned packages for security-critical paths; prefer the platform's vetted primitives over hand-rolled crypto/auth.

### Data & backend — migrations are the source of truth
- **The schema is defined by versioned migrations**, checked into the repo. Never hand-edit a production schema or let an ORM "auto-sync" in prod.
- **Every schema change ships with a migration** (and, where the stack supports it, a reversible/down path). A PR that changes a model without a migration is incomplete.
- **Seed data is reproducible** — a documented script brings a fresh environment to a known, working state.
- **No invented schemas.** Reference the actual migration/DDL, not a guess. If the real schema is unknown, find it before writing queries against it.

### Design / UX — distinctive, themed, accessible
- Defer the concrete system to the stack design skill, but hold the bar: a **consistent design system** (tokens, spacing, type scale), **dark/light** support, **accessibility** (labels, roles, contrast, focus/touch targets), and an intentional look — not the generic, recognizably-AI default.

### Agent extensibility — make the codebase legible to the next agent
This is what lets *future* agentic work stay clean instead of "drowning in inconsistent patterns":
- **Predictable structure & naming** so an agent can locate things by convention, not by reading everything.
- **A project memory file (`CLAUDE.md` / `AGENTS.md`)** at the root documenting the architecture, conventions, commands (build/test/lint/migrate), and "where things go". Keep it current.
- **Explicit contracts** (types, zod/pydantic schemas, OpenAPI, interface files) so an agent can reason about a boundary without inferring it.
- **Small files and clear seams** so a subagent can load just the relevant slice into its context.

### Ownership — no black box
- **Document decisions, not just code.** A lightweight decision log / ADR entry for non-obvious choices ("why this auth approach", "why this denormalization"). The goal: a new owner understands *why*, not just *what*.
- **Comments explain intent**, not mechanics. Code says what; comments say why.
- **Open, readable, reproducible.** Anyone can clone, run the documented setup, and get a working app. No undocumented manual steps.

## Definition of Done

A change is done only when all of these hold. This is the checklist the reviewer agents apply — treat it as the gate.

- [ ] Builds, typechecks, and lints clean (no new warnings).
- [ ] Tests cover the new behavior and pass; critical paths have coverage.
- [ ] No secret is reachable from client-shippable code; authz enforced at the data layer.
- [ ] All external input is schema-validated; no string-interpolated SQL/shell/HTML.
- [ ] Any schema change has a migration (+ down path where supported) and seed still works.
- [ ] No god-files, no `any`-typed boundaries, no dead/commented-out code.
- [ ] Public boundaries are typed and contracts unchanged (or intentionally versioned).
- [ ] `CLAUDE.md`/decision log updated if architecture, conventions, or commands changed.
- [ ] `code-reviewer` and (for anything touching auth/data/secrets/input) `security-reviewer` run, and Critical findings resolved.

## Anti-patterns to refuse (the vibecoding tells)

- Secrets, service keys, or admin tokens in frontend/mobile code or public env.
- Authorization "enforced" only by hiding UI.
- Querying a schema you assumed instead of one you verified; model changes without migrations.
- One giant file / function; `any` everywhere; copy-pasted logic instead of a shared, tested unit.
- "It works" with no test, no migration, no doc, and no way for the next person to understand the choices.
- Skipping review/gates because the change "is small".

When a request would require one of these, name the issue and propose the defensible alternative rather than producing the shortcut.

## Relationship to other skills

- **Stack skills** (shadcn/web, Flask/Python, react-native-expo, gluestack-ui, nativewind-styling) provide the concrete idioms; this skill provides the bar and the Definition of Done they all answer to.
- **Reviewer agents** (`code-reviewer`, `security-reviewer`) operationalize this skill as an independent pass. Keep their embedded checklists in sync with the Definition of Done above.
