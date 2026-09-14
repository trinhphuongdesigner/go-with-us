import asyncio

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.sql.dml import Update

from app.core.database import get_db
from app.domain.enums import Role
from app.domain.models import Company, User
from app.main import app
from app.security.jwt import hash_password


def goal_payload(title: str, *, expected_version: int | None = None) -> dict[str, object]:
    payload: dict[str, object] = {
        "title": title,
        "category": "WORK",
        "description": None,
        "metric": None,
        "targetValue": None,
        "currentValue": None,
        "progress": 0,
        "dueDate": None,
        "status": "NOT_STARTED",
        "aiSuggested": False,
    }
    if expected_version is not None:
        payload["expectedVersion"] = expected_version
    return payload


async def test_goal_patch_rejects_a_stale_editor_version(client, db_session):
    company = Company(name="Goal concurrency company")
    db_session.add(company)
    await db_session.flush()
    actor = User(
        email="goal-concurrency@example.com",
        name="Goal Owner",
        role=Role.EMPLOYEE,
        company_id=company.id,
        hashed_password=hash_password("GoalConcurrency123!"),
    )
    db_session.add(actor)
    await db_session.commit()
    login = await client.post(
        "/api/v2/auth/login",
        json={"email": actor.email, "password": "GoalConcurrency123!"},
    )
    headers = {"Authorization": f"Bearer {login.json()['accessToken']}"}

    created = await client.post(
        "/api/v2/development-plans/goals",
        headers=headers,
        json={
            **goal_payload("Original goal"),
            "description": "Must survive a title-only patch",
            "metric": "Ship three features",
            "targetValue": 3,
            "currentValue": 1,
            "progress": 33,
            "status": "IN_PROGRESS",
        },
    )
    assert created.status_code == 201
    goal_id = created.json()["id"]
    assert created.json()["version"] == 1

    first = await client.patch(
        f"/api/v2/development-plans/goals/{goal_id}",
        headers=headers,
        json={"title": "First editor wins", "expectedVersion": 1},
    )
    assert first.status_code == 200
    assert first.json()["version"] == 2
    assert first.json()["description"] == "Must survive a title-only patch"
    assert first.json()["metric"] == "Ship three features"
    assert first.json()["targetValue"] == 3
    assert first.json()["currentValue"] == 1
    assert first.json()["progress"] == 33
    assert first.json()["status"] == "IN_PROGRESS"

    stale = await client.patch(
        f"/api/v2/development-plans/goals/{goal_id}",
        headers=headers,
        json={"title": "Stale overwrite", "expectedVersion": 1},
    )
    assert stale.status_code == 409
    assert stale.json()["detail"] == {"code": "version_conflict", "currentVersion": 2}

    listed = await client.get(
        "/api/v2/development-plans/goals?category=WORK",
        headers=headers,
    )
    assert listed.json()[0]["title"] == "First editor wins"

    stale_delete = await client.delete(
        f"/api/v2/development-plans/goals/{goal_id}?expected_version=1",
        headers=headers,
    )
    assert stale_delete.status_code == 409
    assert stale_delete.json()["detail"] == {
        "code": "version_conflict",
        "currentVersion": 2,
    }
    assert (
        await client.get("/api/v2/development-plans/goals?category=WORK", headers=headers)
    ).json()[0]["id"] == goal_id


async def test_goal_contract_validates_category_status_due_date_and_non_empty_patch(
    client, db_session
):
    company = Company(name="Goal validation company")
    db_session.add(company)
    await db_session.flush()
    actor = User(
        email="goal-validation@example.com",
        name="Goal Validator",
        role=Role.EMPLOYEE,
        company_id=company.id,
        hashed_password=hash_password("GoalValidation123!"),
    )
    db_session.add(actor)
    await db_session.commit()
    login = await client.post(
        "/api/v2/auth/login",
        json={"email": actor.email, "password": "GoalValidation123!"},
    )
    headers = {"Authorization": f"Bearer {login.json()['accessToken']}"}

    valid = await client.post(
        "/api/v2/development-plans/goals",
        headers=headers,
        json={
            **goal_payload("Personal goal"),
            "category": "PERSONAL",
            "status": "ACHIEVED",
            "progress": 100,
            "dueDate": "2027-03-31",
        },
    )
    assert valid.status_code == 201
    assert valid.json()["category"] == "PERSONAL"
    assert valid.json()["status"] == "ACHIEVED"
    assert valid.json()["dueDate"] == "2027-03-31"

    for invalid_field in (
        {"category": "TEAM"},
        {"status": "DONE"},
        {"dueDate": "31/03/2027"},
        {"progress": 101},
    ):
        response = await client.post(
            "/api/v2/development-plans/goals",
            headers=headers,
            json={**goal_payload("Invalid goal"), **invalid_field},
        )
        assert response.status_code == 422

    goal_id = valid.json()["id"]
    empty_patch = await client.patch(
        f"/api/v2/development-plans/goals/{goal_id}",
        headers=headers,
        json={"expectedVersion": 1},
    )
    assert empty_patch.status_code == 422
    null_required_field = await client.patch(
        f"/api/v2/development-plans/goals/{goal_id}",
        headers=headers,
        json={"expectedVersion": 1, "status": None},
    )
    assert null_required_field.status_code == 422


async def test_goal_mutations_are_scoped_to_owner_and_company(client, db_session):
    owner_company = Company(name="Owner company")
    foreign_company = Company(name="Foreign company")
    db_session.add_all([owner_company, foreign_company])
    await db_session.flush()
    users = [
        User(
            email=email,
            name=name,
            role=Role.EMPLOYEE,
            company_id=company.id,
            hashed_password=hash_password("GoalScope123!"),
        )
        for email, name, company in (
            ("goal-owner@example.com", "Goal Owner", owner_company),
            ("goal-peer@example.com", "Goal Peer", owner_company),
            ("goal-foreign@example.com", "Goal Foreign", foreign_company),
        )
    ]
    db_session.add_all(users)
    await db_session.commit()

    headers = []
    for user in users:
        login = await client.post(
            "/api/v2/auth/login",
            json={"email": user.email, "password": "GoalScope123!"},
        )
        headers.append({"Authorization": f"Bearer {login.json()['accessToken']}"})

    created = await client.post(
        "/api/v2/development-plans/goals",
        headers=headers[0],
        json=goal_payload("Private goal"),
    )
    assert created.status_code == 201
    goal_id = created.json()["id"]

    for unauthorized_headers in headers[1:]:
        assert (
            await client.get(
                "/api/v2/development-plans/goals?category=WORK",
                headers=unauthorized_headers,
            )
        ).json() == []
        patch = await client.patch(
            f"/api/v2/development-plans/goals/{goal_id}",
            headers=unauthorized_headers,
            json={"title": "Unauthorized", "expectedVersion": 1},
        )
        assert patch.status_code == 404
        deletion = await client.delete(
            f"/api/v2/development-plans/goals/{goal_id}?expected_version=1",
            headers=unauthorized_headers,
        )
        assert deletion.status_code == 404

    owner_goals = await client.get(
        "/api/v2/development-plans/goals?category=WORK",
        headers=headers[0],
    )
    assert [item["id"] for item in owner_goals.json()] == [goal_id]


async def test_concurrent_goal_patches_allow_exactly_one_winner_on_postgresql(
    client, db_session
):
    if db_session.bind is None or db_session.bind.dialect.name != "postgresql":
        pytest.skip("PostgreSQL is required for real concurrent transaction coverage")

    company = Company(name="Goal concurrent writers")
    db_session.add(company)
    await db_session.flush()
    actor = User(
        email="goal-two-writers@example.com",
        name="Goal Concurrent Owner",
        role=Role.EMPLOYEE,
        company_id=company.id,
        hashed_password=hash_password("GoalWriters123!"),
    )
    db_session.add(actor)
    await db_session.commit()
    login = await client.post(
        "/api/v2/auth/login",
        json={"email": actor.email, "password": "GoalWriters123!"},
    )
    headers = {"Authorization": f"Bearer {login.json()['accessToken']}"}
    created = await client.post(
        "/api/v2/development-plans/goals",
        headers=headers,
        json=goal_payload("Concurrent original"),
    )
    goal_id = created.json()["id"]

    release_updates = asyncio.Event()
    update_arrivals = 0
    arrival_lock = asyncio.Lock()

    class BarrierSession(AsyncSession):
        async def scalar(self, statement, *args, **kwargs):
            nonlocal update_arrivals
            if isinstance(statement, Update) and statement.table.name == "career_goals":
                async with arrival_lock:
                    update_arrivals += 1
                    if update_arrivals == 2:
                        release_updates.set()
                await asyncio.wait_for(release_updates.wait(), timeout=3)
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
                    writer_a.patch(
                        f"/api/v2/development-plans/goals/{goal_id}",
                        headers=headers,
                        json={"title": "Writer A", "expectedVersion": 1},
                    ),
                    writer_b.patch(
                        f"/api/v2/development-plans/goals/{goal_id}",
                        headers=headers,
                        json={"title": "Writer B", "expectedVersion": 1},
                    ),
                ),
                timeout=10,
            )
    finally:
        if original_db_override is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = original_db_override

    assert update_arrivals == 2
    assert sorted(response.status_code for response in responses) == [200, 409]
    loser = next(response for response in responses if response.status_code == 409)
    assert loser.json()["detail"] == {"code": "version_conflict", "currentVersion": 2}
    listed = await client.get(
        "/api/v2/development-plans/goals?category=WORK",
        headers=headers,
    )
    assert listed.json()[0]["version"] == 2
    assert listed.json()[0]["title"] in {"Writer A", "Writer B"}
