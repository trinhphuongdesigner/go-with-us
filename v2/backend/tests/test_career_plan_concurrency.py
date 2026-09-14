import asyncio

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.sql.selectable import Select

from app.core.database import get_db
from app.domain.enums import Role
from app.domain.models import Company, User
from app.main import app
from app.security.jwt import hash_password


async def _headers(client, db_session, *, email: str) -> dict[str, str]:
    company = Company(name=f"Plan company {email}")
    db_session.add(company)
    await db_session.flush()
    actor = User(
        email=email,
        name="Plan Owner",
        role=Role.EMPLOYEE,
        company_id=company.id,
        hashed_password=hash_password("PlanConcurrency123!"),
    )
    db_session.add(actor)
    await db_session.commit()
    login = await client.post(
        "/api/v2/auth/login",
        json={"email": email, "password": "PlanConcurrency123!"},
    )
    return {"Authorization": f"Bearer {login.json()['accessToken']}"}


async def test_plan_save_rejects_stale_version_without_persisting_content(client, db_session):
    headers = await _headers(client, db_session, email="plan-stale@example.com")
    route = "/api/v2/development-plans/me"

    first = await client.put(
        route,
        headers=headers,
        json={
            "category": "WORK",
            "expectedVersion": 0,
            "content": "First writer content",
            "summary": "First writer summary",
            "aiGenerated": False,
        },
    )
    assert first.status_code == 200
    assert first.json()["version"] == 1

    stale = await client.put(
        route,
        headers=headers,
        json={
            "category": "WORK",
            "expectedVersion": 0,
            "content": "Stale overwrite",
            "summary": "Must not persist",
            "aiGenerated": True,
        },
    )
    assert stale.status_code == 409
    assert stale.json()["detail"] == {"code": "version_conflict", "currentVersion": 1}

    history = await client.get(
        "/api/v2/development-plans/me/history?category=WORK",
        headers=headers,
    )
    assert history.status_code == 200
    assert [(row["version"], row["content"]) for row in history.json()] == [
        (1, "First writer content")
    ]


async def test_plan_versions_are_independent_by_category(client, db_session):
    headers = await _headers(client, db_session, email="plan-category@example.com")
    route = "/api/v2/development-plans/me"

    for category in ("WORK", "PERSONAL"):
        response = await client.put(
            route,
            headers=headers,
            json={
                "category": category,
                "expectedVersion": 0,
                "content": f"{category} plan",
                "summary": None,
                "aiGenerated": False,
            },
        )
        assert response.status_code == 200
        assert response.json()["version"] == 1
        assert response.json()["category"] == category

    work_history = await client.get(
        "/api/v2/development-plans/me/history?category=WORK",
        headers=headers,
    )
    personal_history = await client.get(
        "/api/v2/development-plans/me/history?category=PERSONAL",
        headers=headers,
    )
    assert [row["content"] for row in work_history.json()] == ["WORK plan"]
    assert [row["content"] for row in personal_history.json()] == ["PERSONAL plan"]


async def test_concurrent_plan_creates_allow_exactly_one_winner_on_postgresql(client, db_session):
    if db_session.bind is None or db_session.bind.dialect.name != "postgresql":
        pytest.skip("PostgreSQL is required for real row-lock concurrency coverage")

    headers = await _headers(client, db_session, email="plan-two-writers@example.com")
    release_lock_selects = asyncio.Event()
    lock_select_arrivals = 0
    arrival_lock = asyncio.Lock()

    class BarrierSession(AsyncSession):
        async def scalar(self, statement, *args, **kwargs):
            nonlocal lock_select_arrivals
            if isinstance(statement, Select) and statement._for_update_arg is not None:
                async with arrival_lock:
                    lock_select_arrivals += 1
                    if lock_select_arrivals == 2:
                        release_lock_selects.set()
                await asyncio.wait_for(release_lock_selects.wait(), timeout=3)
            return await super().scalar(statement, *args, **kwargs)

    session_factory = async_sessionmaker(
        db_session.bind,
        class_=BarrierSession,
        expire_on_commit=False,
    )

    async def concurrent_request_session():
        async with session_factory() as session:
            yield session

    original_db_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = concurrent_request_session
    try:
        transport_a = ASGITransport(app=app)
        transport_b = ASGITransport(app=app)
        async with (
            AsyncClient(transport=transport_a, base_url="http://writer-a") as writer_a,
            AsyncClient(transport=transport_b, base_url="http://writer-b") as writer_b,
        ):
            responses = await asyncio.wait_for(
                asyncio.gather(
                    writer_a.put(
                        "/api/v2/development-plans/me",
                        headers=headers,
                        json={
                            "category": "WORK",
                            "expectedVersion": 0,
                            "content": "Writer A content",
                            "summary": "Writer A",
                            "aiGenerated": False,
                        },
                    ),
                    writer_b.put(
                        "/api/v2/development-plans/me",
                        headers=headers,
                        json={
                            "category": "WORK",
                            "expectedVersion": 0,
                            "content": "Writer B content",
                            "summary": "Writer B",
                            "aiGenerated": False,
                        },
                    ),
                ),
                timeout=10,
            )
    finally:
        if original_db_override is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = original_db_override

    assert lock_select_arrivals == 2
    assert sorted(response.status_code for response in responses) == [200, 409]
    winner = next(response for response in responses if response.status_code == 200)
    loser = next(response for response in responses if response.status_code == 409)
    assert winner.json()["version"] == 1
    assert loser.json()["detail"] == {"code": "version_conflict", "currentVersion": 1}

    history = await client.get(
        "/api/v2/development-plans/me/history?category=WORK",
        headers=headers,
    )
    assert history.status_code == 200
    assert len(history.json()) == 1
    assert history.json()[0]["version"] == 1
    assert history.json()[0]["content"] == winner.json()["content"]
