from __future__ import annotations

import asyncio
import uuid
from datetime import UTC, datetime
from unicodedata import normalize

import pytest
from httpx import AsyncClient
from pydantic import ValidationError
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.competency_schemas import (
    AwardPatch,
    CertificationPatch,
    EmployeeSkillReplace,
    ExperiencePatch,
    ProjectPatch,
)
from app.domain.enums import AdminPermission, ProfileSourceType, Role
from app.domain.models import (
    ActivityLog,
    Award,
    Certification,
    Company,
    EmployeeSkill,
    Employment,
    Experience,
    Project,
    Skill,
    User,
)
from app.repositories.activity_repo import ActivityLogRepository
from app.repositories.user_repo import CompanyRepository, EmploymentRepository
from app.services.competency_profile_service import CompetencyProfileService
from tests.test_core_profile_api import create_user, login


@pytest.mark.asyncio
async def test_skill_catalog_is_normalized_unique_and_employee_skills_are_full_replace(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    employee = await create_user(db_session, email="skills@acme.dev", name="Skill Owner")
    headers = await login(client, employee.email)

    first = await client.post(
        "/api/v2/skills-competency/skills",
        headers=headers,
        json={"name": "  React   Native  ", "category": "  Mobile   Development "},
    )
    duplicate = await client.post(
        "/api/v2/skills-competency/skills", headers=headers, json={"name": "react native"}
    )
    assert first.status_code == duplicate.status_code == 200
    assert first.json()["id"] == duplicate.json()["id"]
    assert first.json()["name"] == "React Native"
    assert first.json()["category"] == "Mobile Development"

    python = await client.post(
        "/api/v2/skills-competency/skills", headers=headers, json={"name": "Python"}
    )
    replaced = await client.put(
        f"/api/v2/skills-competency/users/{employee.id}/skills",
        headers=headers,
        json={
            "profileVersion": 1,
            "skills": [
                {"skillId": first.json()["id"], "rating": 5, "note": "Used in production"},
                {"skillId": python.json()["id"], "rating": 3, "note": None},
            ],
        },
    )
    assert replaced.status_code == 200, replaced.text
    assert replaced.json()["profileVersion"] == 2
    assert replaced.json()["items"][0]["version"] == 1
    assert [(item["name"], item["rating"]) for item in replaced.json()["items"]] == [
        ("Python", 3),
        ("React Native", 5),
    ]
    assert {item["sourceType"] for item in replaced.json()["items"]} == {"SELF"}
    assert replaced.json()["items"][1]["note"] == "Used in production"
    assert replaced.json()["items"][1]["category"] == "Mobile Development"
    assert all(item["selfAssessed"] is True for item in replaced.json()["items"])

    full_replace = await client.put(
        f"/api/v2/skills-competency/users/{employee.id}/skills",
        headers=headers,
        json={
            "profileVersion": 2,
            "skills": [{"skillId": python.json()["id"], "rating": 4}],
        },
    )
    assert full_replace.status_code == 200
    assert [item["name"] for item in full_replace.json()["items"]] == ["Python"]
    assert await db_session.scalar(select(func.count()).select_from(EmployeeSkill)) == 1

    invalid = await client.put(
        f"/api/v2/skills-competency/users/{employee.id}/skills",
        headers=headers,
        json={
            "profileVersion": 3,
            "skills": [{"skillId": python.json()["id"], "rating": 6}],
        },
    )
    assert invalid.status_code == 422
    assert [
        item["name"]
        for item in (
            await client.get(f"/api/v2/skills-competency/users/{employee.id}", headers=headers)
        ).json()["items"]
    ] == ["Python"]
    skill_logs = list(
        (
            await db_session.scalars(select(ActivityLog).where(ActivityLog.entity_type == "skill"))
        ).all()
    )
    assert [item.action for item in skill_logs] == [
        "profile.skill.created",
        "profile.skill.created",
    ]
    assert all("React Native" not in str(item.changes) for item in skill_logs)


@pytest.mark.asyncio
async def test_skill_catalog_rejects_casefold_expansion_beyond_normalized_key_limit(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    employee = await create_user(db_session, email="skill-overflow@acme.dev", name="Owner")
    headers = await login(client, employee.email)

    response = await client.post(
        "/api/v2/skills-competency/skills",
        headers=headers,
        json={"name": "ß" * 120},
    )

    assert response.status_code == 422
    assert await db_session.scalar(select(func.count()).select_from(Skill)) == 0


@pytest.mark.asyncio
async def test_aggregate_refreshes_stale_self_user_inside_repeatable_read_snapshot(
    db_session: AsyncSession,
) -> None:
    if db_session.bind is None or db_session.bind.dialect.name != "postgresql":
        pytest.skip("PostgreSQL snapshot identity-map regression")
    employee = await create_user(db_session, email="aggregate-snapshot@acme.dev", name="Before")
    assert employee.company_id is not None
    stale_actor = await db_session.get(User, employee.id)
    assert stale_actor is not None and stale_actor.version == 1

    async with AsyncSession(bind=db_session.bind, expire_on_commit=False) as writer:
        await writer.execute(
            update(User).where(User.id == employee.id).values(name="After", version=2)
        )
        writer.add(
            Experience(
                user_id=employee.id,
                company_id=employee.company_id,
                title="Snapshot child",
                organization="CareerMate",
                source_type=ProfileSourceType.SELF,
                created_by=employee.id,
                updated_by=employee.id,
            )
        )
        await writer.commit()

    view = await CompetencyProfileService(db_session).aggregate(stale_actor, None)

    assert view.user.name == "After"
    assert view.user.version == 2
    assert [item.title for item in view.experiences] == ["Snapshot child"]


@pytest.mark.asyncio
async def test_self_resource_and_skill_lists_refresh_stale_user_identity(
    db_session: AsyncSession,
) -> None:
    if db_session.bind is None or db_session.bind.dialect.name != "postgresql":
        pytest.skip("PostgreSQL list identity-map regression")
    employee = await create_user(db_session, email="list-snapshot@acme.dev", name="Before")
    assert employee.company_id is not None
    stale_actor = await db_session.get(User, employee.id)
    assert stale_actor is not None and stale_actor.version == 1

    async with AsyncSession(bind=db_session.bind, expire_on_commit=False) as writer:
        await writer.execute(update(User).where(User.id == employee.id).values(version=2))
        writer.add(
            Experience(
                user_id=employee.id,
                company_id=employee.company_id,
                title="Fresh resource",
                organization="CareerMate",
                source_type=ProfileSourceType.SELF,
                created_by=employee.id,
                updated_by=employee.id,
            )
        )
        await writer.commit()

    service = CompetencyProfileService(db_session)
    resource_target, resources = await service.list_resources("experience", stale_actor, None)
    assert resource_target.version == 2
    assert [item.title for item in resources if isinstance(item, Experience)] == ["Fresh resource"]

    skill_id = uuid.uuid4()
    async with AsyncSession(bind=db_session.bind, expire_on_commit=False) as writer:
        await writer.execute(update(User).where(User.id == employee.id).values(version=3))
        writer.add(Skill(id=skill_id, name="Fresh skill", normalized_key="fresh skill"))
        writer.add(
            EmployeeSkill(
                user_id=employee.id,
                company_id=employee.company_id,
                skill_id=skill_id,
                rating=4,
                note=None,
                self_assessed=True,
                source_type=ProfileSourceType.SELF,
                created_by=employee.id,
                updated_by=employee.id,
            )
        )
        await writer.commit()

    skill_target, skills = await service.list_employee_skills(stale_actor, employee.id)
    assert skill_target.version == 3
    assert [item.skill.name for item in skills] == ["Fresh skill"]


@pytest.mark.parametrize("list_kind", ["resource", "skill"])
@pytest.mark.asyncio
async def test_versioned_lists_keep_target_and_items_in_one_snapshot(
    list_kind: str, db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    if db_session.bind is None or db_session.bind.dialect.name != "postgresql":
        pytest.skip("PostgreSQL list snapshot contract")
    employee = await create_user(
        db_session, email=f"{list_kind}-mixed-snapshot@acme.dev", name="Owner"
    )
    assert employee.company_id is not None
    original_skill = Skill(name="Original", normalized_key=f"original-{list_kind}")
    db_session.add(original_skill)
    await db_session.flush()
    db_session.add_all(
        [
            Experience(
                user_id=employee.id,
                company_id=employee.company_id,
                title="Original",
                organization="CareerMate",
                source_type=ProfileSourceType.SELF,
                created_by=employee.id,
                updated_by=employee.id,
            ),
            EmployeeSkill(
                user_id=employee.id,
                company_id=employee.company_id,
                skill_id=original_skill.id,
                rating=3,
                self_assessed=True,
                source_type=ProfileSourceType.SELF,
                created_by=employee.id,
                updated_by=employee.id,
            ),
        ]
    )
    await db_session.commit()

    service = CompetencyProfileService(db_session)
    target_selected = asyncio.Event()
    writer_finished = asyncio.Event()
    original_resolve = service.resolve_target

    async def pause_after_target(*args: object, **kwargs: object) -> User:
        target = await original_resolve(*args, **kwargs)  # type: ignore[arg-type]
        target_selected.set()
        await asyncio.wait_for(writer_finished.wait(), timeout=5)
        return target

    monkeypatch.setattr(service, "resolve_target", pause_after_target)

    async def writer() -> None:
        await asyncio.wait_for(target_selected.wait(), timeout=5)
        async with AsyncSession(bind=db_session.bind, expire_on_commit=False) as session:
            await session.execute(update(User).where(User.id == employee.id).values(version=2))
            if list_kind == "resource":
                session.add(
                    Experience(
                        user_id=employee.id,
                        company_id=employee.company_id,
                        title="Later",
                        organization="CareerMate",
                        source_type=ProfileSourceType.SELF,
                        created_by=employee.id,
                        updated_by=employee.id,
                    )
                )
            else:
                later_skill = Skill(name="Later", normalized_key=f"later-{list_kind}")
                session.add(later_skill)
                await session.flush()
                session.add(
                    EmployeeSkill(
                        user_id=employee.id,
                        company_id=employee.company_id,
                        skill_id=later_skill.id,
                        rating=5,
                        self_assessed=True,
                        source_type=ProfileSourceType.SELF,
                        created_by=employee.id,
                        updated_by=employee.id,
                    )
                )
            await session.commit()
        writer_finished.set()

    writer_task = asyncio.create_task(writer())
    if list_kind == "resource":
        target, items = await service.list_resources("experience", employee, None)
        names = [item.title for item in items if isinstance(item, Experience)]
    else:
        target, skill_items = await service.list_employee_skills(employee, employee.id)
        names = [item.skill.name for item in skill_items]
    await writer_task

    assert target.version == 1
    assert names == ["Original"]


@pytest.mark.asyncio
async def test_resource_capacity_allows_item_200_and_atomically_rejects_item_201(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    employee = await create_user(db_session, email="profile-cap@acme.dev", name="Owner")
    assert employee.company_id is not None
    db_session.add_all(
        [
            Experience(
                user_id=employee.id,
                company_id=employee.company_id,
                title=f"Experience {index:03d}",
                organization="CareerMate",
                source_type=ProfileSourceType.SELF,
                created_by=employee.id,
                updated_by=employee.id,
            )
            for index in range(199)
        ]
    )
    await db_session.commit()
    headers = await login(client, employee.email)

    item_200 = await client.post(
        "/api/v2/competency-profile/experiences",
        headers=headers,
        json={"profileVersion": 1, "title": "Experience 200", "organization": "CareerMate"},
    )
    item_201 = await client.post(
        "/api/v2/competency-profile/experiences",
        headers=headers,
        json={"profileVersion": 2, "title": "Experience 201", "organization": "CareerMate"},
    )
    resource_list = await client.get("/api/v2/competency-profile/experiences", headers=headers)
    aggregate = await client.get("/api/v2/competency-profile", headers=headers)

    assert item_200.status_code == 201
    assert item_201.status_code == 422
    assert item_201.json() == {"detail": "Mỗi danh sách hồ sơ không được vượt quá 200 mục"}
    assert resource_list.status_code == aggregate.status_code == 200
    assert len(resource_list.json()["items"]) == 200
    assert len(aggregate.json()["experiences"]) == 200
    assert resource_list.json()["profileVersion"] == aggregate.json()["version"] == 2


@pytest.mark.asyncio
async def test_concurrent_creates_at_resource_capacity_only_admit_item_200(
    client: AsyncClient, db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    if db_session.bind is None or db_session.bind.dialect.name != "postgresql":
        pytest.skip("PostgreSQL capacity concurrency contract")
    employee = await create_user(db_session, email="profile-cap-race@acme.dev", name="Owner")
    assert employee.company_id is not None
    db_session.add_all(
        [
            Experience(
                user_id=employee.id,
                company_id=employee.company_id,
                title=f"Experience {index:03d}",
                organization="CareerMate",
                source_type=ProfileSourceType.SELF,
                created_by=employee.id,
                updated_by=employee.id,
            )
            for index in range(199)
        ]
    )
    await db_session.commit()
    headers = await login(client, employee.email)
    arrived = 0
    both_ready = asyncio.Event()
    original_cas = CompetencyProfileService._profile_cas

    async def barriered_cas(
        service: CompetencyProfileService, target: User, expected_version: int
    ) -> int:
        nonlocal arrived
        arrived += 1
        if arrived == 2:
            both_ready.set()
        await asyncio.wait_for(both_ready.wait(), timeout=5)
        return await original_cas(service, target, expected_version)

    monkeypatch.setattr(CompetencyProfileService, "_profile_cas", barriered_cas)

    responses = await asyncio.gather(
        client.post(
            "/api/v2/competency-profile/experiences",
            headers=headers,
            json={"profileVersion": 1, "title": "Boundary A", "organization": "CareerMate"},
        ),
        client.post(
            "/api/v2/competency-profile/experiences",
            headers=headers,
            json={"profileVersion": 1, "title": "Boundary B", "organization": "CareerMate"},
        ),
    )

    assert sorted(response.status_code for response in responses) == [201, 409]
    assert await db_session.scalar(select(func.count()).select_from(Experience)) == 200


@pytest.mark.asyncio
async def test_skill_catalog_is_paginated_with_deterministic_order(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    employee = await create_user(db_session, email="skill-pages@acme.dev", name="Owner")
    db_session.add_all(
        [
            Skill(name=f"Skill {index:03d}", normalized_key=f"skill-{index:03d}")
            for index in range(205)
        ]
    )
    await db_session.commit()
    headers = await login(client, employee.email)

    first = await client.get(
        "/api/v2/skills-competency/skills?page=1&pageSize=200", headers=headers
    )
    second = await client.get(
        "/api/v2/skills-competency/skills?page=2&pageSize=200", headers=headers
    )

    assert first.status_code == second.status_code == 200
    assert (first.json()["total"], first.json()["page"], first.json()["pageSize"]) == (205, 1, 200)
    assert len(first.json()["items"]) == 200
    assert [item["name"] for item in second.json()["items"]] == [
        f"Skill {index:03d}" for index in range(200, 205)
    ]


@pytest.mark.asyncio
async def test_skill_catalog_count_and_page_share_one_snapshot_during_sort_shifting_insert(
    db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    if db_session.bind is None or db_session.bind.dialect.name != "postgresql":
        pytest.skip("PostgreSQL catalog snapshot contract")
    db_session.add_all(
        [
            Skill(name="Beta", normalized_key="beta-snapshot"),
            Skill(name="Zulu", normalized_key="zulu-snapshot"),
        ]
    )
    await db_session.commit()
    service = CompetencyProfileService(db_session)
    count_finished = asyncio.Event()
    writer_finished = asyncio.Event()
    original_scalar = db_session.scalar
    scalar_calls = 0

    async def pause_after_count(*args: object, **kwargs: object) -> object:
        nonlocal scalar_calls
        result = await original_scalar(*args, **kwargs)  # type: ignore[arg-type]
        scalar_calls += 1
        if scalar_calls == 1:
            count_finished.set()
            await asyncio.wait_for(writer_finished.wait(), timeout=5)
        return result

    monkeypatch.setattr(db_session, "scalar", pause_after_count)

    async def writer() -> None:
        await asyncio.wait_for(count_finished.wait(), timeout=5)
        async with AsyncSession(bind=db_session.bind, expire_on_commit=False) as session:
            session.add(Skill(name="Alpha", normalized_key="alpha-snapshot"))
            await session.commit()
        writer_finished.set()

    writer_task = asyncio.create_task(writer())
    items, total = await service.list_skills(page=1, page_size=1)
    await writer_task

    assert total == 2
    assert [item.name for item in items] == ["Beta"]


@pytest.mark.asyncio
async def test_skill_catalog_rejects_excessive_page_number(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    employee = await create_user(db_session, email="skill-page-bound@acme.dev", name="Owner")
    headers = await login(client, employee.email)

    response = await client.get(
        "/api/v2/skills-competency/skills?page=10001&pageSize=50", headers=headers
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_resources_are_distinct_from_employment_and_aggregate_timeline_is_stable(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    company = await CompanyRepository(db_session).add(Company(name="Timeline Company"))
    await db_session.flush()
    employee = await create_user(
        db_session, email="timeline@acme.dev", name="Timeline Owner", company=company
    )
    employment = await EmploymentRepository(db_session).add(
        Employment(
            user_id=employee.id,
            company_id=company.id,
            title="Engineer",
            start_date=datetime(2024, 1, 1, tzinfo=UTC),
        )
    )
    await db_session.commit()
    headers = await login(client, employee.email)

    experience = await client.post(
        "/api/v2/competency-profile/experiences",
        headers=headers,
        json={
            "profileVersion": 1,
            "title": "Community Mentor",
            "organization": "Tech Community",
            "employmentId": str(employment.id),
            "startDate": "2025-05-01",
            "endDate": "2025-08-01",
        },
    )
    project = await client.post(
        "/api/v2/competency-profile/projects",
        headers=headers,
        json={
            "profileVersion": 2,
            "name": "CareerMate",
            "role": "Backend Engineer",
            "employmentId": str(employment.id),
            "domain": "HR Tech",
            "techStack": ["FastAPI", "PostgreSQL"],
            "contribution": "Designed the tenant-safe profile aggregate",
            "startDate": "2025-05-01",
            "url": "https://example.invalid/project",
        },
    )
    certification = await client.post(
        "/api/v2/competency-profile/certifications",
        headers=headers,
        json={
            "profileVersion": 3,
            "name": "Cloud Professional",
            "type": "PROFESSIONAL",
            "issuer": "Example Institute",
            "score": "Pass",
            "issuedAt": "2025-05-01",
        },
    )
    award = await client.post(
        "/api/v2/competency-profile/awards",
        headers=headers,
        json={
            "profileVersion": 4,
            "name": "Hackathon Winner",
            "type": "WORK",
            "issuer": "CareerMate",
            "evidenceUrl": "https://example.invalid/award",
            "awardedAt": None,
        },
    )
    for response in (experience, project, certification, award):
        assert response.status_code == 201, response.text
        assert response.json()["sourceType"] == "SELF"
        assert response.json()["createdBy"] == str(employee.id)
        assert response.json()["updatedBy"] == str(employee.id)
        assert "email" not in response.text
    assert project.json()["techStack"] == ["FastAPI", "PostgreSQL"]
    assert project.json()["contribution"] == "Designed the tenant-safe profile aggregate"
    assert certification.json()["type"] == "PROFESSIONAL"
    assert certification.json()["score"] == "Pass"
    assert award.json()["type"] == "WORK"
    assert award.json()["selfReported"] is True
    assert experience.json()["id"] != str(employment.id)
    assert experience.json()["employmentId"] == str(employment.id)

    aggregate = await client.get("/api/v2/competency-profile", headers=headers)
    assert aggregate.status_code == 200, aggregate.text
    body = aggregate.json()
    assert body["version"] == 5
    assert body["user"] == {
        "id": str(employee.id),
        "name": "Timeline Owner",
        "jobTitle": "Nhân viên",
    }
    assert [item["id"] for item in body["experiences"]] == [experience.json()["id"]]
    assert [item["id"] for item in body["employments"]] == [str(employment.id)]
    assert [item["kind"] for item in body["timeline"]] == [
        "CERTIFICATION",
        "EXPERIENCE",
        "PROJECT",
        "EMPLOYMENT",
    ]
    assert all(item["id"] != award.json()["id"] for item in body["timeline"])
    assert "email" not in aggregate.text
    assert "companyId" not in aggregate.text


@pytest.mark.asyncio
async def test_award_crud_preserves_origin_and_uses_profile_version(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    company = await CompanyRepository(db_session).add(Company(name="Award Company"))
    await db_session.flush()
    employee = await create_user(
        db_session, email="award-owner@acme.dev", name="Award Owner", company=company
    )
    admin = await create_user(
        db_session,
        email="award-admin@acme.dev",
        name="Award Admin",
        role=Role.COMPANY_ADMIN,
        company=company,
        admin_permissions=[
            AdminPermission.EMPLOYEE_READ.value,
            AdminPermission.EMPLOYEE_WRITE.value,
        ],
    )
    admin_headers = await login(client, admin.email)

    created = await client.post(
        f"/api/v2/competency-profile/awards?userId={employee.id}",
        headers=admin_headers,
        json={
            "profileVersion": 1,
            "name": "Team Impact",
            "type": "WORK",
            "issuer": "Award Company",
            "description": "Recognised for cross-team delivery",
            "evidenceUrl": "https://example.invalid/team-impact",
            "awardedAt": "2026-01-01",
        },
    )
    assert created.status_code == 201, created.text
    assert created.json()["sourceType"] == "ADMIN"
    assert created.json()["createdBy"] == str(admin.id)
    assert created.json()["updatedBy"] == str(admin.id)
    assert created.json()["selfReported"] is False
    assert created.json()["type"] == "WORK"
    assert created.json()["issuer"] == "Award Company"
    assert created.json()["description"] == "Recognised for cross-team delivery"
    assert created.json()["evidenceUrl"] == "https://example.invalid/team-impact"
    assert created.json()["awardedAt"] == "2026-01-01"

    read = await client.get(
        f"/api/v2/competency-profile/awards/{created.json()['id']}?userId={employee.id}",
        headers=admin_headers,
    )
    assert read.status_code == 200
    assert read.json() == created.json()

    stale_create = await client.post(
        f"/api/v2/competency-profile/awards?userId={employee.id}",
        headers=admin_headers,
        json={
            "profileVersion": 1,
            "name": "Stale create",
            "type": "PERSONAL",
            "issuer": "Award Company",
        },
    )
    assert stale_create.status_code == 409
    assert stale_create.json()["currentProfileVersion"] == 2

    stale = await client.patch(
        f"/api/v2/competency-profile/awards/{created.json()['id']}?userId={employee.id}",
        headers=admin_headers,
        json={"profileVersion": 1, "name": "Stale overwrite"},
    )
    assert stale.status_code == 409
    assert stale.json()["currentProfileVersion"] == 2

    updated = await client.patch(
        f"/api/v2/competency-profile/awards/{created.json()['id']}?userId={employee.id}",
        headers=admin_headers,
        json={
            "profileVersion": 2,
            "name": "Community Impact",
            "type": "PERSONAL",
            "issuer": "Community Council",
            "description": "Recognised for community mentoring",
            "evidenceUrl": "https://example.invalid/community-impact",
            "awardedAt": "2026-02-01",
        },
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["sourceType"] == "ADMIN"
    assert updated.json()["createdBy"] == str(admin.id)
    assert updated.json()["updatedBy"] == str(admin.id)
    assert updated.json()["selfReported"] is False
    assert updated.json()["name"] == "Community Impact"
    assert updated.json()["type"] == "PERSONAL"
    assert updated.json()["issuer"] == "Community Council"
    assert updated.json()["description"] == "Recognised for community mentoring"
    assert updated.json()["evidenceUrl"] == "https://example.invalid/community-impact"
    assert updated.json()["awardedAt"] == "2026-02-01"

    stale_delete = await client.request(
        "DELETE",
        f"/api/v2/competency-profile/awards/{created.json()['id']}?userId={employee.id}",
        headers=admin_headers,
        json={"profileVersion": 2},
    )
    assert stale_delete.status_code == 409
    assert stale_delete.json()["currentProfileVersion"] == 3

    removed = await client.request(
        "DELETE",
        f"/api/v2/competency-profile/awards/{created.json()['id']}?userId={employee.id}",
        headers=admin_headers,
        json={"profileVersion": 3},
    )
    assert removed.status_code == 204
    assert (
        await client.get(
            f"/api/v2/competency-profile/awards?userId={employee.id}", headers=admin_headers
        )
    ).json() == {"items": [], "profileVersion": 4}

    actions = list(
        (
            await db_session.scalars(
                select(ActivityLog.action)
                .where(ActivityLog.entity_type == "award")
                .order_by(ActivityLog.created_at, ActivityLog.id)
            )
        ).all()
    )
    assert actions == ["profile.award.created", "profile.award.updated", "profile.award.deleted"]


@pytest.mark.asyncio
async def test_award_owner_edit_reclassifies_admin_resource_as_self_reported(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    company = await CompanyRepository(db_session).add(Company(name="Provenance Company"))
    await db_session.flush()
    employee = await create_user(
        db_session, email="provenance-owner@acme.dev", name="Resource Owner", company=company
    )
    admin = await create_user(
        db_session,
        email="provenance-admin@acme.dev",
        name="Resource Admin",
        role=Role.COMPANY_ADMIN,
        company=company,
        admin_permissions=[
            AdminPermission.EMPLOYEE_READ.value,
            AdminPermission.EMPLOYEE_WRITE.value,
        ],
    )
    admin_headers = await login(client, admin.email)
    employee_headers = await login(client, employee.email)
    created = await client.post(
        f"/api/v2/competency-profile/awards?userId={employee.id}",
        headers=admin_headers,
        json={
            "profileVersion": 1,
            "name": "Admin-entered award",
            "type": "WORK",
            "issuer": "Provenance Company",
        },
    )
    assert created.status_code == 201
    assert created.json()["sourceType"] == "ADMIN"

    edited = await client.patch(
        f"/api/v2/competency-profile/awards/{created.json()['id']}",
        headers=employee_headers,
        json={"profileVersion": 2, "name": "Owner-confirmed award"},
    )

    assert edited.status_code == 200, edited.text
    assert edited.json()["sourceType"] == "SELF"
    assert edited.json()["sourceImportId"] is None
    assert edited.json()["proposalItemId"] is None
    assert edited.json()["createdBy"] == str(admin.id)
    assert edited.json()["updatedBy"] == str(employee.id)
    assert edited.json()["selfReported"] is True


@pytest.mark.parametrize("field", ["name", "type", "issuer"])
def test_award_patch_rejects_null_required_fields(field: str) -> None:
    with pytest.raises(ValidationError):
        AwardPatch.model_validate({"profileVersion": 1, field: None})


@pytest.mark.asyncio
async def test_every_profile_resource_read_and_write_is_tenant_scoped(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    own_company = await CompanyRepository(db_session).add(Company(name="Own"))
    foreign_company = await CompanyRepository(db_session).add(Company(name="Foreign"))
    await db_session.flush()
    own_employee = await create_user(
        db_session, email="own-resource@acme.dev", name="Own Employee", company=own_company
    )
    foreign_employee = await create_user(
        db_session,
        email="foreign-resource@other.dev",
        name="Foreign Employee",
        company=foreign_company,
    )
    admin = await create_user(
        db_session,
        email="tenant-resource-admin@acme.dev",
        name="Admin",
        role=Role.COMPANY_ADMIN,
        company=own_company,
        admin_permissions=[
            AdminPermission.EMPLOYEE_READ.value,
            AdminPermission.EMPLOYEE_WRITE.value,
        ],
    )
    reader = await create_user(
        db_session,
        email="tenant-resource-reader@acme.dev",
        name="Reader",
        role=Role.COMPANY_ADMIN,
        company=own_company,
        admin_permissions=[AdminPermission.EMPLOYEE_READ.value],
    )
    super_admin = await create_user(
        db_session,
        email="tenant-resource-super@careermate.dev",
        name="Platform Admin",
        role=Role.SUPER_ADMIN,
    )
    employee_headers = await login(client, own_employee.email)
    admin_headers = await login(client, admin.email)
    reader_headers = await login(client, reader.email)
    super_headers = await login(client, super_admin.email)
    foreign_employment = await EmploymentRepository(db_session).add(
        Employment(
            user_id=foreign_employee.id,
            company_id=foreign_company.id,
            title="Foreign role",
            start_date=datetime(2025, 1, 1, tzinfo=UTC),
        )
    )
    await db_session.commit()

    assert (
        await client.get(
            f"/api/v2/competency-profile?userId={foreign_employee.id}", headers=admin_headers
        )
    ).status_code == 404
    assert (
        await client.get(
            f"/api/v2/competency-profile/experiences?userId={foreign_employee.id}",
            headers=admin_headers,
        )
    ).status_code == 404
    assert (
        await client.post(
            f"/api/v2/competency-profile/experiences?userId={foreign_employee.id}",
            headers=admin_headers,
            json={"profileVersion": 1, "title": "Hidden", "organization": "Foreign"},
        )
    ).status_code == 404
    assert (
        await client.get(
            f"/api/v2/competency-profile?userId={foreign_employee.id}", headers=employee_headers
        )
    ).status_code == 404
    assert (
        await client.post(
            f"/api/v2/competency-profile/experiences?userId={own_employee.id}",
            headers=reader_headers,
            json={"profileVersion": 1, "title": "Denied", "organization": "Own"},
        )
    ).status_code == 403

    invalid_employment = await client.post(
        "/api/v2/competency-profile/experiences",
        headers=employee_headers,
        json={
            "profileVersion": 1,
            "title": "Scoped experience",
            "organization": "Own",
            "employmentId": str(foreign_employment.id),
        },
    )
    assert invalid_employment.status_code == 422
    assert (await client.get("/api/v2/competency-profile", headers=employee_headers)).json()[
        "version"
    ] == 1

    super_created = await client.post(
        f"/api/v2/competency-profile/awards?userId={own_employee.id}",
        headers=super_headers,
        json={
            "profileVersion": 1,
            "name": "Platform recognition",
            "type": "WORK",
            "issuer": "CareerMate",
        },
    )
    assert super_created.status_code == 201, super_created.text
    assert super_created.json()["sourceType"] == "ADMIN"
    assert super_created.json()["createdBy"] == str(super_admin.id)

    forged = await client.post(
        "/api/v2/competency-profile/experiences",
        headers=employee_headers,
        json={
            "profileVersion": 1,
            "title": "Forged",
            "organization": "Own",
            "companyId": str(foreign_company.id),
            "sourceType": "IMPORT",
            "createdBy": str(admin.id),
            "version": 99,
        },
    )
    assert forged.status_code == 422
    assert await db_session.scalar(select(func.count()).select_from(Experience)) == 0


def test_profile_resource_database_contracts_are_declared() -> None:
    for model in (EmployeeSkill, Experience, Project, Certification, Award):
        constraint_names = {constraint.name for constraint in model.__table__.constraints}
        index_names = {index.name for index in model.__table__.indexes}
        assert any(name and name.endswith("_provenance") for name in constraint_names)
        assert any(name and name.endswith("_import_scope") for name in constraint_names)
        assert any(name and name.endswith("_proposal_scope") for name in constraint_names)
        assert any(name and name.endswith("_import_item") for name in constraint_names)
        assert any(name and "company_user" in name for name in index_names)
        assert f"ix_{model.__tablename__}_user" in index_names
    project_constraints = {constraint.name for constraint in Project.__table__.constraints}
    experience_constraints = {constraint.name for constraint in Experience.__table__.constraints}
    assert "fk_projects_employment_scope" in project_constraints
    assert "fk_experiences_employment_scope" in experience_constraints


@pytest.mark.parametrize(
    ("schema", "payload"),
    [
        (ExperiencePatch, {"profileVersion": 1, "title": None}),
        (ProjectPatch, {"profileVersion": 1, "role": None}),
        (CertificationPatch, {"profileVersion": 1, "type": None}),
        (AwardPatch, {"profileVersion": 1, "issuer": None}),
    ],
)
def test_patch_rejects_null_for_required_resource_fields(
    schema: type, payload: dict[str, object]
) -> None:
    with pytest.raises(ValidationError):
        schema.model_validate(payload)


@pytest.mark.asyncio
async def test_resource_mutation_rolls_back_when_audit_fails(
    client: AsyncClient, db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    employee = await create_user(db_session, email="resource-rollback@acme.dev", name="Owner")
    employee_id = employee.id
    headers = await login(client, employee.email)

    async def fail_audit(*args: object, **kwargs: object) -> ActivityLog:
        raise RuntimeError("synthetic resource audit failure")

    monkeypatch.setattr(ActivityLogRepository, "log", fail_audit)
    with pytest.raises(RuntimeError, match="synthetic resource audit failure"):
        await client.post(
            "/api/v2/competency-profile/experiences",
            headers=headers,
            json={"profileVersion": 1, "title": "Rollback", "organization": "Test"},
        )

    assert await db_session.scalar(select(func.count()).select_from(Experience)) == 0
    db_session.expire_all()
    persisted = await db_session.get(type(employee), employee_id)
    assert persisted is not None
    assert persisted.version == 1


@pytest.mark.asyncio
async def test_concurrent_skill_replacements_allow_one_profile_version_on_postgresql(
    client: AsyncClient, db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    if db_session.bind is None or db_session.bind.dialect.name != "postgresql":
        pytest.skip("PostgreSQL concurrency contract")
    employee = await create_user(db_session, email="skills-race@acme.dev", name="Race Owner")
    headers = await login(client, employee.email)
    first = (
        await client.post(
            "/api/v2/skills-competency/skills", headers=headers, json={"name": "Rust"}
        )
    ).json()
    second = (
        await client.post("/api/v2/skills-competency/skills", headers=headers, json={"name": "Go"})
    ).json()
    arrived = 0
    both_ready = asyncio.Event()
    original_cas = CompetencyProfileService._profile_cas

    async def barriered_cas(
        service: CompetencyProfileService, target: User, expected_version: int
    ) -> int:
        nonlocal arrived
        arrived += 1
        if arrived == 2:
            both_ready.set()
        await asyncio.wait_for(both_ready.wait(), timeout=5)
        return await original_cas(service, target, expected_version)

    monkeypatch.setattr(CompetencyProfileService, "_profile_cas", barriered_cas)

    responses = await asyncio.gather(
        client.put(
            f"/api/v2/skills-competency/users/{employee.id}/skills",
            headers=headers,
            json={"profileVersion": 1, "skills": [{"skillId": first["id"], "rating": 4}]},
        ),
        client.put(
            f"/api/v2/skills-competency/users/{employee.id}/skills",
            headers=headers,
            json={"profileVersion": 1, "skills": [{"skillId": second["id"], "rating": 5}]},
        ),
    )
    assert sorted(response.status_code for response in responses) == [200, 409]
    conflict = next(response for response in responses if response.status_code == 409)
    assert conflict.json() == {
        "detail": "Phiên hồ sơ đã thay đổi",
        "currentProfileVersion": 2,
    }
    assert await db_session.scalar(select(func.count()).select_from(EmployeeSkill)) == 1


@pytest.mark.asyncio
async def test_skill_replace_response_is_materialized_before_a_later_commit(
    db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    if db_session.bind is None or db_session.bind.dialect.name != "postgresql":
        pytest.skip("PostgreSQL response snapshot contract")
    employee = await create_user(db_session, email="skills-response-race@acme.dev", name="Owner")
    first = Skill(name="First", normalized_key="first")
    second = Skill(name="Second", normalized_key="second")
    db_session.add_all([first, second])
    await db_session.commit()

    first_committed = asyncio.Event()
    second_committed = asyncio.Event()
    async with (
        AsyncSession(bind=db_session.bind, expire_on_commit=False) as first_session,
        AsyncSession(bind=db_session.bind, expire_on_commit=False) as second_session,
    ):
        first_actor = await first_session.get(User, employee.id)
        second_actor = await second_session.get(User, employee.id)
        assert first_actor is not None and second_actor is not None
        original_commit = first_session.commit

        async def commit_then_wait_for_later_writer() -> None:
            await original_commit()
            first_committed.set()
            await asyncio.wait_for(second_committed.wait(), timeout=5)

        monkeypatch.setattr(first_session, "commit", commit_then_wait_for_later_writer)

        async def first_write() -> tuple[int, object]:
            return await CompetencyProfileService(first_session).replace_employee_skills(
                first_actor,
                employee.id,
                EmployeeSkillReplace.model_validate(
                    {
                        "profileVersion": 1,
                        "skills": [{"skillId": str(first.id), "rating": 4}],
                    }
                ),
                "first-response-race",
            )

        async def later_write() -> tuple[int, object]:
            await asyncio.wait_for(first_committed.wait(), timeout=5)
            result = await CompetencyProfileService(second_session).replace_employee_skills(
                second_actor,
                employee.id,
                EmployeeSkillReplace.model_validate(
                    {
                        "profileVersion": 2,
                        "skills": [{"skillId": str(second.id), "rating": 5}],
                    }
                ),
                "second-response-race",
            )
            second_committed.set()
            return result

        first_result, second_result = await asyncio.gather(first_write(), later_write())

    assert first_result[0] == 2
    assert [item.skill.name for item in first_result[1]] == ["First"]
    assert second_result[0] == 3
    assert [item.skill.name for item in second_result[1]] == ["Second"]


@pytest.mark.parametrize("operation", ["update", "delete"])
@pytest.mark.asyncio
async def test_resource_update_and_delete_roll_back_when_audit_fails(
    operation: str,
    client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    employee = await create_user(
        db_session, email=f"resource-{operation}-rollback@acme.dev", name="Owner"
    )
    assert employee.company_id is not None
    resource = Experience(
        user_id=employee.id,
        company_id=employee.company_id,
        title="Original",
        organization="CareerMate",
        source_type=ProfileSourceType.SELF,
        created_by=employee.id,
        updated_by=employee.id,
    )
    db_session.add(resource)
    await db_session.commit()
    employee_id = employee.id
    resource_id = resource.id
    headers = await login(client, employee.email)

    async def fail_audit(*args: object, **kwargs: object) -> ActivityLog:
        raise RuntimeError(f"synthetic {operation} audit failure")

    monkeypatch.setattr(ActivityLogRepository, "log", fail_audit)
    with pytest.raises(RuntimeError, match=f"synthetic {operation} audit failure"):
        if operation == "update":
            await client.patch(
                f"/api/v2/competency-profile/experiences/{resource_id}",
                headers=headers,
                json={"profileVersion": 1, "title": "Changed"},
            )
        else:
            await client.request(
                "DELETE",
                f"/api/v2/competency-profile/experiences/{resource_id}",
                headers=headers,
                json={"profileVersion": 1},
            )

    db_session.expire_all()
    persisted_user = await db_session.get(User, employee_id)
    persisted_resource = await db_session.get(Experience, resource_id)
    assert persisted_user is not None and persisted_user.version == 1
    assert persisted_resource is not None and persisted_resource.title == "Original"


@pytest.mark.asyncio
async def test_concurrent_skill_catalog_creation_is_unicode_normalized_on_postgresql(
    client: AsyncClient, db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    if db_session.bind is None or db_session.bind.dialect.name != "postgresql":
        pytest.skip("PostgreSQL catalog concurrency contract")
    employee = await create_user(db_session, email="skill-catalog-race@acme.dev", name="Owner")
    headers = await login(client, employee.email)
    arrived = 0
    both_ready = asyncio.Event()
    original_create = CompetencyProfileService.create_skill

    async def barriered_create(
        service: CompetencyProfileService,
        actor: User,
        name: str,
        category: str | None,
        request_id: str | None,
    ) -> Skill:
        nonlocal arrived
        arrived += 1
        if arrived == 2:
            both_ready.set()
        await asyncio.wait_for(both_ready.wait(), timeout=5)
        return await original_create(service, actor, name, category, request_id)

    monkeypatch.setattr(CompetencyProfileService, "create_skill", barriered_create)

    responses = await asyncio.gather(
        client.post(
            "/api/v2/skills-competency/skills",
            headers=headers,
            json={"name": normalize("NFD", "  CAFÉ   Design ")},
        ),
        client.post(
            "/api/v2/skills-competency/skills",
            headers=headers,
            json={"name": "café design"},
        ),
    )
    assert [response.status_code for response in responses] == [200, 200]
    assert len({response.json()["id"] for response in responses}) == 1
    assert await db_session.scalar(select(func.count()).select_from(Skill)) == 1


@pytest.mark.asyncio
async def test_timeline_orders_same_day_experiences_deterministically_by_id(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    company = await CompanyRepository(db_session).add(Company(name="Tie Break Company"))
    await db_session.flush()
    employee = await create_user(
        db_session, email="tiebreak@acme.dev", name="Tie Break Owner", company=company
    )
    await db_session.commit()
    headers = await login(client, employee.email)

    first = await client.post(
        "/api/v2/competency-profile/experiences",
        headers=headers,
        json={
            "profileVersion": 1,
            "title": "Alpha Mentor",
            "organization": "Org A",
            "startDate": "2025-06-01",
        },
    )
    assert first.status_code == 201, first.text
    second = await client.post(
        "/api/v2/competency-profile/experiences",
        headers=headers,
        json={
            "profileVersion": 2,
            "title": "Beta Mentor",
            "organization": "Org B",
            "startDate": "2025-06-01",
        },
    )
    assert second.status_code == 201, second.text

    aggregate_first = await client.get("/api/v2/competency-profile", headers=headers)
    aggregate_second = await client.get("/api/v2/competency-profile", headers=headers)
    assert aggregate_first.status_code == 200
    assert aggregate_second.status_code == 200
    ids_first = [item["id"] for item in aggregate_first.json()["timeline"]]
    ids_second = [item["id"] for item in aggregate_second.json()["timeline"]]
    assert ids_first == ids_second
    expected_order = sorted([first.json()["id"], second.json()["id"]])
    assert ids_first == expected_order


@pytest.mark.asyncio
async def test_project_crud_preserves_origin_and_uses_profile_version(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    company = await CompanyRepository(db_session).add(Company(name="Project Company"))
    await db_session.flush()
    employee = await create_user(
        db_session, email="project-owner@acme.dev", name="Project Owner", company=company
    )
    admin = await create_user(
        db_session,
        email="project-admin@acme.dev",
        name="Project Admin",
        role=Role.COMPANY_ADMIN,
        company=company,
        admin_permissions=[
            AdminPermission.EMPLOYEE_READ.value,
            AdminPermission.EMPLOYEE_WRITE.value,
        ],
    )
    admin_headers = await login(client, admin.email)
    employment = await EmploymentRepository(db_session).add(
        Employment(
            user_id=employee.id,
            company_id=company.id,
            title="Engineer",
            start_date=datetime(2024, 1, 1, tzinfo=UTC),
        )
    )
    await db_session.commit()

    created = await client.post(
        f"/api/v2/competency-profile/projects?userId={employee.id}",
        headers=admin_headers,
        json={
            "profileVersion": 1,
            "name": "Career Timeline",
            "role": "Backend Engineer",
            "employmentId": str(employment.id),
            "domain": "HR Tech",
            "techStack": ["FastAPI", "PostgreSQL"],
            "contribution": "Built the unified timeline aggregate",
            "startDate": "2025-01-01",
            "url": "https://example.invalid/project",
        },
    )
    assert created.status_code == 201, created.text
    assert created.json()["sourceType"] == "ADMIN"
    assert created.json()["createdBy"] == str(admin.id)
    assert created.json()["techStack"] == ["FastAPI", "PostgreSQL"]

    read = await client.get(
        f"/api/v2/competency-profile/projects/{created.json()['id']}?userId={employee.id}",
        headers=admin_headers,
    )
    assert read.status_code == 200
    assert read.json() == created.json()

    stale = await client.patch(
        f"/api/v2/competency-profile/projects/{created.json()['id']}?userId={employee.id}",
        headers=admin_headers,
        json={"profileVersion": 1, "name": "Stale overwrite"},
    )
    assert stale.status_code == 409
    assert stale.json()["currentProfileVersion"] == 2

    invalid_dates = await client.patch(
        f"/api/v2/competency-profile/projects/{created.json()['id']}?userId={employee.id}",
        headers=admin_headers,
        json={"profileVersion": 2, "endDate": "2024-01-01"},
    )
    assert invalid_dates.status_code == 422

    updated = await client.patch(
        f"/api/v2/competency-profile/projects/{created.json()['id']}?userId={employee.id}",
        headers=admin_headers,
        json={"profileVersion": 2, "name": "Career Timeline v2"},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["sourceType"] == "ADMIN"
    assert updated.json()["createdBy"] == str(admin.id)
    assert updated.json()["updatedBy"] == str(admin.id)

    removed = await client.request(
        "DELETE",
        f"/api/v2/competency-profile/projects/{created.json()['id']}?userId={employee.id}",
        headers=admin_headers,
        json={"profileVersion": 3},
    )
    assert removed.status_code == 204
    assert (
        await client.get(
            f"/api/v2/competency-profile/projects?userId={employee.id}", headers=admin_headers
        )
    ).json() == {"items": [], "profileVersion": 4}

    actions = list(
        (
            await db_session.scalars(
                select(ActivityLog.action)
                .where(ActivityLog.entity_type == "project")
                .order_by(ActivityLog.created_at, ActivityLog.id)
            )
        ).all()
    )
    assert actions == ["profile.project.created", "profile.project.updated", "profile.project.deleted"]


@pytest.mark.asyncio
async def test_project_tenant_scoping_denies_cross_company_access(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    own_company = await CompanyRepository(db_session).add(Company(name="Own Project Co"))
    foreign_company = await CompanyRepository(db_session).add(Company(name="Foreign Project Co"))
    await db_session.flush()
    own_employee = await create_user(
        db_session, email="own-project@acme.dev", name="Own Employee", company=own_company
    )
    foreign_employee = await create_user(
        db_session,
        email="foreign-project@other.dev",
        name="Foreign Employee",
        company=foreign_company,
    )
    admin = await create_user(
        db_session,
        email="tenant-project-admin@acme.dev",
        name="Admin",
        role=Role.COMPANY_ADMIN,
        company=own_company,
        admin_permissions=[
            AdminPermission.EMPLOYEE_READ.value,
            AdminPermission.EMPLOYEE_WRITE.value,
        ],
    )
    reader = await create_user(
        db_session,
        email="tenant-project-reader@acme.dev",
        name="Reader",
        role=Role.COMPANY_ADMIN,
        company=own_company,
        admin_permissions=[AdminPermission.EMPLOYEE_READ.value],
    )
    admin_headers = await login(client, admin.email)
    reader_headers = await login(client, reader.email)
    own_headers = await login(client, own_employee.email)
    foreign_employment = await EmploymentRepository(db_session).add(
        Employment(
            user_id=foreign_employee.id,
            company_id=foreign_company.id,
            title="Foreign role",
            start_date=datetime(2025, 1, 1, tzinfo=UTC),
        )
    )
    await db_session.commit()

    assert (
        await client.get(
            f"/api/v2/competency-profile/projects?userId={foreign_employee.id}",
            headers=admin_headers,
        )
    ).status_code == 404
    assert (
        await client.post(
            f"/api/v2/competency-profile/projects?userId={foreign_employee.id}",
            headers=admin_headers,
            json={"profileVersion": 1, "name": "Hidden", "role": "Ghost"},
        )
    ).status_code == 404
    assert (
        await client.post(
            f"/api/v2/competency-profile/projects?userId={own_employee.id}",
            headers=reader_headers,
            json={"profileVersion": 1, "name": "Denied", "role": "Own"},
        )
    ).status_code == 403
    scoped_employment = await client.post(
        "/api/v2/competency-profile/projects",
        headers=own_headers,
        json={
            "profileVersion": 1,
            "name": "Cross-tenant employment",
            "role": "Own",
            "employmentId": str(foreign_employment.id),
        },
    )
    assert scoped_employment.status_code == 422


@pytest.mark.asyncio
async def test_project_timeline_orders_same_day_entries_deterministically_by_id(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    company = await CompanyRepository(db_session).add(Company(name="Project Tie Break Company"))
    await db_session.flush()
    employee = await create_user(
        db_session, email="project-tiebreak@acme.dev", name="Project Tie Break Owner", company=company
    )
    await db_session.commit()
    headers = await login(client, employee.email)

    first = await client.post(
        "/api/v2/competency-profile/projects",
        headers=headers,
        json={
            "profileVersion": 1,
            "name": "Alpha Project",
            "role": "Contributor",
            "startDate": "2025-06-01",
        },
    )
    assert first.status_code == 201, first.text

    second = await client.post(
        "/api/v2/competency-profile/projects",
        headers=headers,
        json={
            "profileVersion": 2,
            "name": "Beta Project",
            "role": "Contributor",
            "startDate": "2025-06-01",
        },
    )
    assert second.status_code == 201, second.text

    aggregate_first = await client.get("/api/v2/competency-profile", headers=headers)
    aggregate_second = await client.get("/api/v2/competency-profile", headers=headers)
    assert aggregate_first.status_code == 200
    assert aggregate_second.status_code == 200
    ids_first = [item["id"] for item in aggregate_first.json()["timeline"]]
    ids_second = [item["id"] for item in aggregate_second.json()["timeline"]]
    assert ids_first == ids_second
    expected_order = sorted([first.json()["id"], second.json()["id"]])
    assert ids_first == expected_order


@pytest.mark.parametrize("operation", ["update", "delete"])
@pytest.mark.asyncio
async def test_project_update_and_delete_roll_back_when_audit_fails(
    operation: str,
    client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    employee = await create_user(
        db_session, email=f"project-{operation}-rollback@acme.dev", name="Owner"
    )
    assert employee.company_id is not None
    resource = Project(
        user_id=employee.id,
        company_id=employee.company_id,
        name="Original Project",
        role="Original Role",
        tech_stack=[],
        source_type=ProfileSourceType.SELF,
        created_by=employee.id,
        updated_by=employee.id,
    )
    db_session.add(resource)
    await db_session.commit()
    employee_id = employee.id
    resource_id = resource.id
    headers = await login(client, employee.email)

    async def fail_audit(*args: object, **kwargs: object) -> ActivityLog:
        raise RuntimeError(f"synthetic project {operation} audit failure")

    monkeypatch.setattr(ActivityLogRepository, "log", fail_audit)
    with pytest.raises(RuntimeError, match=f"synthetic project {operation} audit failure"):
        if operation == "update":
            await client.patch(
                f"/api/v2/competency-profile/projects/{resource_id}",
                headers=headers,
                json={"profileVersion": 1, "name": "Changed"},
            )
        else:
            await client.request(
                "DELETE",
                f"/api/v2/competency-profile/projects/{resource_id}",
                headers=headers,
                json={"profileVersion": 1},
            )

    db_session.expire_all()
    persisted_user = await db_session.get(User, employee_id)
    persisted_resource = await db_session.get(Project, resource_id)
    assert persisted_user is not None and persisted_user.version == 1
    assert persisted_resource is not None and persisted_resource.name == "Original Project"


@pytest.mark.asyncio
async def test_certification_crud_preserves_origin_and_uses_profile_version(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    company = await CompanyRepository(db_session).add(Company(name="Certification Company"))
    await db_session.flush()
    employee = await create_user(
        db_session, email="certification-owner@acme.dev", name="Certification Owner", company=company
    )
    admin = await create_user(
        db_session,
        email="certification-admin@acme.dev",
        name="Certification Admin",
        role=Role.COMPANY_ADMIN,
        company=company,
        admin_permissions=[
            AdminPermission.EMPLOYEE_READ.value,
            AdminPermission.EMPLOYEE_WRITE.value,
        ],
    )
    admin_headers = await login(client, admin.email)

    created = await client.post(
        f"/api/v2/competency-profile/certifications?userId={employee.id}",
        headers=admin_headers,
        json={
            "profileVersion": 1,
            "name": "AWS Solutions Architect",
            "type": "PROFESSIONAL",
            "issuer": "Amazon",
            "score": "890/1000",
            "credentialUrl": "https://example.invalid/credential",
            "issuedAt": "2025-01-01",
            "expiresAt": "2028-01-01",
        },
    )
    assert created.status_code == 201, created.text
    assert created.json()["sourceType"] == "ADMIN"
    assert created.json()["createdBy"] == str(admin.id)
    assert created.json()["type"] == "PROFESSIONAL"
    assert created.json()["score"] == "890/1000"
    assert created.json()["issuedAt"] == "2025-01-01"
    assert created.json()["expiresAt"] == "2028-01-01"

    read = await client.get(
        f"/api/v2/competency-profile/certifications/{created.json()['id']}?userId={employee.id}",
        headers=admin_headers,
    )
    assert read.status_code == 200
    assert read.json() == created.json()

    stale = await client.patch(
        f"/api/v2/competency-profile/certifications/{created.json()['id']}?userId={employee.id}",
        headers=admin_headers,
        json={"profileVersion": 1, "name": "Stale overwrite"},
    )
    assert stale.status_code == 409
    assert stale.json()["currentProfileVersion"] == 2

    invalid_dates = await client.patch(
        f"/api/v2/competency-profile/certifications/{created.json()['id']}?userId={employee.id}",
        headers=admin_headers,
        json={"profileVersion": 2, "expiresAt": "2024-01-01"},
    )
    assert invalid_dates.status_code == 422

    updated = await client.patch(
        f"/api/v2/competency-profile/certifications/{created.json()['id']}?userId={employee.id}",
        headers=admin_headers,
        json={"profileVersion": 2, "name": "AWS Solutions Architect Professional"},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["sourceType"] == "ADMIN"
    assert updated.json()["createdBy"] == str(admin.id)
    assert updated.json()["updatedBy"] == str(admin.id)
    assert updated.json()["issuedAt"] == "2025-01-01"
    assert updated.json()["expiresAt"] == "2028-01-01"

    removed = await client.request(
        "DELETE",
        f"/api/v2/competency-profile/certifications/{created.json()['id']}?userId={employee.id}",
        headers=admin_headers,
        json={"profileVersion": 3},
    )
    assert removed.status_code == 204
    assert (
        await client.get(
            f"/api/v2/competency-profile/certifications?userId={employee.id}", headers=admin_headers
        )
    ).json() == {"items": [], "profileVersion": 4}

    actions = list(
        (
            await db_session.scalars(
                select(ActivityLog.action)
                .where(ActivityLog.entity_type == "certification")
                .order_by(ActivityLog.created_at, ActivityLog.id)
            )
        ).all()
    )
    assert actions == [
        "profile.certification.created",
        "profile.certification.updated",
        "profile.certification.deleted",
    ]


@pytest.mark.asyncio
async def test_certification_tenant_scoping_denies_cross_company_access(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    own_company = await CompanyRepository(db_session).add(Company(name="Own Certification Co"))
    foreign_company = await CompanyRepository(db_session).add(Company(name="Foreign Certification Co"))
    await db_session.flush()
    own_employee = await create_user(
        db_session, email="own-certification@acme.dev", name="Own Employee", company=own_company
    )
    foreign_employee = await create_user(
        db_session,
        email="foreign-certification@other.dev",
        name="Foreign Employee",
        company=foreign_company,
    )
    admin = await create_user(
        db_session,
        email="tenant-certification-admin@acme.dev",
        name="Admin",
        role=Role.COMPANY_ADMIN,
        company=own_company,
        admin_permissions=[
            AdminPermission.EMPLOYEE_READ.value,
            AdminPermission.EMPLOYEE_WRITE.value,
        ],
    )
    reader = await create_user(
        db_session,
        email="tenant-certification-reader@acme.dev",
        name="Reader",
        role=Role.COMPANY_ADMIN,
        company=own_company,
        admin_permissions=[AdminPermission.EMPLOYEE_READ.value],
    )
    admin_headers = await login(client, admin.email)
    reader_headers = await login(client, reader.email)
    await db_session.commit()

    assert (
        await client.get(
            f"/api/v2/competency-profile/certifications?userId={foreign_employee.id}",
            headers=admin_headers,
        )
    ).status_code == 404
    assert (
        await client.post(
            f"/api/v2/competency-profile/certifications?userId={foreign_employee.id}",
            headers=admin_headers,
            json={
                "profileVersion": 1,
                "name": "Hidden",
                "type": "OTHER",
                "issuer": "Ghost",
            },
        )
    ).status_code == 404
    assert (
        await client.post(
            f"/api/v2/competency-profile/certifications?userId={own_employee.id}",
            headers=reader_headers,
            json={
                "profileVersion": 1,
                "name": "Denied",
                "type": "OTHER",
                "issuer": "Own",
            },
        )
    ).status_code == 403

    missing_required_field = await client.post(
        f"/api/v2/competency-profile/certifications?userId={own_employee.id}",
        headers=admin_headers,
        json={"profileVersion": 1, "name": "No issuer", "type": "OTHER"},
    )
    assert missing_required_field.status_code == 422


@pytest.mark.asyncio
async def test_certification_timeline_orders_same_issued_at_deterministically_by_id_and_excludes_null(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    company = await CompanyRepository(db_session).add(Company(name="Certification Tie Break Company"))
    await db_session.flush()
    employee = await create_user(
        db_session,
        email="certification-tiebreak@acme.dev",
        name="Certification Tie Break Owner",
        company=company,
    )
    await db_session.commit()
    headers = await login(client, employee.email)

    first = await client.post(
        "/api/v2/competency-profile/certifications",
        headers=headers,
        json={
            "profileVersion": 1,
            "name": "Alpha Certification",
            "type": "OTHER",
            "issuer": "Org A",
            "issuedAt": "2025-06-01",
            "expiresAt": "2027-06-01",
        },
    )
    assert first.status_code == 201, first.text

    second = await client.post(
        "/api/v2/competency-profile/certifications",
        headers=headers,
        json={
            "profileVersion": 2,
            "name": "Beta Certification",
            "type": "OTHER",
            "issuer": "Org B",
            "issuedAt": "2025-06-01",
        },
    )
    assert second.status_code == 201, second.text

    undated = await client.post(
        "/api/v2/competency-profile/certifications",
        headers=headers,
        json={
            "profileVersion": 3,
            "name": "Undated Certification",
            "type": "OTHER",
            "issuer": "Org C",
        },
    )
    assert undated.status_code == 201, undated.text

    aggregate_first = await client.get("/api/v2/competency-profile", headers=headers)
    aggregate_second = await client.get("/api/v2/competency-profile", headers=headers)
    assert aggregate_first.status_code == 200
    assert aggregate_second.status_code == 200
    ids_first = [item["id"] for item in aggregate_first.json()["timeline"]]
    ids_second = [item["id"] for item in aggregate_second.json()["timeline"]]
    assert ids_first == ids_second
    expected_order = sorted([first.json()["id"], second.json()["id"]])
    assert ids_first == expected_order
    assert undated.json()["id"] not in ids_first
    assert len(aggregate_first.json()["certifications"]) == 3

    # Full projection: each dated certification's timeline entry must map
    # kind/title/subtitle/startDate/endDate/sourceType from the certification
    # resource fields, not just be present in the right order.
    timeline_by_id = {item["id"]: item for item in aggregate_first.json()["timeline"]}
    alpha_entry = timeline_by_id[first.json()["id"]]
    assert alpha_entry["kind"] == "CERTIFICATION"
    assert alpha_entry["title"] == "Alpha Certification"
    assert alpha_entry["subtitle"] == "Org A"
    assert alpha_entry["startDate"] == "2025-06-01"
    assert alpha_entry["endDate"] == "2027-06-01"
    assert alpha_entry["sourceType"] == "SELF"

    beta_entry = timeline_by_id[second.json()["id"]]
    assert beta_entry["kind"] == "CERTIFICATION"
    assert beta_entry["title"] == "Beta Certification"
    assert beta_entry["subtitle"] == "Org B"
    assert beta_entry["startDate"] == "2025-06-01"
    assert beta_entry["endDate"] is None
    assert beta_entry["sourceType"] == "SELF"




@pytest.mark.parametrize("operation", ["update", "delete"])
@pytest.mark.asyncio
async def test_certification_update_and_delete_roll_back_when_audit_fails(
    operation: str,
    client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    employee = await create_user(
        db_session, email=f"certification-{operation}-rollback@acme.dev", name="Owner"
    )
    assert employee.company_id is not None
    resource = Certification(
        user_id=employee.id,
        company_id=employee.company_id,
        name="Original Certification",
        type="OTHER",
        issuer="Original Issuer",
        source_type=ProfileSourceType.SELF,
        created_by=employee.id,
        updated_by=employee.id,
    )
    db_session.add(resource)
    await db_session.commit()
    employee_id = employee.id
    resource_id = resource.id
    headers = await login(client, employee.email)

    async def fail_audit(*args: object, **kwargs: object) -> ActivityLog:
        raise RuntimeError(f"synthetic certification {operation} audit failure")

    monkeypatch.setattr(ActivityLogRepository, "log", fail_audit)
    with pytest.raises(RuntimeError, match=f"synthetic certification {operation} audit failure"):
        if operation == "update":
            await client.patch(
                f"/api/v2/competency-profile/certifications/{resource_id}",
                headers=headers,
                json={"profileVersion": 1, "name": "Changed"},
            )
        else:
            await client.request(
                "DELETE",
                f"/api/v2/competency-profile/certifications/{resource_id}",
                headers=headers,
                json={"profileVersion": 1},
            )

    db_session.expire_all()
    persisted_user = await db_session.get(User, employee_id)
    persisted_resource = await db_session.get(Certification, resource_id)
    assert persisted_user is not None and persisted_user.version == 1
    assert persisted_resource is not None and persisted_resource.name == "Original Certification"


@pytest.mark.asyncio
async def test_award_tenant_scoping_denies_cross_company_access(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    own_company = await CompanyRepository(db_session).add(Company(name="Own Award Co"))
    foreign_company = await CompanyRepository(db_session).add(Company(name="Foreign Award Co"))
    await db_session.flush()
    own_employee = await create_user(
        db_session, email="own-award@acme.dev", name="Own Employee", company=own_company
    )
    foreign_employee = await create_user(
        db_session,
        email="foreign-award@other.dev",
        name="Foreign Employee",
        company=foreign_company,
    )
    admin = await create_user(
        db_session,
        email="tenant-award-admin@acme.dev",
        name="Admin",
        role=Role.COMPANY_ADMIN,
        company=own_company,
        admin_permissions=[
            AdminPermission.EMPLOYEE_READ.value,
            AdminPermission.EMPLOYEE_WRITE.value,
        ],
    )
    reader = await create_user(
        db_session,
        email="tenant-award-reader@acme.dev",
        name="Reader",
        role=Role.COMPANY_ADMIN,
        company=own_company,
        admin_permissions=[AdminPermission.EMPLOYEE_READ.value],
    )
    admin_headers = await login(client, admin.email)
    reader_headers = await login(client, reader.email)
    await db_session.commit()

    assert (
        await client.get(
            f"/api/v2/competency-profile/awards?userId={foreign_employee.id}",
            headers=admin_headers,
        )
    ).status_code == 404
    assert (
        await client.post(
            f"/api/v2/competency-profile/awards?userId={foreign_employee.id}",
            headers=admin_headers,
            json={
                "profileVersion": 1,
                "name": "Hidden",
                "type": "WORK",
                "issuer": "Ghost",
            },
        )
    ).status_code == 404
    assert (
        await client.post(
            f"/api/v2/competency-profile/awards?userId={own_employee.id}",
            headers=reader_headers,
            json={
                "profileVersion": 1,
                "name": "Denied",
                "type": "WORK",
                "issuer": "Own",
            },
        )
    ).status_code == 403

    for payload in (
        {"profileVersion": 1, "type": "WORK", "issuer": "Own"},
        {"profileVersion": 1, "name": "Missing type", "issuer": "Own"},
        {"profileVersion": 1, "name": "Missing issuer", "type": "WORK"},
    ):
        missing_required_field = await client.post(
            f"/api/v2/competency-profile/awards?userId={own_employee.id}",
            headers=admin_headers,
            json=payload,
        )
        assert missing_required_field.status_code == 422


@pytest.mark.asyncio
async def test_award_timeline_orders_same_awarded_at_deterministically_by_id_and_excludes_null(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    company = await CompanyRepository(db_session).add(Company(name="Award Tie Break Company"))
    await db_session.flush()
    employee = await create_user(
        db_session,
        email="award-tiebreak@acme.dev",
        name="Award Tie Break Owner",
        company=company,
    )
    await db_session.commit()
    headers = await login(client, employee.email)

    first = await client.post(
        "/api/v2/competency-profile/awards",
        headers=headers,
        json={
            "profileVersion": 1,
            "name": "Alpha Award",
            "type": "WORK",
            "issuer": "Org A",
            "description": "Work recognition",
            "evidenceUrl": "https://example.invalid/alpha-award",
            "awardedAt": "2025-06-01",
        },
    )
    assert first.status_code == 201, first.text

    second = await client.post(
        "/api/v2/competency-profile/awards",
        headers=headers,
        json={
            "profileVersion": 2,
            "name": "Beta Award",
            "type": "PERSONAL",
            "issuer": "Org B",
            "awardedAt": "2025-06-01",
        },
    )
    assert second.status_code == 201, second.text

    undated = await client.post(
        "/api/v2/competency-profile/awards",
        headers=headers,
        json={
            "profileVersion": 3,
            "name": "Undated Award",
            "type": "PERSONAL",
            "issuer": "Org C",
        },
    )
    assert undated.status_code == 201, undated.text

    aggregate_first = await client.get("/api/v2/competency-profile", headers=headers)
    aggregate_second = await client.get("/api/v2/competency-profile", headers=headers)
    assert aggregate_first.status_code == 200
    assert aggregate_second.status_code == 200
    ids_first = [item["id"] for item in aggregate_first.json()["timeline"]]
    ids_second = [item["id"] for item in aggregate_second.json()["timeline"]]
    assert ids_first == ids_second
    assert ids_first == sorted([first.json()["id"], second.json()["id"]])
    assert undated.json()["id"] not in ids_first
    assert len(aggregate_first.json()["awards"]) == 3

    timeline_by_id = {item["id"]: item for item in aggregate_first.json()["timeline"]}
    alpha_entry = timeline_by_id[first.json()["id"]]
    assert alpha_entry == {
        "id": first.json()["id"],
        "kind": "AWARD",
        "title": "Alpha Award",
        "subtitle": "Org A",
        "startDate": "2025-06-01",
        "endDate": None,
        "sourceType": "SELF",
    }
    beta_entry = timeline_by_id[second.json()["id"]]
    assert beta_entry == {
        "id": second.json()["id"],
        "kind": "AWARD",
        "title": "Beta Award",
        "subtitle": "Org B",
        "startDate": "2025-06-01",
        "endDate": None,
        "sourceType": "SELF",
    }
    assert first.json()["selfReported"] is True
    assert second.json()["selfReported"] is True


@pytest.mark.parametrize("operation", ["update", "delete"])
@pytest.mark.asyncio
async def test_award_update_and_delete_roll_back_when_audit_fails(
    operation: str,
    client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    employee = await create_user(
        db_session, email=f"award-{operation}-rollback@acme.dev", name="Owner"
    )
    assert employee.company_id is not None
    resource = Award(
        user_id=employee.id,
        company_id=employee.company_id,
        name="Original Award",
        type="WORK",
        issuer="Original Issuer",
        self_reported=True,
        source_type=ProfileSourceType.SELF,
        created_by=employee.id,
        updated_by=employee.id,
    )
    db_session.add(resource)
    await db_session.commit()
    employee_id = employee.id
    resource_id = resource.id
    headers = await login(client, employee.email)

    async def fail_audit(*args: object, **kwargs: object) -> ActivityLog:
        raise RuntimeError(f"synthetic award {operation} audit failure")

    monkeypatch.setattr(ActivityLogRepository, "log", fail_audit)
    with pytest.raises(RuntimeError, match=f"synthetic award {operation} audit failure"):
        if operation == "update":
            await client.patch(
                f"/api/v2/competency-profile/awards/{resource_id}",
                headers=headers,
                json={"profileVersion": 1, "name": "Changed"},
            )
        else:
            await client.request(
                "DELETE",
                f"/api/v2/competency-profile/awards/{resource_id}",
                headers=headers,
                json={"profileVersion": 1},
            )

    db_session.expire_all()
    persisted_user = await db_session.get(User, employee_id)
    persisted_resource = await db_session.get(Award, resource_id)
    assert persisted_user is not None and persisted_user.version == 1
    assert persisted_resource is not None and persisted_resource.name == "Original Award"


@pytest.mark.asyncio
async def test_skill_profile_permissions_are_tenant_scoped_and_admin_provenance_is_explicit(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    own_company = await CompanyRepository(db_session).add(Company(name="Skill Own"))
    foreign_company = await CompanyRepository(db_session).add(Company(name="Skill Foreign"))
    await db_session.flush()
    owner = await create_user(
        db_session, email="skill-owner@own.dev", name="Owner", company=own_company
    )
    peer = await create_user(
        db_session, email="skill-peer@own.dev", name="Peer", company=own_company
    )
    foreign_employee = await create_user(
        db_session,
        email="skill-owner@foreign.dev",
        name="Foreign Owner",
        company=foreign_company,
    )
    writer = await create_user(
        db_session,
        email="skill-writer@own.dev",
        name="Writer",
        role=Role.COMPANY_ADMIN,
        company=own_company,
        admin_permissions=[
            AdminPermission.EMPLOYEE_READ.value,
            AdminPermission.EMPLOYEE_WRITE.value,
        ],
    )
    reader = await create_user(
        db_session,
        email="skill-reader@own.dev",
        name="Reader",
        role=Role.COMPANY_ADMIN,
        company=own_company,
        admin_permissions=[AdminPermission.EMPLOYEE_READ.value],
    )
    super_admin = await create_user(
        db_session,
        email="skill-super@careermate.dev",
        name="Super",
        role=Role.SUPER_ADMIN,
    )
    foreign_employee_id = foreign_employee.id
    foreign_company_id = foreign_company.id
    super_admin_id = super_admin.id
    owner_headers = await login(client, owner.email)
    peer_headers = await login(client, peer.email)
    writer_headers = await login(client, writer.email)
    reader_headers = await login(client, reader.email)
    super_headers = await login(client, super_admin.email)

    catalog_item = (
        await client.post(
            "/api/v2/skills-competency/skills",
            headers=owner_headers,
            json={"name": "Tenant Safe Skill", "category": "Security"},
        )
    ).json()
    replaced = await client.put(
        f"/api/v2/skills-competency/users/{owner.id}/skills",
        headers=writer_headers,
        json={
            "profileVersion": 1,
            "skills": [{"skillId": catalog_item["id"], "rating": 4, "note": "  HR   verified  "}],
        },
    )
    assert replaced.status_code == 200, replaced.text
    assert replaced.json()["profileVersion"] == 2
    assert replaced.json()["items"][0]["sourceType"] == "ADMIN"
    assert replaced.json()["items"][0]["selfAssessed"] is False
    assert replaced.json()["items"][0]["note"] == "HR verified"
    assert replaced.json()["items"][0]["createdBy"] == str(writer.id)
    assert replaced.json()["items"][0]["updatedBy"] == str(writer.id)
    assert replaced.json()["items"][0]["sourceImportId"] is None
    assert replaced.json()["items"][0]["proposalItemId"] is None

    reader_detail = await client.get(
        f"/api/v2/skills-competency/users/{owner.id}", headers=reader_headers
    )
    reader_aggregate = await client.get(
        f"/api/v2/competency-profile?userId={owner.id}", headers=reader_headers
    )
    assert reader_detail.status_code == reader_aggregate.status_code == 200
    assert reader_detail.json()["items"][0]["name"] == "Tenant Safe Skill"
    assert reader_aggregate.json()["skills"][0]["name"] == "Tenant Safe Skill"

    owner_replaced = await client.put(
        f"/api/v2/skills-competency/users/{owner.id}/skills",
        headers=owner_headers,
        json={
            "profileVersion": 2,
            "skills": [{"skillId": catalog_item["id"], "rating": 5, "note": " Owner   confirmed "}],
        },
    )
    assert owner_replaced.status_code == 200, owner_replaced.text
    assert owner_replaced.json()["profileVersion"] == 3
    owner_item = owner_replaced.json()["items"][0]
    assert owner_item["sourceType"] == "SELF"
    assert owner_item["selfAssessed"] is True
    assert owner_item["note"] == "Owner confirmed"
    assert owner_item["createdBy"] == str(writer.id)
    assert owner_item["updatedBy"] == str(owner.id)
    assert owner_item["sourceImportId"] is None
    assert owner_item["proposalItemId"] is None
    assert owner_item["version"] == 2

    denied_write = await client.put(
        f"/api/v2/skills-competency/users/{owner.id}/skills",
        headers=reader_headers,
        json={"profileVersion": 3, "skills": []},
    )
    peer_read = await client.get(
        f"/api/v2/skills-competency/users/{owner.id}", headers=peer_headers
    )
    foreign_read = await client.get(
        f"/api/v2/skills-competency/users/{foreign_employee_id}", headers=writer_headers
    )
    foreign_aggregate = await client.get(
        f"/api/v2/competency-profile?userId={foreign_employee_id}", headers=writer_headers
    )
    foreign_write = await client.put(
        f"/api/v2/skills-competency/users/{foreign_employee_id}/skills",
        headers=writer_headers,
        json={"profileVersion": 1, "skills": []},
    )
    assert denied_write.status_code == 403
    assert peer_read.status_code == 404
    assert foreign_read.status_code == foreign_aggregate.status_code == 404
    assert foreign_write.status_code == 404

    super_replaced = await client.put(
        f"/api/v2/skills-competency/users/{foreign_employee_id}/skills",
        headers=super_headers,
        json={
            "profileVersion": 1,
            "skills": [
                {"skillId": catalog_item["id"], "rating": 3, "note": "Platform review"}
            ],
        },
    )
    assert super_replaced.status_code == 200, super_replaced.text
    assert super_replaced.json()["profileVersion"] == 2
    super_item = super_replaced.json()["items"][0]
    assert super_item["name"] == "Tenant Safe Skill"
    assert super_item["sourceType"] == "ADMIN"
    assert super_item["selfAssessed"] is False
    assert super_item["createdBy"] == str(super_admin_id)
    assert super_item["updatedBy"] == str(super_admin_id)

    db_session.expire_all()
    foreign_row = await db_session.scalar(
        select(EmployeeSkill).where(
            EmployeeSkill.user_id == foreign_employee_id,
            EmployeeSkill.company_id == foreign_company_id,
            EmployeeSkill.skill_id == uuid.UUID(catalog_item["id"]),
        )
    )
    assert foreign_row is not None
    assert foreign_row.source_type == ProfileSourceType.ADMIN
    assert foreign_row.self_assessed is False
    assert foreign_row.created_by == super_admin_id
    assert foreign_row.updated_by == super_admin_id

    super_read = await client.get(
        f"/api/v2/skills-competency/users/{foreign_employee_id}", headers=super_headers
    )
    assert super_read.status_code == 200
    assert super_read.json()["profileVersion"] == 2
    assert len(super_read.json()["items"]) == 1
    assert super_read.json()["items"][0]["id"] == super_item["id"]


@pytest.mark.asyncio
async def test_sequential_stale_skill_replace_returns_current_profile_version_on_sqlite(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    owner = await create_user(db_session, email="skill-stale@acme.dev", name="Owner")
    owner_id = owner.id
    headers = await login(client, owner.email)
    first = (
        await client.post(
            "/api/v2/skills-competency/skills", headers=headers, json={"name": "First stale"}
        )
    ).json()
    second = (
        await client.post(
            "/api/v2/skills-competency/skills", headers=headers, json={"name": "Second stale"}
        )
    ).json()

    accepted = await client.put(
        f"/api/v2/skills-competency/users/{owner_id}/skills",
        headers=headers,
        json={
            "profileVersion": 1,
            "skills": [{"skillId": first["id"], "rating": 4}],
        },
    )
    stale = await client.put(
        f"/api/v2/skills-competency/users/{owner_id}/skills",
        headers=headers,
        json={
            "profileVersion": 1,
            "skills": [{"skillId": second["id"], "rating": 5}],
        },
    )

    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["profileVersion"] == 2
    assert stale.status_code == 409
    assert stale.json() == {
        "detail": "Phiên hồ sơ đã thay đổi",
        "currentProfileVersion": 2,
    }
    db_session.expire_all()
    persisted = await db_session.get(User, owner_id)
    rows = list(
        (
            await db_session.scalars(select(EmployeeSkill).where(EmployeeSkill.user_id == owner_id))
        ).all()
    )
    assert persisted is not None and persisted.version == 2
    assert len(rows) == 1
    assert rows[0].skill_id == uuid.UUID(first["id"])
    assert rows[0].rating == 4


@pytest.mark.asyncio
async def test_skill_replace_validation_is_atomic_for_duplicate_unknown_rating_and_capacity(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    owner = await create_user(db_session, email="skill-validation@acme.dev", name="Owner")
    owner_id = owner.id
    headers = await login(client, owner.email)
    known = (
        await client.post(
            "/api/v2/skills-competency/skills", headers=headers, json={"name": "Known"}
        )
    ).json()

    invalid_payloads = [
        {
            "profileVersion": 1,
            "skills": [
                {"skillId": known["id"], "rating": 3},
                {"skillId": known["id"], "rating": 4},
            ],
        },
        {
            "profileVersion": 1,
            "skills": [{"skillId": str(uuid.uuid4()), "rating": 3}],
        },
        {
            "profileVersion": 1,
            "skills": [{"skillId": known["id"], "rating": 3.5}],
        },
        {
            "profileVersion": 1,
            "skills": [{"skillId": known["id"], "rating": 0}],
        },
        {
            "profileVersion": 1,
            "skills": [{"skillId": str(uuid.uuid4()), "rating": 3} for _ in range(201)],
        },
    ]
    for payload in invalid_payloads:
        response = await client.put(
            f"/api/v2/skills-competency/users/{owner_id}/skills",
            headers=headers,
            json=payload,
        )
        assert response.status_code == 422, response.text

    db_session.expire_all()
    persisted = await db_session.get(User, owner_id)
    assert persisted is not None and persisted.version == 1
    assert await db_session.scalar(select(func.count()).select_from(EmployeeSkill)) == 0
    assert (
        await db_session.scalar(
            select(func.count())
            .select_from(ActivityLog)
            .where(ActivityLog.action == "profile.skills.replaced")
        )
        == 0
    )


@pytest.mark.asyncio
async def test_skill_full_replace_rolls_back_deletes_updates_and_profile_version_when_audit_fails(
    client: AsyncClient, db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    owner = await create_user(db_session, email="skill-rollback@acme.dev", name="Owner")
    owner_id = owner.id
    headers = await login(client, owner.email)
    first = (
        await client.post(
            "/api/v2/skills-competency/skills", headers=headers, json={"name": "First"}
        )
    ).json()
    second = (
        await client.post(
            "/api/v2/skills-competency/skills", headers=headers, json={"name": "Second"}
        )
    ).json()
    third = (
        await client.post(
            "/api/v2/skills-competency/skills", headers=headers, json={"name": "Third"}
        )
    ).json()
    initial = await client.put(
        f"/api/v2/skills-competency/users/{owner_id}/skills",
        headers=headers,
        json={
            "profileVersion": 1,
            "skills": [
                {"skillId": first["id"], "rating": 2, "note": "Original first"},
                {"skillId": second["id"], "rating": 3, "note": "Original second"},
            ],
        },
    )
    assert initial.status_code == 200, initial.text

    async def fail_audit(*args: object, **kwargs: object) -> ActivityLog:
        raise RuntimeError("synthetic skill audit failure")

    monkeypatch.setattr(ActivityLogRepository, "log", fail_audit)
    with pytest.raises(RuntimeError, match="synthetic skill audit failure"):
        await client.put(
            f"/api/v2/skills-competency/users/{owner_id}/skills",
            headers=headers,
            json={
                "profileVersion": 2,
                "skills": [
                    {"skillId": first["id"], "rating": 5, "note": "Changed"},
                    {"skillId": third["id"], "rating": 4, "note": "Inserted"},
                ],
            },
        )

    db_session.expire_all()
    persisted = await db_session.get(User, owner_id)
    rows = list(
        (
            await db_session.scalars(select(EmployeeSkill).where(EmployeeSkill.user_id == owner_id))
        ).all()
    )
    assert persisted is not None and persisted.version == 2
    by_skill_id = {row.skill_id: row for row in rows}
    assert set(by_skill_id) == {uuid.UUID(first["id"]), uuid.UUID(second["id"])}
    assert by_skill_id[uuid.UUID(first["id"])].rating == 2
    assert by_skill_id[uuid.UUID(first["id"])].note == "Original first"
    assert by_skill_id[uuid.UUID(second["id"])].rating == 3
    assert by_skill_id[uuid.UUID(second["id"])].note == "Original second"
    assert (
        await db_session.scalar(
            select(func.count())
            .select_from(ActivityLog)
            .where(ActivityLog.action == "profile.skills.replaced")
        )
        == 1
    )


@pytest.mark.asyncio
async def test_skill_full_replace_accepts_200_items_and_atomically_rejects_item_201(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    owner = await create_user(db_session, email="skill-capacity@acme.dev", name="Owner")
    owner_id = owner.id
    skills = [
        Skill(name=f"Boundary {index:03d}", normalized_key=f"boundary-{index:03d}")
        for index in range(200)
    ]
    db_session.add_all(skills)
    await db_session.commit()
    headers = await login(client, owner.email)

    accepted = await client.put(
        f"/api/v2/skills-competency/users/{owner_id}/skills",
        headers=headers,
        json={
            "profileVersion": 1,
            "skills": [
                {"skillId": str(skill.id), "rating": (index % 5) + 1}
                for index, skill in enumerate(skills)
            ],
        },
    )
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["profileVersion"] == 2
    assert len(accepted.json()["items"]) == 200

    rejected = await client.put(
        f"/api/v2/skills-competency/users/{owner_id}/skills",
        headers=headers,
        json={
            "profileVersion": 2,
            "skills": [{"skillId": str(skill.id), "rating": 3} for skill in skills]
            + [{"skillId": str(uuid.uuid4()), "rating": 3}],
        },
    )
    assert rejected.status_code == 422

    db_session.expire_all()
    persisted = await db_session.get(User, owner_id)
    assert persisted is not None and persisted.version == 2
    assert (
        await db_session.scalar(
            select(func.count()).select_from(EmployeeSkill).where(EmployeeSkill.user_id == owner_id)
        )
        == 200
    )
