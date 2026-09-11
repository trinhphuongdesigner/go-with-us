import asyncio
from collections.abc import Callable
from datetime import UTC, datetime, timedelta

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from app.api.v2.auth import get_login_rate_limiter
from app.domain.enums import Role
from app.domain.models import Company, LoginRateLimit, User
from app.main import app
from app.repositories.user_repo import CompanyRepository, UserRepository
from app.security.jwt import hash_password
from app.security.rate_limit import (
    InMemoryLoginRateLimiter,
    PostgresLoginRateLimiter,
    RateLimiterUnavailable,
)
from app.services.auth_service import AuthService


class FakeClock:
    def __init__(self) -> None:
        self.now = 1_000.0

    def __call__(self) -> float:
        return self.now


async def create_login_user(db: AsyncSession, email: str, password: str) -> None:
    company = await CompanyRepository(db).add(Company(name=f"Company for {email}"))
    await db.flush()
    await UserRepository(db).add(
        User(
            email=email,
            name="Rate limit user",
            hashed_password=hash_password(password),
            role=Role.EMPLOYEE,
            company_id=company.id,
        )
    )
    await db.commit()


@pytest.fixture
def limiter_override() -> Callable[[InMemoryLoginRateLimiter], None]:
    def install(limiter: InMemoryLoginRateLimiter) -> None:
        app.dependency_overrides[get_login_rate_limiter] = lambda: limiter

    yield install
    app.dependency_overrides.pop(get_login_rate_limiter, None)


@pytest.mark.asyncio
async def test_login_burst_returns_429_with_retry_after(
    client: AsyncClient,
    limiter_override: Callable[[InMemoryLoginRateLimiter], None],
) -> None:
    clock = FakeClock()
    limiter_override(InMemoryLoginRateLimiter(2, 60, 100, clock=clock))

    for _ in range(2):
        response = await client.post(
            "/api/v2/auth/login",
            json={"email": "BURST@example.dev", "password": "WrongPass123!"},
        )
        assert response.status_code == 401

    blocked = await client.post(
        "/api/v2/auth/login",
        json={"email": " burst@EXAMPLE.dev ", "password": "WrongPass123!"},
    )
    assert blocked.status_code == 429
    assert blocked.headers["Retry-After"] == "60"

    other_ip_transport = ASGITransport(app=app, client=("198.51.100.8", 123))
    async with AsyncClient(transport=other_ip_transport, base_url="http://test") as other_ip:
        account_wide_block = await other_ip.post(
            "/api/v2/auth/login",
            json={"email": "burst@example.dev", "password": "WrongPass123!"},
        )
    assert account_wide_block.status_code == 429


@pytest.mark.asyncio
async def test_login_unique_emails_are_limited_for_one_ip(
    client: AsyncClient,
    limiter_override: Callable[[InMemoryLoginRateLimiter], None],
) -> None:
    limiter_override(InMemoryLoginRateLimiter(2, 60, 100, ip_max_attempts=2))

    for index in range(2):
        response = await client.post(
            "/api/v2/auth/login",
            json={"email": f"unknown-{index}@example.dev", "password": "WrongPass123!"},
        )
        assert response.status_code == 401

    blocked = await client.post(
        "/api/v2/auth/login",
        json={"email": "another-unknown@example.dev", "password": "WrongPass123!"},
    )
    assert blocked.status_code == 429


@pytest.mark.asyncio
async def test_successful_login_resets_failure_bucket(
    client: AsyncClient,
    db_session: AsyncSession,
    limiter_override: Callable[[InMemoryLoginRateLimiter], None],
) -> None:
    limiter_override(InMemoryLoginRateLimiter(2, 60, 100))
    await create_login_user(db_session, email="reset@example.dev", password="DemoPass123!")
    wrong = {"email": "reset@example.dev", "password": "WrongPass123!"}

    assert (await client.post("/api/v2/auth/login", json=wrong)).status_code == 401
    assert (
        await client.post(
            "/api/v2/auth/login",
            json={"email": "reset@example.dev", "password": "DemoPass123!"},
        )
    ).status_code == 200
    assert (await client.post("/api/v2/auth/login", json=wrong)).status_code == 401
    assert (await client.post("/api/v2/auth/login", json=wrong)).status_code == 401
    assert (await client.post("/api/v2/auth/login", json=wrong)).status_code == 429


@pytest.mark.asyncio
async def test_rate_limit_window_expires_and_key_storage_is_bounded() -> None:
    clock = FakeClock()
    limiter = InMemoryLoginRateLimiter(1, 10, 2, clock=clock)
    assert (await limiter.acquire("one", "192.0.2.1")).allowed
    assert not (await limiter.acquire("one", "192.0.2.1")).allowed

    clock.now += 11
    assert (await limiter.acquire("one", "192.0.2.1")).allowed

    await limiter.acquire("two", "192.0.2.2")
    await limiter.acquire("three", "192.0.2.3")
    await limiter.acquire("four", "192.0.2.4")
    assert limiter.tracked_key_count == 2


@pytest.mark.asyncio
async def test_postgres_limiter_is_atomic_shared_and_stores_only_opaque_keys(
    db_session: AsyncSession,
) -> None:
    if db_session.bind is None or db_session.bind.dialect.name != "postgresql":
        pytest.skip("PostgreSQL-only shared limiter integration")
    assert isinstance(db_session.bind, AsyncEngine)
    session_factory = async_sessionmaker(db_session.bind, expire_on_commit=False)
    secret = b"synthetic-test-key-with-no-production-value"
    limiters = [
        PostgresLoginRateLimiter(
            session_factory,
            account_max_attempts=2,
            ip_max_attempts=100,
            window_seconds=60,
            key_hmac_secret=secret,
        )
        for _ in range(3)
    ]

    decisions = await asyncio.gather(
        *(
            limiter.acquire("target@example.dev", f"198.51.100.{index}")
            for index, limiter in enumerate(limiters)
        )
    )

    assert sum(decision.allowed for decision in decisions) == 2
    stored_keys = (await db_session.scalars(select(LoginRateLimit.bucket_key))).all()
    assert stored_keys
    assert all("target@example.dev" not in key for key in stored_keys)
    assert all(
        (key.startswith("account:") and len(key) == 72)
        or (key.startswith("ip:") and len(key) == 67)
        for key in stored_keys
    )


@pytest.mark.asyncio
async def test_success_does_not_reset_shared_ip_budget(
    db_session: AsyncSession,
) -> None:
    if db_session.bind is None or db_session.bind.dialect.name != "postgresql":
        pytest.skip("PostgreSQL-only shared limiter integration")
    assert isinstance(db_session.bind, AsyncEngine)
    limiter = PostgresLoginRateLimiter(
        async_sessionmaker(db_session.bind, expire_on_commit=False),
        account_max_attempts=5,
        ip_max_attempts=2,
        window_seconds=60,
        key_hmac_secret=b"synthetic-test-key-with-no-production-value",
    )

    assert (await limiter.acquire("first@example.dev", "203.0.113.8")).allowed
    await limiter.reset_account("first@example.dev")
    assert (await limiter.acquire("second@example.dev", "203.0.113.8")).allowed
    await limiter.reset_account("second@example.dev")
    assert not (await limiter.acquire("third@example.dev", "203.0.113.8")).allowed


@pytest.mark.asyncio
async def test_postgres_limiter_removes_expired_opaque_buckets(
    db_session: AsyncSession,
) -> None:
    if db_session.bind is None or db_session.bind.dialect.name != "postgresql":
        pytest.skip("PostgreSQL-only shared limiter integration")
    assert isinstance(db_session.bind, AsyncEngine)
    expired_key = "account:" + "a" * 64
    db_session.add(
        LoginRateLimit(
            bucket_key=expired_key,
            attempts=5,
            window_started_at=datetime.now(UTC) - timedelta(minutes=2),
        )
    )
    await db_session.commit()
    limiter = PostgresLoginRateLimiter(
        async_sessionmaker(db_session.bind, expire_on_commit=False),
        account_max_attempts=5,
        ip_max_attempts=25,
        window_seconds=60,
        key_hmac_secret=b"synthetic-test-key-with-no-production-value",
    )

    assert (await limiter.acquire("fresh@example.dev", "203.0.113.9")).allowed
    assert await db_session.get(LoginRateLimit, expired_key) is None


@pytest.mark.asyncio
async def test_limiter_failure_stops_before_password_verification(
    client: AsyncClient,
    limiter_override: Callable[[InMemoryLoginRateLimiter], None],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class UnavailableLimiter(InMemoryLoginRateLimiter):
        async def acquire(self, account_identifier: str, client_ip: str):  # type: ignore[no-untyped-def]
            raise RateLimiterUnavailable("synthetic outage")

    async def reject_auth_call(*args: object, **kwargs: object) -> None:
        raise AssertionError("password verification must not run without the limiter")

    limiter_override(UnavailableLimiter(2, 60, 100))
    monkeypatch.setattr(AuthService, "login", reject_auth_call)

    response = await client.post(
        "/api/v2/auth/login",
        json={"email": "blocked@example.dev", "password": "WrongPass123!"},
    )

    assert response.status_code == 503
    assert response.headers["Retry-After"] == "1"


@pytest.mark.asyncio
async def test_reset_outage_does_not_hide_a_committed_successful_login(
    client: AsyncClient,
    db_session: AsyncSession,
    limiter_override: Callable[[InMemoryLoginRateLimiter], None],
) -> None:
    class ResetUnavailableLimiter(InMemoryLoginRateLimiter):
        async def reset_account(self, account_identifier: str) -> None:
            raise RateLimiterUnavailable("synthetic reset outage")

    limiter_override(ResetUnavailableLimiter(5, 60, 100))
    await create_login_user(
        db_session,
        email="reset-outage@example.dev",
        password="DemoPass123!",
    )

    response = await client.post(
        "/api/v2/auth/login",
        json={"email": "reset-outage@example.dev", "password": "DemoPass123!"},
    )

    assert response.status_code == 200
    me = await client.get(
        "/api/v2/auth/me",
        headers={"Authorization": f"Bearer {response.json()['accessToken']}"},
    )
    assert me.status_code == 200
