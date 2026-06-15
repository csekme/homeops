# Anti-Patterns and Self-Review Checklist

This is the spaghetti catalog. Each entry is a smell you must recognize and the
refactor that removes it. End every Flask task by running the checklist at the
bottom — it is the cheapest moment to catch these.

## Table of contents

1. Fat route (business logic in the controller)
2. Database access outside a repository
3. HTTP concerns leaking into a service
4. Returning ORM models to the client
5. Scattered commits / no transaction boundary
6. God service / god blueprint
7. Circular imports
8. Catch-all exception swallowing
9. Conflated input/output schemas
10. Global mutable state
11. The pre-completion self-review checklist

---

## 1. Fat route (business logic in the controller)

**Smell:** a route function with `if`/`for` over business state, calculations,
or multi-step orchestration.

**Why it rots:** the logic can't be reused (e.g. from a CLI command or a
background job), can't be unit-tested without the HTTP stack, and the route
grows every time the rule changes.

**Refactor:** move every business decision into a service method. The route
ends up as parse → validate → call service → serialize.

## 2. Database access outside a repository

**Smell:** `Model.query...`, `db.session.add/commit`, or raw SQL in a route or
service.

**Why it rots:** persistence details spread everywhere; changing the storage
strategy means touching dozens of files; queries get duplicated and drift.

**Refactor:** add an intention-named method to the repository
(`find_active_by_email`) and call it. The service asks for data; it never
queries.

## 3. HTTP concerns leaking into a service

**Smell:** a service imports `request`, calls `jsonify`/`abort`, or returns
status codes / `Response` objects.

**Why it rots:** the business logic is now welded to the web framework — you
can't call it from a job or test it without a request context.

**Refactor:** the service takes plain arguments / a DTO and returns domain
objects; it raises domain exceptions instead of `abort(404)`. The route and the
central error handler own all HTTP translation.

## 4. Returning ORM models to the client

**Smell:** `return jsonify(user.__dict__)` or a model's home-grown `to_dict()`
shaped for one endpoint.

**Why it rots:** every column (including internal/sensitive ones) leaks, the API
contract silently changes whenever the table changes, and lazy relationships
trigger surprise queries during serialization.

**Refactor:** define an explicit output schema and serialize through it. The
schema is the public contract; the model is private.

## 5. Scattered commits / no transaction boundary

**Smell:** `db.session.commit()` called inside repository methods, helpers, and
loops, so a single logical operation commits in several places.

**Why it rots:** partial writes on failure, impossible-to-reason-about
transactions, and broken rollback.

**Refactor:** repositories `add`/`delete`/`flush`; the **service method** is the
single commit point for the unit of work.

## 6. God service / god blueprint

**Smell:** a `UserService` with 30 methods spanning auth, billing, and
notifications; or one blueprint handling unrelated features.

**Why it rots:** every change risks unrelated behavior; the file becomes a merge
magnet; nobody can hold it in their head.

**Refactor:** split along responsibilities (`UserService`, `AuthService`,
`BillingService`); give each feature its own blueprint package.

## 7. Circular imports

**Smell:** module A imports B which imports A — often models ↔ app, or service ↔
service.

**Why it rots:** fragile import order, runtime `ImportError`s, signals an
inverted dependency.

**Refactor:** instantiate extensions in `extensions.py` (not in the app module);
keep imports pointing downward (see `layer-boundaries.md` §7); break a
service↔service cycle by extracting the shared logic into a third service or
passing data instead of importing.

## 8. Catch-all exception swallowing

**Smell:** `except Exception: pass` or `except Exception: return None`.

**Why it rots:** real bugs disappear silently; failures masquerade as empty
results.

**Refactor:** catch the specific exception you can handle; otherwise let it
propagate to the central error handler. Use `logger.exception(...)` when you do
catch, so the traceback is recorded.

## 9. Conflated input/output schemas

**Smell:** one `UserSchema` used for both the create payload and the response.

**Why it rots:** you either accept fields you shouldn't (e.g. client sets `id`
or `is_admin`) or expose fields you shouldn't. The read and write shapes drift
apart over time and the single schema becomes a pile of conditionals.

**Refactor:** separate `CreateUserRequest` / `UpdateUserRequest` /
`UserResponse`. Each is small and says exactly what crosses the boundary.

## 10. Global mutable state

**Smell:** module-level dicts/lists used as caches or to pass data between
requests; mutating `app.config` at runtime.

**Why it rots:** data bleeds across requests, breaks under concurrency, and
makes tests order-dependent.

**Refactor:** keep request-scoped data in the request, shared state in the
database or a proper cache (e.g. Redis) accessed through a repository-like
abstraction.

---

## 11. The pre-completion self-review checklist

Run this before declaring any Flask task done. If any answer is "no", fix it
before finishing — these are exactly the issues that are cheap now and expensive
later.

**Routes**
- [ ] Does each route only parse → validate → call one service → serialize →
      (let errors map)?
- [ ] Is every route free of `db.session`, `Model.query`, and business `if`s?
- [ ] Does each route import only services, schemas, and error helpers (no
      models, no repositories)?

**Services**
- [ ] Is the service free of `request`, `jsonify`, `abort`, `Response`, and
      status codes?
- [ ] Does it raise domain exceptions instead of returning error shapes?
- [ ] Is the commit/rollback (transaction boundary) owned here, not scattered?

**Repositories**
- [ ] Is all database/ORM access confined to repositories?
- [ ] Are repository methods free of business decisions?
- [ ] Do repositories avoid importing services (no upward calls)?

**Schemas & models**
- [ ] Is data returned to the client serialized through an output schema (no raw
      models)?
- [ ] Are input and output schemas separate?
- [ ] Do models hold only persistence + tiny self-contained invariants?

**Quality**
- [ ] Type hints on every function signature?
- [ ] No function obviously over ~40 lines / no route over ~10 lines?
- [ ] No `print()`; logging via `getLogger(__name__)`?
- [ ] No catch-all `except Exception` that hides failures?
- [ ] No hardcoded config/secrets/magic numbers?

**Imports**
- [ ] Do all internal imports point downward (Route→Service→Repository→Model)?

If you cannot satisfy a checklist item without a larger restructure, do the
restructure or tell the user explicitly why the boundary was crossed — do not
quietly ship the violation.
