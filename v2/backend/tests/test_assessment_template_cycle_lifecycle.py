import asyncio
import json
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.sql.selectable import Select

from app.company_memberships import CompanyMembership
from app.core.database import get_db
from app.domain.enums import AdminPermission, Role
from app.domain.models import ActivityLog, Company, User
from app.main import app
from app.repositories.activity_repo import ActivityLogRepository
from app.security.jwt import hash_password
from app.talent_workflows.models import AssessmentCycle, AssessmentTemplate

PASSWORD = "TemplateLifecycle123!"


def groups() -> list[dict[str, Any]]:
    return [
        {
            "id": "delivery",
            "name": "Delivery",
            "description": "private template description",
            "weight": 1,
            "scoreDimension": "CONTRIBUTION",
            "passportDimension": None,
            "questions": [
                {
                    "id": "quality",
                    "text": "Private scoring question",
                    "guidance": "Private guidance",
                    "weight": 1,
                    "maxScore": 10,
                }
            ],
        }
    ]


async def user(db: AsyncSession, company: Company, email: str) -> User:
    row = User(
        email=email,
        name=email.split("@")[0],
        hashed_password=hash_password(PASSWORD),
        role=Role.COMPANY_ADMIN,
        company_id=company.id,
        admin_permissions=[AdminPermission.ASSESSMENT_REVIEW.value],
    )
    db.add(row)
    await db.flush()
    db.add(CompanyMembership(user_id=row.id, company_id=company.id))
    return row


async def headers(client: AsyncClient, actor: User) -> dict[str, str]:
    response = await client.post(
        "/api/v2/auth/login", json={"email": actor.email, "password": PASSWORD}
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['accessToken']}"}


async def seed(
    db: AsyncSession,
    *,
    template_status: str = "DRAFT",
    with_cycle: bool = False,
    suffix: str = "",
) -> dict[str, Any]:
    company = Company(name=f"Lifecycle company {suffix}")
    db.add(company)
    await db.flush()
    actor = await user(db, company, f"admin{suffix}@lifecycle.dev")
    template = AssessmentTemplate(
        company_id=company.id,
        created_by_id=actor.id,
        name="Private template name",
        description="Private template description",
        status=template_status,
        groups=groups(),
    )
    db.add(template)
    await db.flush()
    cycle = None
    if with_cycle:
        cycle = AssessmentCycle(
            company_id=company.id,
            template_id=template.id,
            name="Private cycle name",
            period="2026-09",
            status="OPEN",
        )
        db.add(cycle)
    await db.commit()
    return {"company": company, "actor": actor, "template": template, "cycle": cycle}


async def logs(db: AsyncSession, entity_type: str, entity_id: object) -> list[ActivityLog]:
    await db.rollback()
    return list(
        (
            await db.scalars(
                select(ActivityLog)
                .where(
                    ActivityLog.entity_type == entity_type,
                    ActivityLog.entity_id == str(entity_id),
                )
                .order_by(ActivityLog.created_at, ActivityLog.id)
            )
        ).all()
    )


def assert_metadata_only(log: ActivityLog) -> None:
    serialized = json.dumps(log.changes)
    assert "Private" not in serialized
    assert "groups" not in serialized
    assert "questions" not in serialized


async def test_template_publish_and_archive_use_typed_transitions_versions_and_safe_audits(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    seeded = await seed(db_session)
    template = seeded["template"]
    template_id = template.id
    family_id = template.family_id
    actor_headers = await headers(client, seeded["actor"])

    published = await client.post(
        f"/api/v2/assessments/templates/{template_id}/publish",
        headers=actor_headers,
        json={"expectedRowVersion": 1},
    )
    assert published.status_code == 200, published.text
    assert (
        published.json()["status"],
        published.json()["version"],
        published.json()["rowVersion"],
    ) == ("ACTIVE", 1, 2)

    same = await client.post(
        f"/api/v2/assessments/templates/{template_id}/publish",
        headers=actor_headers,
        json={"expectedRowVersion": 2},
    )
    assert same.status_code == 409
    assert same.json()["detail"] == {"code": "invalid_state", "currentStatus": "ACTIVE"}

    stale = await client.post(
        f"/api/v2/assessments/templates/{template_id}/archive",
        headers=actor_headers,
        json={"expectedRowVersion": 1},
    )
    assert stale.status_code == 409
    assert stale.json()["detail"] == {"code": "version_conflict", "currentVersion": 2}

    archived = await client.post(
        f"/api/v2/assessments/templates/{template_id}/archive",
        headers=actor_headers,
        json={"expectedRowVersion": 2},
    )
    assert archived.status_code == 200, archived.text
    assert (
        archived.json()["status"],
        archived.json()["version"],
        archived.json()["rowVersion"],
    ) == ("ARCHIVED", 1, 3)

    same_archive = await client.post(
        f"/api/v2/assessments/templates/{template_id}/archive",
        headers=actor_headers,
        json={"expectedRowVersion": 3},
    )
    assert same_archive.status_code == 409
    assert same_archive.json()["detail"] == {
        "code": "invalid_state",
        "currentStatus": "ARCHIVED",
    }

    audit_rows = await logs(db_session, "assessment_template", template_id)
    assert [row.action for row in audit_rows] == [
        "assessment.template.published",
        "assessment.template.archived",
    ]
    assert audit_rows[0].changes == {
        "fromStatus": "DRAFT",
        "toStatus": "ACTIVE",
        "contentVersion": 1,
        "fromRowVersion": 1,
        "toRowVersion": 2,
        "familyId": str(family_id),
    }
    assert audit_rows[1].changes == {
        "fromStatus": "ACTIVE",
        "toStatus": "ARCHIVED",
        "contentVersion": 1,
        "fromRowVersion": 2,
        "toRowVersion": 3,
        "familyId": str(family_id),
    }
    for row in audit_rows:
        assert_metadata_only(row)


async def test_published_revision_edit_creates_next_content_revision_with_fresh_row_version(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    seeded = await seed(db_session)
    template_id = seeded["template"].id
    family_id = seeded["template"].family_id
    actor_headers = await headers(client, seeded["actor"])
    published = await client.post(
        f"/api/v2/assessments/templates/{template_id}/publish",
        headers=actor_headers,
        json={"expectedRowVersion": 1},
    )
    assert published.status_code == 200, published.text

    edited = await client.put(
        f"/api/v2/assessments/templates/{template_id}",
        headers=actor_headers,
        json={
            "expectedRowVersion": 2,
            "name": "Revised template",
            "description": "revised description",
            "groups": groups(),
        },
    )
    assert edited.status_code == 200, edited.text
    assert edited.json()["id"] != str(template_id)
    assert edited.json()["familyId"] == str(family_id)
    assert (edited.json()["version"], edited.json()["rowVersion"]) == (2, 1)
    assert edited.json()["status"] == "DRAFT"

    db_session.expire_all()
    original = await db_session.get(AssessmentTemplate, template_id)
    assert original is not None
    assert (original.status, original.version, original.row_version) == ("ARCHIVED", 1, 3)
    audit_rows = await logs(db_session, "assessment_template", template_id)
    assert [row.action for row in audit_rows] == [
        "assessment.template.published",
        "assessment.template.revised",
    ]
    assert audit_rows[1].changes["fromContentVersion"] == 1
    assert audit_rows[1].changes["toContentVersion"] == 2
    assert audit_rows[1].changes["fromRowVersion"] == 2
    assert audit_rows[1].changes["toRowVersion"] == 3
    assert_metadata_only(audit_rows[1])


async def test_archiving_template_keeps_cycle_content_revision_identity_stable(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    seeded = await seed(db_session, template_status="ACTIVE", with_cycle=True)
    template_id = seeded["template"].id
    cycle_id = seeded["cycle"].id
    actor_headers = await headers(client, seeded["actor"])
    archived = await client.post(
        f"/api/v2/assessments/templates/{template_id}/archive",
        headers=actor_headers,
        json={"expectedRowVersion": 1},
    )
    assert archived.status_code == 200, archived.text
    assert (archived.json()["version"], archived.json()["rowVersion"]) == (1, 2)

    cycles = await client.get(
        f"/api/v2/assessments/cycles?companyId={seeded['company'].id}",
        headers=actor_headers,
    )
    assert cycles.status_code == 200, cycles.text
    cycle = next(row for row in cycles.json() if row["id"] == str(cycle_id))
    assert cycle["template"]["id"] == str(template_id)
    assert cycle["template"]["version"] == 1
    assert cycle["template"]["rowVersion"] == 2


async def test_delete_used_template_archives_and_versions_with_one_audit(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    seeded = await seed(db_session, template_status="ACTIVE", with_cycle=True)
    template_id = seeded["template"].id
    response = await client.delete(
        f"/api/v2/assessments/templates/{template_id}?expectedRowVersion=1",
        headers=await headers(client, seeded["actor"]),
    )
    assert response.status_code == 200, response.text
    assert response.json() == {"id": str(template_id), "archived": True}

    db_session.expire_all()
    persisted = await db_session.get(AssessmentTemplate, template_id)
    assert persisted is not None
    assert (persisted.status, persisted.version, persisted.row_version) == ("ARCHIVED", 1, 2)
    audit_rows = await logs(db_session, "assessment_template", template_id)
    assert [row.action for row in audit_rows] == ["assessment.template.archived"]
    assert audit_rows[0].changes["trigger"] == "delete"
    assert audit_rows[0].changes["contentVersion"] == 1
    assert audit_rows[0].changes["toRowVersion"] == 2
    assert_metadata_only(audit_rows[0])


async def test_delete_unused_template_removes_it_with_one_safe_audit(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    seeded = await seed(db_session)
    template_id = seeded["template"].id
    response = await client.delete(
        f"/api/v2/assessments/templates/{template_id}?expectedRowVersion=1",
        headers=await headers(client, seeded["actor"]),
    )
    assert response.status_code == 200, response.text
    assert response.json() == {"id": str(template_id), "archived": False}
    db_session.expire_all()
    assert await db_session.get(AssessmentTemplate, template_id) is None
    audit_rows = await logs(db_session, "assessment_template", template_id)
    assert [row.action for row in audit_rows] == ["assessment.template.deleted"]
    assert audit_rows[0].changes["contentVersion"] == 1
    assert audit_rows[0].changes["fromRowVersion"] == 1
    assert_metadata_only(audit_rows[0])


@pytest.mark.parametrize("with_cycle", [False, True])
async def test_delete_template_audit_failure_rolls_back_delete_or_archive(
    client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
    with_cycle: bool,
) -> None:
    seeded = await seed(db_session, template_status="ACTIVE", with_cycle=with_cycle)
    template_id = seeded["template"].id
    actor_headers = await headers(client, seeded["actor"])

    async def fail_audit(*args: object, **kwargs: object) -> ActivityLog:
        raise RuntimeError("synthetic lifecycle audit failure")

    monkeypatch.setattr(ActivityLogRepository, "log", fail_audit)
    with pytest.raises(RuntimeError, match="synthetic lifecycle audit failure"):
        await client.delete(
            f"/api/v2/assessments/templates/{template_id}?expectedRowVersion=1",
            headers=actor_headers,
        )

    await db_session.rollback()
    db_session.expire_all()
    persisted = await db_session.get(AssessmentTemplate, template_id)
    assert persisted is not None
    assert (persisted.status, persisted.version, persisted.row_version) == ("ACTIVE", 1, 1)
    assert await logs(db_session, "assessment_template", template_id) == []


async def test_template_action_audit_failure_rolls_back_transition(
    client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seeded = await seed(db_session)
    template_id = seeded["template"].id
    actor_headers = await headers(client, seeded["actor"])

    async def fail_audit(*args: object, **kwargs: object) -> ActivityLog:
        raise RuntimeError("synthetic template action audit failure")

    monkeypatch.setattr(ActivityLogRepository, "log", fail_audit)
    with pytest.raises(RuntimeError, match="synthetic template action audit failure"):
        await client.post(
            f"/api/v2/assessments/templates/{template_id}/publish",
            headers=actor_headers,
            json={"expectedRowVersion": 1},
        )
    await db_session.rollback()
    db_session.expire_all()
    persisted = await db_session.get(AssessmentTemplate, template_id)
    assert persisted is not None
    assert (persisted.status, persisted.version, persisted.row_version) == ("DRAFT", 1, 1)
    assert await logs(db_session, "assessment_template", template_id) == []


async def test_template_endpoints_reject_legacy_expected_version_contract(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    seeded = await seed(db_session)
    template_id = seeded["template"].id
    actor_headers = await headers(client, seeded["actor"])
    legacy_edit = await client.put(
        f"/api/v2/assessments/templates/{template_id}",
        headers=actor_headers,
        json={
            "expectedVersion": 1,
            "name": "Legacy edit",
            "description": "",
            "groups": groups(),
        },
    )
    legacy_action = await client.post(
        f"/api/v2/assessments/templates/{template_id}/publish",
        headers=actor_headers,
        json={"expectedVersion": 1},
    )
    legacy_delete = await client.delete(
        f"/api/v2/assessments/templates/{template_id}?expectedVersion=1",
        headers=actor_headers,
    )

    assert [legacy_edit.status_code, legacy_action.status_code, legacy_delete.status_code] == [
        422,
        422,
        422,
    ]
    db_session.expire_all()
    persisted = await db_session.get(AssessmentTemplate, template_id)
    assert persisted is not None
    assert (persisted.status, persisted.version, persisted.row_version) == ("DRAFT", 1, 1)
    assert await logs(db_session, "assessment_template", template_id) == []


async def test_template_edit_audit_failure_rolls_back_old_row_and_replacement(
    client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seeded = await seed(db_session)
    template_id = seeded["template"].id
    family_id = seeded["template"].family_id
    actor_headers = await headers(client, seeded["actor"])

    async def fail_audit(*args: object, **kwargs: object) -> ActivityLog:
        raise RuntimeError("synthetic template edit audit failure")

    monkeypatch.setattr(ActivityLogRepository, "log", fail_audit)
    with pytest.raises(RuntimeError, match="synthetic template edit audit failure"):
        await client.put(
            f"/api/v2/assessments/templates/{template_id}",
            headers=actor_headers,
            json={
                "expectedRowVersion": 1,
                "name": "Rolled back revision",
                "description": "",
                "groups": groups(),
            },
        )

    await db_session.rollback()
    db_session.expire_all()
    original = await db_session.get(AssessmentTemplate, template_id)
    assert original is not None
    assert (original.status, original.version, original.row_version) == ("DRAFT", 1, 1)
    revisions = list(
        (
            await db_session.scalars(
                select(AssessmentTemplate.version)
                .where(AssessmentTemplate.family_id == family_id)
                .order_by(AssessmentTemplate.version)
            )
        ).all()
    )
    assert revisions == [1]
    assert await logs(db_session, "assessment_template", template_id) == []


async def test_cycle_close_and_reopen_use_typed_transitions_versions_and_safe_audits(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    seeded = await seed(db_session, template_status="ACTIVE", with_cycle=True)
    cycle = seeded["cycle"]
    cycle_id = cycle.id
    actor_headers = await headers(client, seeded["actor"])

    same = await client.patch(
        f"/api/v2/assessments/cycles/{cycle_id}",
        headers=actor_headers,
        json={"expectedVersion": 1, "status": "OPEN"},
    )
    assert same.status_code == 409
    assert same.json()["detail"] == {"code": "invalid_state", "currentStatus": "OPEN"}

    closed = await client.patch(
        f"/api/v2/assessments/cycles/{cycle_id}",
        headers=actor_headers,
        json={"expectedVersion": 1, "status": "CLOSED"},
    )
    assert closed.status_code == 200, closed.text
    assert (closed.json()["status"], closed.json()["version"]) == ("CLOSED", 2)

    stale = await client.patch(
        f"/api/v2/assessments/cycles/{cycle_id}",
        headers=actor_headers,
        json={"expectedVersion": 1, "status": "OPEN"},
    )
    assert stale.status_code == 409
    assert stale.json()["detail"] == {"code": "version_conflict", "currentVersion": 2}

    reopened = await client.patch(
        f"/api/v2/assessments/cycles/{cycle_id}",
        headers=actor_headers,
        json={"expectedVersion": 2, "status": "OPEN"},
    )
    assert reopened.status_code == 200, reopened.text
    assert (reopened.json()["status"], reopened.json()["version"]) == ("OPEN", 3)

    audit_rows = await logs(db_session, "assessment_cycle", cycle_id)
    assert [row.action for row in audit_rows] == [
        "assessment.cycle.closed",
        "assessment.cycle.opened",
    ]
    assert [row.changes["toVersion"] for row in audit_rows] == [2, 3]
    for row in audit_rows:
        assert_metadata_only(row)


async def test_cycle_audit_failure_rolls_back_transition(
    client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seeded = await seed(db_session, template_status="ACTIVE", with_cycle=True)
    cycle_id = seeded["cycle"].id
    actor_headers = await headers(client, seeded["actor"])

    async def fail_audit(*args: object, **kwargs: object) -> ActivityLog:
        raise RuntimeError("synthetic cycle audit failure")

    monkeypatch.setattr(ActivityLogRepository, "log", fail_audit)
    with pytest.raises(RuntimeError, match="synthetic cycle audit failure"):
        await client.patch(
            f"/api/v2/assessments/cycles/{cycle_id}",
            headers=actor_headers,
            json={"expectedVersion": 1, "status": "CLOSED"},
        )
    await db_session.rollback()
    db_session.expire_all()
    persisted = await db_session.get(AssessmentCycle, cycle_id)
    assert persisted is not None
    assert (persisted.status, persisted.version) == ("OPEN", 1)
    assert await logs(db_session, "assessment_cycle", cycle_id) == []


async def test_create_cycle_requires_active_same_tenant_and_audits_transaction(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    seeded = await seed(db_session, template_status="ACTIVE")
    company_id = seeded["company"].id
    template_id = seeded["template"].id
    actor_headers = await headers(client, seeded["actor"])
    response = await client.post(
        "/api/v2/assessments/cycles",
        headers=actor_headers,
        json={
            "companyId": str(company_id),
            "templateId": str(template_id),
            "name": "Private cycle name",
            "period": "2026-10",
        },
    )
    assert response.status_code == 201, response.text
    cycle_id = response.json()["id"]
    audit_rows = await logs(db_session, "assessment_cycle", cycle_id)
    assert [row.action for row in audit_rows] == ["assessment.cycle.created"]
    assert audit_rows[0].changes == {
        "templateId": str(template_id),
        "status": "OPEN",
        "version": 1,
    }
    assert_metadata_only(audit_rows[0])

    draft = await seed(db_session, suffix="-draft")
    inactive = await client.post(
        "/api/v2/assessments/cycles",
        headers=await headers(client, draft["actor"]),
        json={
            "companyId": str(draft["company"].id),
            "templateId": str(draft["template"].id),
            "name": "Inactive template cycle",
            "period": "2026-10",
        },
    )
    assert inactive.status_code == 422

    cross_tenant = await client.post(
        "/api/v2/assessments/cycles",
        headers=actor_headers,
        json={
            "companyId": str(company_id),
            "templateId": str(draft["template"].id),
            "name": "Cross tenant cycle",
            "period": "2026-11",
        },
    )
    assert cross_tenant.status_code == 403


async def test_create_cycle_audit_failure_rolls_back_insert(
    client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seeded = await seed(db_session, template_status="ACTIVE")
    company_id = seeded["company"].id
    template_id = seeded["template"].id
    actor_headers = await headers(client, seeded["actor"])

    async def fail_audit(*args: object, **kwargs: object) -> ActivityLog:
        raise RuntimeError("synthetic create audit failure")

    monkeypatch.setattr(ActivityLogRepository, "log", fail_audit)
    with pytest.raises(RuntimeError, match="synthetic create audit failure"):
        await client.post(
            "/api/v2/assessments/cycles",
            headers=actor_headers,
            json={
                "companyId": str(company_id),
                "templateId": str(template_id),
                "name": "Rolled back cycle",
                "period": "2026-10",
            },
        )
    await db_session.rollback()
    assert (
        await db_session.scalar(
            select(func.count())
            .select_from(AssessmentCycle)
            .where(
                AssessmentCycle.company_id == company_id,
                AssessmentCycle.period == "2026-10",
            )
        )
        == 0
    )


async def test_concurrent_cycle_close_has_one_winner_and_typed_conflict_on_postgresql(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    if db_session.bind is None or db_session.bind.dialect.name != "postgresql":
        pytest.skip("PostgreSQL is required for row-lock concurrency coverage")
    seeded = await seed(db_session, template_status="ACTIVE", with_cycle=True)
    cycle_id = seeded["cycle"].id
    actor_headers = await headers(client, seeded["actor"])
    release_selects = asyncio.Event()
    select_arrivals = 0
    arrival_lock = asyncio.Lock()

    class BarrierSession(AsyncSession):
        async def scalar(self, statement, *args, **kwargs):
            nonlocal select_arrivals
            if isinstance(statement, Select) and statement._for_update_arg is not None:
                async with arrival_lock:
                    select_arrivals += 1
                    if select_arrivals == 2:
                        release_selects.set()
                await asyncio.wait_for(release_selects.wait(), timeout=3)
            return await super().scalar(statement, *args, **kwargs)

    session_factory = async_sessionmaker(
        db_session.bind, class_=BarrierSession, expire_on_commit=False
    )

    async def concurrent_session():
        async with session_factory() as session:
            yield session

    original_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = concurrent_session
    try:
        async with (
            AsyncClient(transport=ASGITransport(app=app), base_url="http://cycle-a") as first,
            AsyncClient(transport=ASGITransport(app=app), base_url="http://cycle-b") as second,
        ):
            responses = await asyncio.wait_for(
                asyncio.gather(
                    first.patch(
                        f"/api/v2/assessments/cycles/{cycle_id}",
                        headers=actor_headers,
                        json={"expectedVersion": 1, "status": "CLOSED"},
                    ),
                    second.patch(
                        f"/api/v2/assessments/cycles/{cycle_id}",
                        headers=actor_headers,
                        json={"expectedVersion": 1, "status": "CLOSED"},
                    ),
                ),
                timeout=10,
            )
    finally:
        if original_override is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = original_override

    assert select_arrivals == 2
    assert sorted(response.status_code for response in responses) == [200, 409]
    loser = next(response for response in responses if response.status_code == 409)
    assert loser.json()["detail"] == {"code": "version_conflict", "currentVersion": 2}
    assert len(await logs(db_session, "assessment_cycle", cycle_id)) == 1
    db_session.expire_all()
    persisted = await db_session.get(AssessmentCycle, cycle_id)
    assert persisted is not None
    assert (persisted.status, persisted.version) == ("CLOSED", 2)


async def test_concurrent_template_edits_create_one_revision_and_one_typed_conflict_on_postgresql(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    if db_session.bind is None or db_session.bind.dialect.name != "postgresql":
        pytest.skip("PostgreSQL is required for row-lock concurrency coverage")
    seeded = await seed(db_session)
    template_id = seeded["template"].id
    family_id = seeded["template"].family_id
    actor_headers = await headers(client, seeded["actor"])
    release_selects = asyncio.Event()
    select_arrivals = 0
    arrival_lock = asyncio.Lock()

    class BarrierSession(AsyncSession):
        async def scalar(self, statement, *args, **kwargs):
            nonlocal select_arrivals
            if isinstance(statement, Select) and statement._for_update_arg is not None:
                async with arrival_lock:
                    select_arrivals += 1
                    if select_arrivals == 2:
                        release_selects.set()
                await asyncio.wait_for(release_selects.wait(), timeout=3)
            return await super().scalar(statement, *args, **kwargs)

    session_factory = async_sessionmaker(
        db_session.bind, class_=BarrierSession, expire_on_commit=False
    )

    async def concurrent_session():
        async with session_factory() as session:
            yield session

    payload = {
        "expectedRowVersion": 1,
        "name": "Concurrent revision",
        "description": "",
        "groups": groups(),
    }
    original_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = concurrent_session
    try:
        async with (
            AsyncClient(transport=ASGITransport(app=app), base_url="http://template-a") as first,
            AsyncClient(transport=ASGITransport(app=app), base_url="http://template-b") as second,
        ):
            responses = await asyncio.wait_for(
                asyncio.gather(
                    first.put(
                        f"/api/v2/assessments/templates/{template_id}",
                        headers=actor_headers,
                        json=payload,
                    ),
                    second.put(
                        f"/api/v2/assessments/templates/{template_id}",
                        headers=actor_headers,
                        json=payload,
                    ),
                ),
                timeout=10,
            )
    finally:
        if original_override is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = original_override

    assert select_arrivals == 2
    assert sorted(response.status_code for response in responses) == [200, 409]
    loser = next(response for response in responses if response.status_code == 409)
    assert loser.json()["detail"] == {"code": "version_conflict", "currentVersion": 2}
    await db_session.rollback()
    db_session.expire_all()
    revisions = list(
        (
            await db_session.scalars(
                select(AssessmentTemplate.version)
                .where(AssessmentTemplate.family_id == family_id)
                .order_by(AssessmentTemplate.version)
            )
        ).all()
    )
    assert revisions == [1, 2]
    audit_rows = await logs(db_session, "assessment_template", template_id)
    assert [row.action for row in audit_rows] == ["assessment.template.revised"]
