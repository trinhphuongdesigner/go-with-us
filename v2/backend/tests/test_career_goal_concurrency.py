from app.domain.enums import Role
from app.domain.models import Company, User
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
