# Code Quality Standards

Layering keeps the architecture clean; these rules keep each function clean.
They are the line-level standards that prevent a well-structured app from
filling up with unreadable functions.

## Type hints

Annotate every function signature — parameters and return type. Type hints are
the cheapest form of documentation and let static analysis catch boundary
violations (e.g. a service accidentally returning a Flask `Response`).

```python
def get_user(self, user_id: int) -> User:        # ✅
def get_user(self, user_id):                      # ❌ no contract
```

Use `X | None` for optionals, precise collection types (`list[User]`, not
`list`), and domain types in signatures rather than `dict`/`Any` where a schema
or model exists.

## Function and class size

- A function that no longer fits on one screen (~40 lines) is doing too much —
  extract helpers or push logic into the appropriate layer.
- A route function over ~10 lines almost always has logic that belongs in a
  service. Treat length as a smell detector.
- A service class accumulating unrelated methods is becoming a god object. Split
  it along the responsibilities it has grown (e.g. `UserService` vs
  `UserAuthService`).

## Single responsibility, explicitly

Each function does one thing and its name says what. If you need "and" to
describe what a function does (`create_and_notify_user`), that is two
responsibilities — usually a service method that orchestrates two narrower
calls.

## Naming

- Repository methods reveal intent and the query, not the mechanism:
  `find_active_by_email`, not `query_users`.
- Service methods are named for the business action: `register_user`,
  `transfer_funds`.
- Schemas say direction: `CreateUserRequest` / `UserResponse`.
- Booleans read as predicates: `is_active`, `has_access`.
- No abbreviations that aren't domain-standard; no single-letter names outside
  tiny comprehensions.

## Error handling

- Define a **domain exception hierarchy** (`DomainError` base, then
  `NotFoundError`, `ConflictError`, etc.). Services raise these; the central
  error handler maps them to HTTP.
- **Never catch bare `Exception`** to swallow errors. Catch the specific type
  you can actually handle, and let the rest propagate to the error handler.
- Do not return error dicts/tuples as control flow from services. Raise. Mixing
  "sometimes return a value, sometimes return an error shape" makes callers
  guess.
- Validate inputs at the boundary (schema) so services can assume well-formed
  data and focus on business rules.

```python
# ❌ swallows everything, hides bugs
try:
    return self._users.get(user_id)
except Exception:
    return None

# ✅ specific, or let it propagate to the handler
user = self._users.get(user_id)
if user is None:
    raise NotFoundError(f"User {user_id} not found")
return user
```

## Logging

- Configure logging centrally; obtain a logger per module:
  `logger = logging.getLogger(__name__)`.
- **Never use `print()`** for diagnostics.
- Log at the right level: `debug` for development detail, `info` for business
  events, `warning` for recoverable anomalies, `error`/`exception` for failures
  (use `logger.exception(...)` inside an `except` to capture the traceback).
- Never log secrets, full request bodies with credentials, or PII.

## Configuration

- All environment-specific values come from config (env-driven config classes).
  No hardcoded URLs, hosts, credentials, feature flags, or magic numbers in
  application code.
- Extract magic numbers/strings into named constants or config. `if balance <
  1000` should be `if balance < MINIMUM_BALANCE`.

## Database discipline

- Define indexes and constraints on models, not implicitly through queries.
- Be deliberate about relationship loading to avoid N+1 queries (eager-load in
  the repository when a service needs related data).
- One transaction per service action; do not commit inside loops unless that is
  the deliberate batching strategy.

## Testing strategy (mirror the layers)

Each layer is tested at the right level — this is the payoff of the boundaries.

- **Unit tests (services):** the bulk of your tests. Because services don't
  touch Flask, instantiate the service with a **mocked repository** and assert
  business behavior and exceptions. Fast, no app context, no database.
- **Integration tests (repositories):** run against a real (test) database to
  verify queries actually work. Use `TestConfig` with an in-memory SQLite or a
  disposable Postgres.
- **API tests (routes):** use Flask's test client against the full stack to
  verify status codes, serialization, and error mapping — not business edge
  cases (those are covered cheaply at the service level).

```python
def test_create_user_rejects_duplicate_email():
    repo = Mock(spec=UserRepository)
    repo.exists_by_email.return_value = True
    service = UserService(users=repo)

    with pytest.raises(ConflictError):
        service.create_user(CreateUserRequest(email="a@b.com", name="A"))
```

If a service is hard to unit-test without a real app or database, that is a
signal a boundary has leaked — usually HTTP or ORM concerns crept into the
service. Fix the boundary, not the test.
