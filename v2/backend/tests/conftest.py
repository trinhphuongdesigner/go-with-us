import os
from collections.abc import AsyncGenerator

os.environ.setdefault("CAREERMATE_ENVIRONMENT", "test")
os.environ.setdefault("CAREERMATE_DATABASE_URL", "sqlite+aiosqlite://")
os.environ.setdefault("CAREERMATE_TEST_DATABASE_URL", "sqlite+aiosqlite://")
os.environ.setdefault("CAREERMATE_JWT_SECRET", "test-only-secret-that-is-at-least-32-characters")

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool, StaticPool

from app.api.v2.auth import get_login_rate_limiter
from app.core.config import get_settings
from app.core.database import get_db
from app.domain.models import Base
from app.main import app
from app.security.rate_limit import (
    InMemoryLoginRateLimiter,
    PostgresLoginRateLimiter,
    derive_rate_limit_secret,
)


def _validated_test_database_url(raw_url: str) -> str:
    """Fail closed before a destructive fixture can connect to the wrong database."""

    parsed = make_url(raw_url)
    if parsed.query:
        raise RuntimeError("Refusing destructive tests with database URL query overrides")

    if parsed.drivername == "sqlite+aiosqlite":
        if parsed.database not in {None, "", ":memory:"} or parsed.host is not None:
            raise RuntimeError("Refusing destructive tests outside an in-memory SQLite database")
        return raw_url

    if parsed.drivername == "postgresql+asyncpg":
        if parsed.database != "careermate_v2_test" or parsed.host not in {
            "127.0.0.1",
            "localhost",
            "::1",
        }:
            raise RuntimeError("Refusing destructive tests outside local careermate_v2_test")
        return raw_url

    raise RuntimeError("Refusing destructive tests for an unsupported database URL")


test_database_url = _validated_test_database_url(os.environ["CAREERMATE_TEST_DATABASE_URL"])
os.environ["CAREERMATE_ENVIRONMENT"] = "test"
os.environ["CAREERMATE_DATABASE_URL"] = test_database_url
engine_options: dict[str, object] = {}
if test_database_url.startswith("sqlite"):
    engine_options = {
        "connect_args": {"check_same_thread": False},
        "poolclass": StaticPool,
    }
else:
    engine_options = {"poolclass": NullPool}
engine = create_async_engine(test_database_url, **engine_options)
testing_session = async_sessionmaker(engine, expire_on_commit=False)


async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
    async with testing_session() as session:
        yield session


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
async def reset_db() -> AsyncGenerator[None, None]:
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
        # The dedicated test database may be shared by sequential quality-gate
        # runs. Clear rows in FK-safe order without destructive schema DDL.
        # This keeps the suite inside the project's no-drop/no-truncate guard.
        for table in reversed(Base.metadata.sorted_tables):
            await connection.execute(table.delete())
    settings = get_settings()
    secret = derive_rate_limit_secret(settings.jwt_secret.get_secret_value())
    if test_database_url.startswith("postgresql"):
        limiter = PostgresLoginRateLimiter(
            testing_session,
            settings.login_rate_limit_attempts,
            settings.login_rate_limit_ip_attempts,
            settings.login_rate_limit_window_seconds,
            key_hmac_secret=secret,
        )
    else:
        limiter = InMemoryLoginRateLimiter(
            settings.login_rate_limit_attempts,
            settings.login_rate_limit_window_seconds,
            settings.login_rate_limit_max_keys,
            ip_max_attempts=settings.login_rate_limit_ip_attempts,
            key_hmac_secret=secret,
        )
    app.dependency_overrides[get_login_rate_limiter] = lambda: limiter
    yield
    app.dependency_overrides.pop(get_login_rate_limiter, None)


@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as api_client:
        yield api_client


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with testing_session() as session:
        yield session
