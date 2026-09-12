"""Roadmap contract tests in their own in-memory DB, with real permission checks."""

import uuid
from types import SimpleNamespace

import pytest
from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.api.v2.dependencies import get_current_user
from app.api.v2.development_plans import router
from app.core.database import get_db
from app.domain.enums import Role
from app.domain.models import Base, Company, User
from app.domain.roadmap_models import DevelopmentPlanSettings, DevelopmentRoadmap

PREFIX = "/api/v2/development-plans"


@pytest.fixture(autouse=True)
async def reset_db():
    """Override the global fixture: this module never uses the shared test database."""
    yield


@pytest.fixture
async def roadmap_api():
    engine = create_async_engine("sqlite+aiosqlite://", poolclass=StaticPool)

    @event.listens_for(engine.sync_engine, "connect")
    def foreign_keys(connection, _record):
        connection.execute("PRAGMA foreign_keys=ON")

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        companies = [Company(name="Company A"), Company(name="Company B")]
        session.add_all(companies)
        await session.flush()
        users = [
            User(
                name=f"Person {index}",
                email=f"person{index}@example.test",
                hashed_password="unused-test-hash",
                role=Role.EMPLOYEE,
                company_id=companies[0 if index < 2 else 1].id,
            )
            for index in range(3)
        ]
        users.append(
            User(
                name="Platform",
                email="platform@example.test",
                hashed_password="unused",
                role=Role.SUPER_ADMIN,
            )
        )
        session.add_all(users)
        await session.commit()
    state = SimpleNamespace(actor=users[0], users=users, factory=factory)
    app = FastAPI()
    app.include_router(router, prefix="/api/v2")

    async def actor():
        if state.actor is None:
            raise HTTPException(401, "Authentication required")
        return state.actor

    async def database():
        async with factory() as session:
            yield session

    app.dependency_overrides[get_current_user] = actor
    app.dependency_overrides[get_db] = database
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        state.client = client
        yield state
    await engine.dispose()


def draft(category="WORK"):
    return {
        "clientRequestId": str(uuid.uuid4()),
        "category": category,
        "title": "Build leadership skills",
        "durationWeeks": 8,
        "hoursPerWeek": 4,
        "milestones": [
            {
                "title": "Practice",
                "dueDate": "2026-12-01",
                "tasks": [
                    {"title": "Lead a review", "metric": "Two reviews"},
                    {"title": "Seek feedback"},
                ],
            },
            {"title": "Apply", "tasks": [{"title": "Lead a project"}]},
        ],
    }


async def save(api, payload=None):
    response = await api.client.post(f"{PREFIX}/me/roadmaps", json=payload or draft())
    assert response.status_code == 201, response.text
    return response.json()


async def test_reads_do_not_create_and_save_preserves_attempts(roadmap_api):
    api = roadmap_api
    assert (await api.client.get(f"{PREFIX}/me")).json()["settings"]["version"] == 0
    assert (await api.client.get(f"{PREFIX}/me/roadmaps")).json() == []
    async with api.factory() as session:
        assert await session.scalar(select(func.count()).select_from(DevelopmentPlanSettings)) == 0
        assert await session.scalar(select(func.count()).select_from(DevelopmentRoadmap)) == 0
    first = await save(api)
    second = await save(api)
    personal = await save(api, draft("PERSONAL"))
    assert len({first["id"], second["id"], personal["id"]}) == 3
    work = (await api.client.get(f"{PREFIX}/me/roadmaps?category=WORK")).json()
    assert [item["id"] for item in work] == [second["id"], first["id"]]
    assert len((await api.client.get(f"{PREFIX}/me/roadmaps")).json()) == 3
    assert len((await api.client.get(f"{PREFIX}/me/roadmaps?category=PERSONAL")).json()) == 1
    assert [item["order"] for item in first["milestones"]] == [0, 1]
    assert [item["order"] for item in first["milestones"][0]["tasks"]] == [0, 1]


async def test_save_retry_is_idempotent_and_payload_reuse_rejected(roadmap_api):
    payload = draft()
    first = await save(roadmap_api, payload)
    retry = await save(roadmap_api, payload)
    assert retry["id"] == first["id"]
    payload["title"] = "A different intent"
    conflict = await roadmap_api.client.post(f"{PREFIX}/me/roadmaps", json=payload)
    assert conflict.status_code == 409
    assert conflict.json()["detail"]["code"] == "idempotency_conflict"
    assert len((await roadmap_api.client.get(f"{PREFIX}/me/roadmaps")).json()) == 1


async def test_task_completion_persists_and_rejects_stale_version(roadmap_api):
    api = roadmap_api
    row = await save(api)
    task1, task2 = row["milestones"][0]["tasks"]
    route = f"{PREFIX}/me/roadmaps/{row['id']}/tasks/{task1['id']}"
    response = await api.client.patch(route, json={"expectedVersion": 1, "done": True})
    assert response.status_code == 200, response.text
    updated = response.json()
    assert updated["version"] == 2
    assert updated["completedTasks"] == 1 and updated["progress"] == 33
    assert updated["milestones"][0]["status"] == "IN_PROGRESS"
    stale = await api.client.patch(route, json={"expectedVersion": 1, "done": False})
    assert stale.status_code == 409
    assert stale.json()["detail"]["currentVersion"] == 2
    response = await api.client.patch(
        route.replace(task1["id"], task2["id"]), json={"expectedVersion": 2, "done": True}
    )
    assert response.json()["milestones"][0]["status"] == "DONE"
    response = await api.client.patch(route, json={"expectedVersion": 3, "done": False})
    assert response.json()["milestones"][0]["status"] == "IN_PROGRESS"
    loaded = (await api.client.get(f"{PREFIX}/me/roadmaps")).json()[0]
    assert loaded["version"] == 4 and loaded["completedTasks"] == 1


async def test_owner_tenant_and_task_parent_are_enforced(roadmap_api):
    api = roadmap_api
    first, second = await save(api), await save(api)
    task_id = first["milestones"][0]["tasks"][0]["id"]
    route = f"{PREFIX}/me/roadmaps/{first['id']}/tasks/{task_id}"
    mismatch = await api.client.patch(
        route.replace(first["id"], second["id"]), json={"expectedVersion": 1, "done": True}
    )
    assert mismatch.status_code == 404
    for user in api.users[1:3]:
        api.actor = user
        assert (await api.client.get(f"{PREFIX}/me/roadmaps")).json() == []
        assert (
            await api.client.patch(route, json={"expectedVersion": 1, "done": True})
        ).status_code == 404


async def test_settings_are_separate_partial_and_versioned(roadmap_api):
    api = roadmap_api
    await save(api)
    row = (await api.client.get(f"{PREFIX}/me/roadmaps")).json()[0]
    response = await api.client.patch(
        f"{PREFIX}/me/settings",
        json={"expectedVersion": 0, "viewMode": "diagram", "reduceMotion": True},
    )
    assert response.status_code == 200, response.text
    assert response.json()["version"] == 1
    response = await api.client.patch(
        f"{PREFIX}/me/settings", json={"expectedVersion": 1, "character": "bird"}
    )
    assert response.json()["version"] == 2
    assert response.json()["viewMode"] == "diagram" and response.json()["reduceMotion"] is True
    assert (
        await api.client.patch(
            f"{PREFIX}/me/settings", json={"expectedVersion": 1, "fontSize": "lg"}
        )
    ).status_code == 409
    assert (await api.client.get(f"{PREFIX}/me/roadmaps")).json()[0] == row
    api.actor = api.users[1]
    assert (await api.client.get(f"{PREFIX}/me")).json()["settings"]["version"] == 0


@pytest.mark.parametrize(
    "field,value",
    [
        ("category", "HEALTH"),
        ("title", "  "),
        ("milestones", []),
        ("durationWeeks", 0),
        ("hoursPerWeek", 169),
        ("ownerUserId", str(uuid.uuid4())),
    ],
)
async def test_save_validation(roadmap_api, field, value):
    payload = draft()
    payload[field] = value
    assert (await roadmap_api.client.post(f"{PREFIX}/me/roadmaps", json=payload)).status_code == 422
    assert (await roadmap_api.client.get(f"{PREFIX}/me/roadmaps")).json() == []


async def test_unknown_filter_bad_nested_data_and_display_fields(roadmap_api):
    api = roadmap_api
    assert (await api.client.get(f"{PREFIX}/me/roadmaps?category=health")).status_code == 422
    payload = draft()
    payload["milestones"][0]["tasks"][0]["done"] = True
    assert (await api.client.post(f"{PREFIX}/me/roadmaps", json=payload)).status_code == 422
    for updates in (
        {},
        {"character": None},
        {"viewMode": "random"},
        {"content": "overwrite"},
        {"reduceMotion": "false"},
    ):
        assert (
            await api.client.patch(f"{PREFIX}/me/settings", json={"expectedVersion": 0, **updates})
        ).status_code == 422


@pytest.mark.parametrize("endpoint", ["/me", "/me/roadmaps"])
async def test_auth_and_permission_required(roadmap_api, endpoint):
    api = roadmap_api
    api.actor = None
    assert (await api.client.get(PREFIX + endpoint)).status_code == 401
    api.actor = api.users[3]
    assert (await api.client.get(PREFIX + endpoint)).status_code == 403


@pytest.mark.parametrize("actor_index,expected_status", [(None, 401), (3, 403)])
async def test_mutations_require_auth_and_roadmap_permission(
    roadmap_api, actor_index, expected_status
):
    api = roadmap_api
    api.actor = None if actor_index is None else api.users[actor_index]
    responses = [
        await api.client.post(f"{PREFIX}/me/roadmaps", json=draft()),
        await api.client.patch(
            f"{PREFIX}/me/settings", json={"expectedVersion": 0, "viewMode": "diagram"}
        ),
        await api.client.patch(
            f"{PREFIX}/me/roadmaps/{uuid.uuid4()}/tasks/{uuid.uuid4()}",
            json={"expectedVersion": 1, "done": True},
        ),
    ]
    assert [response.status_code for response in responses] == [expected_status] * 3


async def test_company_is_required_even_with_self_permission(roadmap_api):
    api = roadmap_api
    api.actor = User(
        id=uuid.uuid4(),
        name="Unscoped",
        email="unscoped@example.test",
        hashed_password="unused",
        role=Role.EMPLOYEE,
        company_id=None,
        admin_permissions=[],
    )
    assert (await api.client.get(f"{PREFIX}/me")).status_code == 403
    assert (await api.client.post(f"{PREFIX}/me/roadmaps", json=draft())).status_code == 403


async def test_database_rejects_cross_company_owner(roadmap_api):
    api = roadmap_api
    async with api.factory() as session:
        session.add(
            DevelopmentRoadmap(
                owner_user_id=api.users[0].id,
                company_id=api.users[2].company_id,
                client_request_id=uuid.uuid4(),
                request_hash="a" * 64,
                category="WORK",
                title="Invalid scope",
            )
        )
        with pytest.raises(IntegrityError):
            await session.flush()
        await session.rollback()
