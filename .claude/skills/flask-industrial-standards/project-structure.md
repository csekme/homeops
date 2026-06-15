# Project Structure

This is the canonical layout. Scaffold it once; then every feature is a new
package that follows the same internal shape. Consistency is the point — a
developer (or agent) opening any feature folder finds the same five files doing
the same five jobs.

## Table of contents

1. Directory layout
2. The application factory
3. Extensions module
4. Configuration classes
5. Blueprint registration
6. A full vertical slice: the `users` feature
7. Centralized error handling

---

## 1. Directory layout

Organize **by feature** (vertical slices), not by technical type. A
feature owns its routes, service, repository, models, and schemas together.

```
project/
├── app/
│   ├── __init__.py            # create_app() factory
│   ├── extensions.py          # db, migrate, etc. (single instances)
│   ├── config.py              # config classes (env-driven)
│   ├── errors.py              # domain exception → HTTP mapping
│   ├── exceptions.py          # base domain exception types
│   └── blueprints/
│       ├── __init__.py        # register_blueprints(app)
│       └── users/
│           ├── __init__.py
│           ├── routes.py      # thin HTTP layer (controller)
│           ├── service.py     # business logic
│           ├── repository.py  # all DB access
│           ├── models.py      # ORM entities
│           └── schemas.py     # pydantic input/output DTOs
├── migrations/                # Flask-Migrate
├── tests/
│   ├── unit/                  # service tests (repository mocked)
│   ├── integration/           # repository tests (real DB)
│   └── api/                   # route tests (full stack)
├── wsgi.py                    # entrypoint: app = create_app()
├── pyproject.toml
└── .env.example
```

Why feature-first: when you add "orders", you create `blueprints/orders/` with
the same five files. You never hunt across a giant `models/`, `services/`, and
`controllers/` tree to understand one feature.

---

## 2. The application factory

Never use a module-level global `app`. The factory makes the app testable
(create a fresh app per test with test config) and avoids import-time side
effects.

```python
# app/__init__.py
from flask import Flask

from app.config import Config
from app.extensions import db, migrate
from app.blueprints import register_blueprints
from app.errors import register_error_handlers


def create_app(config_class: type[Config] = Config) -> Flask:
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    migrate.init_app(app, db)

    register_blueprints(app)
    register_error_handlers(app)

    return app
```

```python
# wsgi.py
from app import create_app

app = create_app()
```

---

## 3. Extensions module

Instantiate each extension exactly once, with no app bound. The factory binds
them. This breaks the classic circular-import trap (models import `db`, the app
imports models).

```python
# app/extensions.py
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate

db = SQLAlchemy()
migrate = Migrate()
```

---

## 4. Configuration classes

Config is environment-driven. Application code reads `app.config[...]`; it never
reads `os.environ` directly or hardcodes environment values.

```python
# app/config.py
import os


class Config:
    SECRET_KEY = os.environ["SECRET_KEY"]
    SQLALCHEMY_DATABASE_URI = os.environ["DATABASE_URL"]
    SQLALCHEMY_TRACK_MODIFICATIONS = False


class TestConfig(Config):
    SECRET_KEY = "test"  # noqa: S105 — test-only
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    TESTING = True
```

---

## 5. Blueprint registration

One place that knows about every blueprint. Adding a feature = one line here.

```python
# app/blueprints/__init__.py
from flask import Flask

from app.blueprints.users.routes import users_bp


def register_blueprints(app: Flask) -> None:
    app.register_blueprint(users_bp, url_prefix="/api/users")
```

---

## 6. A full vertical slice: the `users` feature

This shows every layer wired together for a simple "create + get user" feature.
Use it as the template for any new feature.

```python
# app/blueprints/users/models.py
from app.extensions import db


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    name = db.Column(db.String(120), nullable=False)

    @property
    def display_name(self) -> str:        # tiny self-contained invariant: OK
        return self.name or self.email
```

```python
# app/blueprints/users/schemas.py
from pydantic import BaseModel, ConfigDict, EmailStr


class CreateUserRequest(BaseModel):       # input contract
    email: EmailStr
    name: str


class UserResponse(BaseModel):            # output contract (separate!)
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: EmailStr
    name: str
```

```python
# app/blueprints/users/repository.py
from app.extensions import db
from app.blueprints.users.models import User


class UserRepository:
    def get(self, user_id: int) -> User | None:
        return db.session.get(User, user_id)

    def exists_by_email(self, email: str) -> bool:
        return db.session.query(
            User.query.filter_by(email=email).exists()
        ).scalar()

    def add(self, user: User) -> None:
        db.session.add(user)
```

```python
# app/blueprints/users/service.py
from app.extensions import db
from app.blueprints.users.models import User
from app.blueprints.users.repository import UserRepository
from app.blueprints.users.schemas import CreateUserRequest
from app.exceptions import NotFoundError, ConflictError


class UserService:
    def __init__(self, users: UserRepository | None = None) -> None:
        self._users = users or UserRepository()

    def create_user(self, data: CreateUserRequest) -> User:
        if self._users.exists_by_email(data.email):
            raise ConflictError(f"User with email {data.email} already exists")
        user = User(email=data.email, name=data.name)
        self._users.add(user)
        db.session.commit()              # service owns the transaction
        return user

    def get_user(self, user_id: int) -> User:
        user = self._users.get(user_id)
        if user is None:
            raise NotFoundError(f"User {user_id} not found")
        return user
```

```python
# app/blueprints/users/routes.py
from flask import Blueprint, request

from app.blueprints.users.service import UserService
from app.blueprints.users.schemas import CreateUserRequest, UserResponse

users_bp = Blueprint("users", __name__)
_service = UserService()


@users_bp.post("")
def create_user():
    payload = CreateUserRequest.model_validate(request.get_json())
    user = _service.create_user(payload)
    return UserResponse.model_validate(user).model_dump(), 201


@users_bp.get("/<int:user_id>")
def get_user(user_id: int):
    user = _service.get_user(user_id)
    return UserResponse.model_validate(user).model_dump(), 200
```

Notice: the routes have **zero** business logic and **zero** DB access. The
service has **zero** HTTP awareness. The repository has **zero** business rules.
That separation is the whole deliverable.

For larger apps, replace the `_service = UserService()` module global with a
dependency-injection approach (a factory function, or a lightweight container
attached to `app.extensions`) so services and repositories can be swapped in
tests. The boundaries stay the same; only the wiring changes.

---

## 7. Centralized error handling

Because services raise domain exceptions instead of returning HTTP responses,
one module maps those exceptions to status codes. This is what lets the service
layer stay HTTP-agnostic.

```python
# app/exceptions.py
class DomainError(Exception):
    """Base class for business/domain errors."""


class NotFoundError(DomainError):
    pass


class ConflictError(DomainError):
    pass


class ValidationError(DomainError):
    pass
```

```python
# app/errors.py
from flask import Flask, jsonify
from pydantic import ValidationError as PydanticValidationError

from app.exceptions import NotFoundError, ConflictError, ValidationError


def register_error_handlers(app: Flask) -> None:
    @app.errorhandler(NotFoundError)
    def _not_found(e: NotFoundError):
        return jsonify(error=str(e)), 404

    @app.errorhandler(ConflictError)
    def _conflict(e: ConflictError):
        return jsonify(error=str(e)), 409

    @app.errorhandler(ValidationError)
    def _domain_validation(e: ValidationError):
        return jsonify(error=str(e)), 422

    @app.errorhandler(PydanticValidationError)
    def _schema_validation(e: PydanticValidationError):
        return jsonify(error="Invalid request", details=e.errors()), 400
```

Add a handler per domain exception type. The route stays clean: it just calls
the service and lets a raised exception bubble to the matching handler.
