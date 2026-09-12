import statistics
import time

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v2.auth import get_login_rate_limiter
from app.domain.enums import Role
from app.domain.models import Company, User
from app.main import app
from app.repositories.user_repo import CompanyRepository, UserRepository
from app.security.jwt import hash_password
from app.security.rate_limit import InMemoryLoginRateLimiter


def p95_milliseconds(samples: list[float]) -> float:
    return statistics.quantiles(samples, n=100, method="inclusive")[94] * 1000


@pytest.mark.asyncio
async def test_authentication_api_p95_stays_below_demo_budget(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    performance_limiter = InMemoryLoginRateLimiter(
        100,
        60,
        1_000,
        ip_max_attempts=100,
    )
    app.dependency_overrides[get_login_rate_limiter] = lambda: performance_limiter
    company = await CompanyRepository(db_session).add(Company(name="Performance Fixture"))
    await db_session.flush()
    await UserRepository(db_session).add(
        User(
            email="performance@example.com",
            name="Performance Fixture",
            hashed_password=hash_password("SyntheticPass123!"),
            role=Role.EMPLOYEE,
            company_id=company.id,
        )
    )
    await db_session.commit()

    credentials = {
        "email": "performance@example.com",
        "password": "SyntheticPass123!",
    }
    samples: list[float] = []
    try:
        for _ in range(20):
            started = time.perf_counter()
            response = await client.post("/api/v2/auth/login", json=credentials)
            samples.append(time.perf_counter() - started)
            assert response.status_code == 200
    finally:
        app.dependency_overrides.pop(get_login_rate_limiter, None)

    p95 = p95_milliseconds(samples)
    print(f"PERF auth_login_p95_ms={p95:.2f} samples={len(samples)}")
    assert p95 < 300
