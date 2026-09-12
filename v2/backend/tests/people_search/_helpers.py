"""Shared engine/fixtures for people_search tests.

Kept out of conftest.py because pytest imports conftest.py through its own
plugin loader while test modules import fixtures via a normal dotted import;
those are two different import paths and previously produced two distinct
module instances (and thus two SQLite engines) for the same file. Plain
module + explicit import from both conftest.py and test files avoids that.

Mirrors DB safety pattern in tests/conftest.py: in-memory SQLite only.
"""

from __future__ import annotations

import os
from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta

os.environ.setdefault("CAREERMATE_ENVIRONMENT", "test")
os.environ.setdefault("CAREERMATE_DATABASE_URL", "sqlite+aiosqlite://")
os.environ.setdefault("CAREERMATE_JWT_SECRET", "test-only-secret-that-is-at-least-32-characters")
# Never let a real Madison key from an ambient .env leak into tests -- this
# suite must never make a real network call. Explicitly blank it out (not
# setdefault) so it wins over any .env-loaded value too.
os.environ["CAREERMATE_MADISON_API_KEY"] = ""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.api.v2.auth import get_login_rate_limiter
from app.core.database import Base, get_db
from app.domain.enums import EmploymentStatus, Role
from app.domain.models import Company, Employment, User
from app.people_search.app import app
from app.repositories.user_repo import CompanyRepository, UserRepository
from app.security.jwt import hash_password
from app.security.rate_limit import InMemoryLoginRateLimiter, derive_rate_limit_secret

engine = create_async_engine(
    "sqlite+aiosqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
session_factory = async_sessionmaker(engine, expire_on_commit=False)


async def _override_get_db() -> AsyncGenerator[AsyncSession, None]:
    async with session_factory() as session:
        yield session


app.dependency_overrides[get_db] = _override_get_db
app.dependency_overrides[get_login_rate_limiter] = lambda: InMemoryLoginRateLimiter(
    100, 60, 1000, ip_max_attempts=100, key_hmac_secret=derive_rate_limit_secret("test-secret")
)


@pytest.fixture(autouse=True)
async def reset_db() -> AsyncGenerator[None, None]:
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
        await connection.run_sync(Base.metadata.create_all)
    yield


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with session_factory() as session:
        yield session


@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as api_client:
        yield api_client


async def create_company(db: AsyncSession, name: str = "Acme") -> Company:
    company = await CompanyRepository(db).add(Company(name=name))
    await db.flush()
    return company


async def create_user(
    db: AsyncSession,
    *,
    email: str,
    password: str,
    company: Company,
    role: Role = Role.EMPLOYEE,
    admin_permissions: list[str] | None = None,
    job_title: str = "Kỹ sư phần mềm",
) -> User:
    user = User(
        email=email,
        name=email.split("@", maxsplit=1)[0],
        job_title=job_title,
        hashed_password=hash_password(password),
        role=role,
        company_id=company.id,
        admin_permissions=admin_permissions or [],
    )
    await UserRepository(db).add(user)
    await db.commit()
    return user


async def create_employment(
    db: AsyncSession,
    *,
    user: User,
    company: Company,
    title: str,
    years_ago_start: float,
    years_ago_end: float | None = None,
) -> Employment:
    now = datetime.now(UTC)
    employment = Employment(
        user_id=user.id,
        company_id=company.id,
        title=title,
        start_date=now - timedelta(days=int(years_ago_start * 365.25)),
        end_date=now - timedelta(days=int(years_ago_end * 365.25)) if years_ago_end else None,
        status=EmploymentStatus.ACTIVE if years_ago_end is None else EmploymentStatus.ENDED,
    )
    db.add(employment)
    await db.commit()
    return employment


async def login_token(client: AsyncClient, email: str, password: str) -> str:
    response = await client.post(
        "/api/v2/auth/login", json={"email": email, "password": password}
    )
    assert response.status_code == 200, response.text
    token: str = response.json()["accessToken"]
    return token
