import bcrypt
import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.security.jwt import hash_password, verify_and_upgrade_password


def test_settings_require_long_jwt_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("CAREERMATE_JWT_SECRET", raising=False)
    with pytest.raises(ValidationError):
        Settings(
            _env_file=None,
            database_url="sqlite+aiosqlite://",
        )


@pytest.mark.parametrize("environment", ["staging", "production"])
def test_deployed_environments_require_shared_postgres_rate_limit_storage(
    environment: str,
) -> None:
    with pytest.raises(ValidationError, match="PostgreSQL"):
        Settings(
            _env_file=None,
            environment=environment,
            database_url="sqlite+aiosqlite://",
            jwt_secret="test-only-secret-that-is-at-least-32-characters",
        )


@pytest.mark.parametrize("environment", ["test", "staging", "production"])
def test_passwordless_demo_login_is_rejected_outside_local(environment: str) -> None:
    with pytest.raises(ValidationError, match="only allowed in the local environment"):
        Settings(
            _env_file=None,
            environment=environment,
            database_url="postgresql+asyncpg://user:pass@localhost/careermate",
            jwt_secret="test-only-secret-that-is-at-least-32-characters",
            demo_login_enabled=True,
        )


def test_new_passwords_are_argon2id() -> None:
    encoded = hash_password("DemoPass123!")
    assert encoded.startswith("$argon2id$")
    assert verify_and_upgrade_password("DemoPass123!", encoded) == (True, None)


def test_legacy_bcrypt_password_is_upgraded_after_verification() -> None:
    legacy = bcrypt.hashpw(b"DemoPass123!", bcrypt.gensalt()).decode()
    valid, upgraded = verify_and_upgrade_password("DemoPass123!", legacy)
    assert valid is True
    assert upgraded is not None and upgraded.startswith("$argon2id$")
    assert "DemoPass123!" not in upgraded


def test_legacy_bcrypt_rejects_password_over_72_bytes_without_raising() -> None:
    legacy = bcrypt.hashpw(b"DemoPass123!", bcrypt.gensalt()).decode()
    assert verify_and_upgrade_password("x" * 73, legacy) == (False, None)
