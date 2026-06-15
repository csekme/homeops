---
name: flask-industrial-standards
description: >-
  Enforces production-grade architecture, layering, and responsibility
  boundaries when writing or modifying Python Flask applications. Use this
  skill WHENEVER the task involves Flask — creating routes/endpoints,
  blueprints, services, database access with SQLAlchemy, request validation,
  building a REST API, or refactoring existing Flask code — even if the user
  does not say "industrial standards" or "clean architecture". The whole point
  is to STOP the agent from producing spaghetti: business logic in routes,
  ORM queries scattered everywhere, fat controllers, god objects, leaked
  database models, and tangled imports. If you are about to write a Flask
  route that does more than parse-validate-delegate-serialize, this skill must
  drive your decisions. Trigger it for both greenfield Flask work and edits to
  an existing Flask codebase.
---

# Flask Industrial Standards

This skill makes you build Flask applications the way a senior team would in a
regulated, long-lived codebase: strict layering, one responsibility per
component, and hard import boundaries between layers. The enemy is the "fat
route" — an endpoint that validates, runs business rules, queries the database,
and serializes a response all in one function. That is how Flask codebases rot.

You enforce a layered architecture analogous to Controller → Service →
Repository → Entity. Each layer has exactly one job and is forbidden from
reaching into the others' responsibilities.

## The non-negotiable mental model

Every request flows strictly downward through these layers, and data flows back
up. A layer may only call the layer directly below it (a service may call other
services; nothing else skips a level).

```
HTTP Route (Blueprint)   ← parse, validate, delegate to ONE service, serialize, map errors
        │
        ▼
Service                  ← business logic, orchestration, owns the transaction boundary
        │
        ▼
Repository               ← all database/ORM access lives here, nothing else
        │
        ▼
Model (ORM entity)       ← persistence mapping only
```

Cross-cutting (not in the vertical flow): **Schemas/DTOs** (validation +
serialization), **extensions** (db, migrate, etc.), **config**, **error
handlers**, **logging**.

## The five rules you never break

1. **Routes contain no business logic and no database access.** A route may
   only: read the request, validate input with a schema, call exactly one
   service method, serialize the result with a schema, and translate domain
   exceptions into HTTP responses. If a route body has an `if` that makes a
   business decision, or touches `db.session` / a model query, it is wrong.

2. **All database access lives in repositories.** No `Model.query...`,
   `db.session.add/commit`, or raw SQL anywhere except a repository class.
   Services and routes ask repositories for data; they never query directly.

3. **Services never know about HTTP.** A service must not import or return
   `request`, `jsonify`, `abort`, `Response`, or status codes. It works with
   plain arguments and domain objects, and signals problems by raising domain
   exceptions. This keeps business logic testable and reusable.

4. **Never return ORM models to the client.** Always serialize through an
   output schema. Returning models directly leaks internal columns, couples the
   API to the database shape, and creates lazy-loading bugs.

5. **One service owns one transaction.** The service method is the transaction
   boundary — it commits or rolls back. Repositories add/query/delete but do not
   sprinkle `commit()` calls; that fragments the unit of work.

If a requested change would force you to break one of these rules, stop and
restructure instead — extract a service, add a repository method, introduce a
schema. Do not "just put it in the route to keep it simple". That decision is
exactly what produces spaghetti six months later.

## Workflow for any Flask task

Follow this order. It prevents you from starting in the route and back-filling
structure.

1. **Locate the layer that owns the change.** New business rule → service. New
   query → repository. New field exposed → schema. New endpoint → a thin route
   plus whatever services/repositories it delegates to. Read
   `references/layer-boundaries.md` if you are unsure where something belongs.

2. **Check the project structure.** New code goes into the correct module
   (app factory + blueprints + per-feature packages). If the project has no such
   structure yet, create it from `references/project-structure.md` before adding
   features. Do not bolt features onto a flat `app.py`.

3. **Write top-down but think bottom-up.** Define the schema (input/output),
   then the repository method, then the service method, then the thin route that
   wires them. Each piece should be independently readable.

4. **Self-review against the checklist** in `references/anti-patterns.md` before
   you consider the task done. This catches the smells (fat route, god service,
   leaked model, scattered commits) while they are cheap to fix.

## Default stack (state assumptions, adapt on request)

Unless the existing codebase or the user says otherwise, assume:

- **App factory + Blueprints** for structure (never a single global `app`).
- **SQLAlchemy** (Flask-SQLAlchemy) for the ORM, **Flask-Migrate** for
  migrations.
- **Pydantic v2** for request/response schemas (DTOs). Marshmallow is an
  equally valid alternative — match whatever the codebase already uses.
- **REST** JSON API conventions.
- **pytest** with tests mirroring the layer structure.

When you make a stack choice that the user did not specify, state it briefly in
your response so they can redirect.

## Reference files — read the relevant one before writing code

- **`references/layer-boundaries.md`** — The exact responsibilities and the
  forbidden imports/operations for each layer, with allowed/forbidden examples.
  Read this when deciding where code belongs or when a boundary feels blurry.
- **`references/project-structure.md`** — The canonical directory layout, the
  application factory, blueprint registration, config classes, the extensions
  module, and a full vertical slice (a `users` feature) showing every layer
  wired together. Read this when scaffolding a project or adding a feature.
- **`references/code-quality.md`** — Type hints, function size, naming, error
  hierarchy, logging, configuration, and the testing strategy per layer. Read
  this for the line-level standards.
- **`references/anti-patterns.md`** — A catalog of spaghetti smells with
  before/after refactors, plus the pre-completion self-review checklist. Read
  this when refactoring and always run the checklist before finishing.
