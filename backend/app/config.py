"""Environment-driven configuration (plan §3.1, §14). Selected by ``APP_ENV``.

Instances read ``os.environ`` at construction time (after ``load_dotenv``), so tests can
inject values (e.g. a Testcontainers ``DATABASE_URL``) via ``create_app(overrides=...)``.
"""

from __future__ import annotations

import os

# Dev-only placeholder secrets. They MUST NOT be used in production — ``ProductionConfig``
# fails fast if they survive into a prod boot (plan §7.4: "titok nem a kódban").
_DEV_JWT_SECRET = "dev-only-change-me"  # noqa: S105 — placeholder, rejected in prod
_DEV_SECRET_KEK = "aG9tZW9wc19kZXZfa2VrXzAxMjM0NTY3ODlhYmNkZWY="  # noqa: S105 — see above
# HS256 needs a key of at least the hash output size (32 bytes) to be sound (RFC 7518 §3.2).
_MIN_JWT_SECRET_BYTES = 32


def _bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or raw == "":
        return default
    return int(raw)


class Config:
    """Base config. Subclasses tweak per-environment defaults."""

    ENV_NAME = "base"
    TESTING = False
    DEBUG = False

    def __init__(self) -> None:
        # Database (app role: non-superuser, non-BYPASSRLS — plan §3.6).
        self.DATABASE_URL = os.environ.get(
            "DATABASE_URL",
            "postgresql+psycopg://homeops_app:homeops_app@localhost:5432/homeops",
        )
        self.MIGRATION_DATABASE_URL = os.environ.get(
            "MIGRATION_DATABASE_URL",
            "postgresql+psycopg://homeops:homeops@localhost:5432/homeops",
        )

        # Access JWT (plan §3.5c).
        self.JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", _DEV_JWT_SECRET)
        self.ACCESS_TOKEN_TTL_MINUTES = _int("ACCESS_TOKEN_TTL_MINUTES", 15)
        self.REFRESH_TOKEN_TTL_DAYS = _int("REFRESH_TOKEN_TTL_DAYS", 30)
        # "Remember me" off → a short-lived session (browser-session cookie + short refresh
        # TTL); the DB expiry is the real enforcement, the session cookie only UX
        # (feature plan §Device registration + remember me).
        self.SHORT_REFRESH_TTL_DAYS = _int("SHORT_REFRESH_TTL_DAYS", 1)
        # How long a remembered, 2FA-passed device may skip the TOTP step on a fresh login.
        self.DEVICE_TRUST_TTL_DAYS = _int("DEVICE_TRUST_TTL_DAYS", 30)
        # 2FA login challenge token — short-lived bridge between the password check and the
        # TOTP/backup-code step (feature plan §Backend.7).
        self.MFA_CHALLENGE_TTL_MINUTES = _int("MFA_CHALLENGE_TTL_MINUTES", 5)

        # Argon2id (plan §3.5a) — memory cost in KiB; ≥ 65536 = 64 MiB.
        self.ARGON2_MEMORY_COST = _int("ARGON2_MEMORY_COST", 65536)
        self.ARGON2_TIME_COST = _int("ARGON2_TIME_COST", 3)
        self.ARGON2_PARALLELISM = _int("ARGON2_PARALLELISM", 2)

        # Activation flow (plan §3.5b).
        self.ACTIVATION_TOKEN_TTL_HOURS = _int("ACTIVATION_TOKEN_TTL_HOURS", 24)
        self.PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", "https://homeops.localhost")

        # Password reset flow (feature plan §#1). Short-lived by design.
        self.PASSWORD_RESET_TOKEN_TTL_HOURS = _int("PASSWORD_RESET_TOKEN_TTL_HOURS", 1)

        # Household invitation flow (feature plan §Backend).
        self.INVITATION_TOKEN_TTL_HOURS = _int("INVITATION_TOKEN_TTL_HOURS", 168)

        # SMTP (plan §3.7).
        self.SMTP_HOST = os.environ.get("SMTP_HOST", "localhost")
        self.SMTP_PORT = _int("SMTP_PORT", 1025)
        self.SMTP_USE_TLS = _bool(os.environ.get("SMTP_USE_TLS"), False)
        self.SMTP_USERNAME = os.environ.get("SMTP_USERNAME") or None
        self.SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD") or None
        self.MAIL_FROM = os.environ.get("MAIL_FROM", "HomeOps <no-reply@homeops.localhost>")
        self.MAIL_DEFAULT_LOCALE = os.environ.get("MAIL_DEFAULT_LOCALE", "hu")

        # SecretCipher KEK (plan §10.5) — base64 32-byte key.
        self.SECRET_KEK = os.environ.get("SECRET_KEK", _DEV_SECRET_KEK)

        # OpenAPI docs visibility (plan §3.8 / spec §7.4).
        self.ENABLE_API_DOCS = _bool(os.environ.get("ENABLE_API_DOCS"), True)

        # Auth cookies: Secure off only where there is no TLS (local tests).
        self.AUTH_COOKIE_SECURE = _bool(os.environ.get("AUTH_COOKIE_SECURE"), True)
        # Refresh cookie scoped to the auth path (HttpOnly, only sent to /api/auth/*).
        self.AUTH_COOKIE_PATH = os.environ.get("AUTH_COOKIE_PATH", "/api/auth")
        # CSRF cookie MUST be readable by the SPA's JS at "/" (double-submit) → Path=/.
        self.CSRF_COOKIE_PATH = os.environ.get("CSRF_COOKIE_PATH", "/")

        # Rate limiting (plan §3.5f). Redis URL in prod for shared limits.
        self.RATELIMIT_STORAGE_URI = os.environ.get("RATELIMIT_STORAGE_URI", "memory://")
        self.RATELIMIT_ENABLED = _bool(os.environ.get("RATELIMIT_ENABLED"), True)


class DevelopmentConfig(Config):
    ENV_NAME = "development"
    DEBUG = True


class TestingConfig(Config):
    ENV_NAME = "testing"
    TESTING = True

    def __init__(self) -> None:
        super().__init__()
        self.ENABLE_API_DOCS = True
        self.AUTH_COOKIE_SECURE = False  # the test client speaks plain HTTP
        self.RATELIMIT_STORAGE_URI = "memory://"
        self.RATELIMIT_ENABLED = False  # don't let limits flake the suite


class ProductionConfig(Config):
    ENV_NAME = "production"

    def __init__(self) -> None:
        super().__init__()
        # Interactive docs off by default in prod (spec §7.4 security misconfiguration).
        self.ENABLE_API_DOCS = _bool(os.environ.get("ENABLE_API_DOCS"), False)
        self._assert_real_secrets()

    def _assert_real_secrets(self) -> None:
        """Refuse to boot prod with the dev placeholder/weak secrets (plan §7.4).

        A silent fallback to the in-repo dev JWT key or KEK would let anyone forge access
        tokens or unwrap stored secrets, so this is a hard, fail-fast error.
        """
        errors: list[str] = []
        if self.JWT_SECRET_KEY == _DEV_JWT_SECRET:
            errors.append("JWT_SECRET_KEY is still the dev placeholder")
        elif len(self.JWT_SECRET_KEY.encode("utf-8")) < _MIN_JWT_SECRET_BYTES:
            errors.append(
                f"JWT_SECRET_KEY must be at least {_MIN_JWT_SECRET_BYTES} bytes for HS256"
            )
        if self.SECRET_KEK == _DEV_SECRET_KEK:
            errors.append("SECRET_KEK is still the dev placeholder")
        if errors:
            raise RuntimeError(
                "Insecure production configuration: " + "; ".join(errors) + ". "
                "Set strong, unique values via the environment."
            )


_CONFIGS: dict[str, type[Config]] = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}


def get_config(app_env: str | None = None) -> Config:
    env = (app_env or os.environ.get("APP_ENV") or "development").lower()
    return _CONFIGS.get(env, DevelopmentConfig)()
