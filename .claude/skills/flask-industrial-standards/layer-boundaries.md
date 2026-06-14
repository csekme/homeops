# Layer Boundaries

This is the authoritative description of what each layer may and may not do.
When you cannot decide where a piece of code belongs, the answer is here. The
guiding principle: **each layer changes for exactly one reason.** A route
changes when the HTTP contract changes; a service when a business rule changes;
a repository when the persistence strategy changes.

## Table of contents

1. Route (Controller) layer
2. Service layer
3. Repository layer
4. Model layer
5. Schema / DTO layer
6. Cross-cutting concerns
7. The import rule (who may import whom)
8. The delegation rule (who may call whom)

---

## 1. Route (Controller) layer

Lives in `blueprints/<feature>/routes.py`. A route function is glue, not logic.

**May only:**

- Read input from the request (path params, query string, JSON body, headers).
- Validate and coerce that input through an **input schema**.
- Call **exactly one** service method, passing plain values / a validated DTO.
- Serialize the service's return value through an **output schema**.
- Choose the HTTP status code and translate **domain exceptions** raised by the
  service into HTTP error responses (usually via centralized error handlers).

**Must never:**

- Contain business rules or branching on business state (no "if the user's
  balance is below X then...").
- Touch the database: no `Model.query`, no `db.session`, no SQL.
- Import models or repositories directly.
- Call more than one service method to assemble a response — if you need that,
  the orchestration belongs in a service.
- Catch broad exceptions to hide failures.

**Allowed example:**

```python
@users_bp.post("")
def create_user():
    payload = CreateUserRequest.model_validate(request.get_json())
    user = user_service.create_user(payload)          # one service call
    return UserResponse.model_validate(user).model_dump(), 201
```

**Forbidden example (fat route — extract everything below into a service):**

```python
@users_bp.post("")
def create_user():
    data = request.get_json()
    if User.query.filter_by(email=data["email"]).first():   # ❌ DB in route
        return {"error": "exists"}, 409                       # ❌ business rule
    user = User(email=data["email"])                          # ❌ model in route
    db.session.add(user); db.session.commit()                 # ❌ persistence
    return {"id": user.id}, 201
```

---

## 2. Service layer

Lives in `blueprints/<feature>/service.py` (or a `services/` package). This is
where business logic lives. Services are plain Python classes/functions — they
should run in a unit test with no Flask app context where possible.

**May only:**

- Implement business rules, validation that depends on state, and orchestration
  across multiple repositories or other services.
- Own the **transaction boundary**: the service method decides when the unit of
  work commits or rolls back.
- Raise **domain exceptions** (e.g. `UserAlreadyExistsError`,
  `InsufficientFundsError`) to signal business failures.
- Return domain objects, model instances, or DTOs — never HTTP responses.

**Must never:**

- Import or reference Flask request/response machinery: `request`, `jsonify`,
  `abort`, `Response`, `make_response`, or HTTP status codes.
- Build query expressions or call the ORM session directly — delegate to a
  repository.
- Serialize to JSON or shape data specifically for one HTTP endpoint. (Shaping
  for transport is the schema's job.)

**Allowed example:**

```python
class UserService:
    def __init__(self, users: UserRepository) -> None:
        self._users = users

    def create_user(self, data: CreateUserRequest) -> User:
        if self._users.exists_by_email(data.email):
            raise UserAlreadyExistsError(data.email)   # domain exception
        user = User(email=data.email, name=data.name)
        self._users.add(user)
        db.session.commit()                            # transaction boundary
        return user
```

---

## 3. Repository layer

Lives in `blueprints/<feature>/repository.py` (or a `repositories/` package).
This is the **only** place that knows how data is stored and queried.

**May only:**

- Execute queries and persistence operations against the ORM / database.
- Translate between query results and model/domain objects.
- Expose intention-revealing methods (`find_active_by_email`, `add`, `delete`),
  not generic "run this SQL" passthroughs.

**Must never:**

- Contain business rules or decisions (no "if expired, skip" logic — that is a
  service decision; the repository just fetches).
- Call services (that creates a cycle and inverts the dependency direction).
- Commit as a side effect of every method — let the service control the
  transaction. Use `add`/`delete`/`flush`; reserve `commit` for the service or
  a single explicit unit-of-work helper.
- Return raw rows or leak query internals to callers.

**Allowed example:**

```python
class UserRepository:
    def exists_by_email(self, email: str) -> bool:
        return db.session.query(
            User.query.filter_by(email=email).exists()
        ).scalar()

    def add(self, user: User) -> None:
        db.session.add(user)
```

---

## 4. Model layer

Lives in `blueprints/<feature>/models.py` (or a `models/` package). ORM entities
that map to tables.

**May only:**

- Declare columns, relationships, constraints, and indexes.
- Hold tiny, self-contained invariants or computed properties that depend only
  on the entity's own fields (e.g. `full_name`).

**Must never:**

- Contain cross-entity business logic or orchestration (that is a service).
- Query other tables or reach into repositories/services.
- Carry transport/serialization concerns (no `to_json` shaped for one endpoint —
  use a schema).

---

## 5. Schema / DTO layer

Lives in `blueprints/<feature>/schemas.py`. Pydantic (or Marshmallow) models for
**input validation** and **output serialization**. These are the contract
between the HTTP boundary and the inside of the app.

**Responsibilities:**

- Validate and coerce incoming data; reject malformed requests before they reach
  a service.
- Define exactly which fields leave the system — this is your defense against
  leaking internal model columns.
- Keep input and output schemas **separate**. `CreateUserRequest` is not
  `UserResponse`; conflating them couples your write payload to your read shape
  and tends to expose fields you did not intend.

---

## 6. Cross-cutting concerns

- **Extensions** (`extensions.py`): instantiate `db`, `migrate`, etc. once,
  initialize them in the app factory. Never create a second `SQLAlchemy()`.
- **Config** (`config.py`): environment-driven config classes. No secrets or
  environment-specific values hardcoded in application code.
- **Error handlers** (`errors.py`): one place that maps each domain exception
  type to an HTTP status + JSON error body. This is why services can raise plain
  domain exceptions and stay HTTP-agnostic.
- **Logging**: configured centrally; modules get a logger via
  `logging.getLogger(__name__)`. Never `print()`.

---

## 7. The import rule (who may import whom)

Allowed import directions (downward only):

- Route → Service, Schema, error helpers
- Service → Repository, Schema (domain), Model, other Services, domain exceptions
- Repository → Model, extensions (`db`)
- Schema → (nothing internal; only validation primitives)

**Forbidden imports** (each indicates a boundary violation):

- Route imports Model → business/persistence leaking up
- Route imports Repository → skipping the service layer
- Service imports `flask.request` / `jsonify` / `abort` → HTTP leaking down
- Repository imports Service → dependency cycle / inverted direction
- Model imports Service or Repository → entity doing orchestration

When you write an `import`, ask: "is this arrow pointing downward?" If not, the
code is in the wrong layer.

## 8. The delegation rule (who may call whom)

- A route delegates to **one** service entry point per action. Need two? The
  composition is a new service method.
- A service may compose **other services** and **repositories**. It coordinates;
  it does not reach around them.
- A repository calls **nothing** in the layers above it. It is a leaf.

Delegation is the heart of "responsibility boundaries": each layer hands off the
work it is not responsible for, rather than doing it inline. That hand-off is
what keeps every component small, testable, and replaceable.
