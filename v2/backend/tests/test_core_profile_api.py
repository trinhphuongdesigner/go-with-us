from __future__ import annotations

import unicodedata

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.enums import AdminPermission, CompanyStatus, Role
from app.domain.models import ActivityLog, Company, User
from app.repositories.activity_repo import ActivityLogRepository
from app.repositories.user_repo import CompanyRepository, UserRepository
from app.security.jwt import hash_password


async def create_user(
    db: AsyncSession,
    *,
    email: str,
    name: str,
    role: Role = Role.EMPLOYEE,
    company: Company | None = None,
    job_title: str | None = "Nhân viên",
    is_active: bool = True,
    admin_permissions: list[str] | None = None,
) -> User:
    if role != Role.SUPER_ADMIN and company is None:
        company = await CompanyRepository(db).add(Company(name=f"Company for {email}"))
        await db.flush()
    user = await UserRepository(db).add(
        User(
            email=email,
            name=name,
            job_title=job_title,
            hashed_password=hash_password("DemoPass123!"),
            role=role,
            company_id=company.id if company else None,
            is_active=is_active,
            admin_permissions=admin_permissions or [],
        )
    )
    await db.commit()
    return user


async def login(client: AsyncClient, email: str) -> dict[str, str]:
    response = await client.post(
        "/api/v2/auth/login",
        json={"email": email, "password": "DemoPass123!"},
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['accessToken']}"}


@pytest.mark.asyncio
async def test_self_profile_get_and_patch_are_versioned_normalized_and_audited(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    company = await CompanyRepository(db_session).add(Company(name="Acme"))
    await db_session.flush()
    user = await create_user(
        db_session,
        email="self@acme.dev",
        name="Initial Name",
        company=company,
        job_title="Support Specialist",
    )
    user_id = user.id
    company_id = company.id
    headers = await login(client, user.email)

    initial = await client.get("/api/v2/profile/me", headers=headers)
    assert initial.status_code == 200, initial.text
    assert initial.json() == {
        "id": str(user_id),
        "email": user.email,
        "name": "Initial Name",
        "jobTitle": "Support Specialist",
        "role": "EMPLOYEE",
        "companyId": str(company_id),
        "companyName": "Acme",
        "isActive": True,
        "profileVersion": 1,
        "createdAt": initial.json()["createdAt"],
        "updatedAt": initial.json()["updatedAt"],
    }

    decomposed_name = unicodedata.normalize("NFD", " José Trần ")
    updated = await client.patch(
        "/api/v2/profile/me",
        headers={**headers, "X-Request-ID": "profile-update-001"},
        json={
            "profileVersion": 1,
            "name": decomposed_name,
            "jobTitle": "  Product Analyst  ",
        },
    )

    assert updated.status_code == 200, updated.text
    assert updated.json()["name"] == "José Trần"
    assert updated.json()["jobTitle"] == "Product Analyst"
    assert updated.json()["profileVersion"] == 2
    db_session.expire_all()
    persisted = await db_session.get(User, user_id)
    assert persisted is not None
    assert persisted.name == "José Trần"
    assert persisted.job_title == "Product Analyst"
    assert persisted.version == 2
    audit = await db_session.scalar(
        select(ActivityLog).where(ActivityLog.action == "profile.self.updated")
    )
    assert audit is not None
    assert audit.actor_id == user_id
    assert audit.company_id == company_id
    assert audit.request_id == "profile-update-001"
    assert audit.changes == {
        "fields": ["jobTitle", "name"],
        "fromVersion": 1,
        "toVersion": 2,
        "source": "manual",
    }
    assert "José" not in str(audit.changes)
    assert "Product Analyst" not in str(audit.changes)


@pytest.mark.asyncio
async def test_self_profile_patch_rejects_stale_and_invalid_payloads_without_writes(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    user = await create_user(db_session, email="stale@acme.dev", name="Stable Name")
    user_id = user.id
    headers = await login(client, user.email)

    first = await client.patch(
        "/api/v2/profile/me",
        headers=headers,
        json={"profileVersion": 1, "jobTitle": None},
    )
    stale = await client.patch(
        "/api/v2/profile/me",
        headers=headers,
        json={"profileVersion": 1, "name": "Stale Writer"},
    )
    empty = await client.patch("/api/v2/profile/me", headers=headers, json={"profileVersion": 2})
    blank = await client.patch(
        "/api/v2/profile/me",
        headers=headers,
        json={"profileVersion": 2, "name": "   "},
    )

    assert first.status_code == 200
    assert first.json()["jobTitle"] is None
    assert stale.status_code == 409
    assert stale.json() == {
        "detail": "Hồ sơ đã được cập nhật bởi một thao tác khác",
        "currentProfileVersion": 2,
    }
    assert empty.status_code == blank.status_code == 422
    db_session.expire_all()
    persisted = await db_session.get(User, user_id)
    assert persisted is not None
    assert persisted.name == "Stable Name"
    assert persisted.job_title is None
    assert persisted.version == 2


@pytest.mark.asyncio
async def test_self_profile_update_rolls_back_when_audit_write_fails(
    client: AsyncClient, db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    user = await create_user(db_session, email="rollback@acme.dev", name="Original Name")
    user_id = user.id
    headers = await login(client, user.email)

    async def fail_audit(*args: object, **kwargs: object) -> ActivityLog:
        raise RuntimeError("synthetic audit failure")

    monkeypatch.setattr(ActivityLogRepository, "log", fail_audit)
    with pytest.raises(RuntimeError, match="synthetic audit failure"):
        await client.patch(
            "/api/v2/profile/me",
            headers=headers,
            json={"profileVersion": 1, "name": "Must Roll Back"},
        )

    db_session.expire_all()
    persisted = await db_session.get(User, user_id)
    assert persisted is not None
    assert persisted.name == "Original Name"
    assert persisted.version == 1


@pytest.mark.asyncio
async def test_company_admin_roster_is_tenant_scoped_filtered_and_paginated(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    own_company = await CompanyRepository(db_session).add(Company(name="Own Company"))
    other_company = await CompanyRepository(db_session).add(Company(name="Other Company"))
    await db_session.flush()
    admin = await create_user(
        db_session,
        email="admin@own.dev",
        name="Admin",
        role=Role.COMPANY_ADMIN,
        company=own_company,
        admin_permissions=[AdminPermission.EMPLOYEE_READ.value],
    )
    first = await create_user(
        db_session,
        email="zoe@own.dev",
        name="Zoë Engineer",
        company=own_company,
        job_title="Platform Engineer",
    )
    second = await create_user(
        db_session,
        email="anna@own.dev",
        name="Anna Analyst",
        company=own_company,
        job_title="Product Analyst",
    )
    await create_user(
        db_session,
        email="inactive@own.dev",
        name="Inactive Analyst",
        company=own_company,
        is_active=False,
    )
    foreign = await create_user(
        db_session,
        email="foreign@other.dev",
        name="Foreign Analyst",
        company=other_company,
    )
    headers = await login(client, admin.email)

    page_one = await client.get("/api/v2/people?page=1&pageSize=1", headers=headers)
    searched = await client.get("/api/v2/people?q=platform&active=true", headers=headers)
    forbidden_tenant = await client.get(
        f"/api/v2/people?companyId={other_company.id}", headers=headers
    )
    hidden_detail = await client.get(f"/api/v2/people/{foreign.id}", headers=headers)
    own_detail = await client.get(f"/api/v2/people/{first.id}", headers=headers)

    assert page_one.status_code == 200, page_one.text
    assert page_one.json()["total"] == 3
    assert page_one.json()["page"] == 1
    assert page_one.json()["pageSize"] == 1
    assert [item["id"] for item in page_one.json()["items"]] == [str(second.id)]
    assert "email" not in page_one.text
    assert searched.status_code == 200
    assert [item["id"] for item in searched.json()["items"]] == [str(first.id)]
    assert forbidden_tenant.status_code == 403
    assert hidden_detail.status_code == 404
    assert own_detail.status_code == 200
    assert own_detail.json()["companyId"] == str(own_company.id)
    assert "email" not in own_detail.json()
    assert "hashedPassword" not in own_detail.text


@pytest.mark.asyncio
async def test_roster_permissions_and_super_admin_explicit_tenant_scope(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    active_company = await CompanyRepository(db_session).add(Company(name="Active"))
    archived_company = await CompanyRepository(db_session).add(
        Company(name="Archived", status=CompanyStatus.ARCHIVED)
    )
    await db_session.flush()
    employee = await create_user(
        db_session, email="employee@active.dev", name="Employee", company=active_company
    )
    target = await create_user(
        db_session, email="target@active.dev", name="Target", company=active_company
    )
    super_admin = await create_user(
        db_session,
        email="super@careermate.dev",
        name="Super Admin",
        role=Role.SUPER_ADMIN,
    )
    employee_headers = await login(client, employee.email)
    super_headers = await login(client, super_admin.email)

    assert (await client.get("/api/v2/people", headers=employee_headers)).status_code == 403
    missing_scope = await client.get("/api/v2/people", headers=super_headers)
    invalid_page = await client.get(
        f"/api/v2/people?companyId={active_company.id}&page=0", headers=super_headers
    )
    excessive_page = await client.get(
        f"/api/v2/people?companyId={active_company.id}&page=10001", headers=super_headers
    )
    assert missing_scope.status_code == 400
    assert missing_scope.json() == {"detail": "companyId là bắt buộc với quản trị viên nền tảng"}
    assert invalid_page.status_code == 422
    assert isinstance(invalid_page.json()["detail"], list)
    assert excessive_page.status_code == 422
    scoped = await client.get(
        f"/api/v2/people?companyId={active_company.id}", headers=super_headers
    )
    detail = await client.get(
        f"/api/v2/people/{target.id}?companyId={active_company.id}", headers=super_headers
    )
    archived = await client.get(
        f"/api/v2/people?companyId={archived_company.id}", headers=super_headers
    )

    assert scoped.status_code == 200
    assert scoped.json()["total"] == 2
    assert detail.status_code == 200
    assert archived.status_code == 404


@pytest.mark.asyncio
async def test_super_admin_can_list_active_company_options_without_employee_counts(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    active = await CompanyRepository(db_session).add(Company(name="Zeta Active"))
    archived = await CompanyRepository(db_session).add(
        Company(name="Archived Hidden", status=CompanyStatus.ARCHIVED)
    )
    await db_session.flush()
    super_admin = await create_user(
        db_session,
        email="company-options-super@careermate.dev",
        name="Super Admin",
        role=Role.SUPER_ADMIN,
    )
    company_admin = await create_user(
        db_session,
        email="company-options-admin@active.dev",
        name="Company Admin",
        role=Role.COMPANY_ADMIN,
        company=active,
        admin_permissions=[AdminPermission.EMPLOYEE_READ],
    )
    super_headers = await login(client, super_admin.email)
    company_headers = await login(client, company_admin.email)

    response = await client.get("/api/v2/companies/options", headers=super_headers)
    denied = await client.get("/api/v2/companies/options", headers=company_headers)

    assert response.status_code == 200
    assert response.json() == {"items": [{"id": str(active.id), "name": "Zeta Active"}]}
    assert str(archived.id) not in response.text
    assert "count" not in response.text.casefold()
    assert denied.status_code == 403


def test_user_profile_version_and_roster_index_are_in_model_metadata() -> None:
    constraint_names = {constraint.name for constraint in User.__table__.constraints}
    indexes = {index.name: index for index in User.__table__.indexes}

    assert "ck_users_version_positive" in constraint_names
    roster_index = indexes["ix_users_roster_scope"]
    assert [str(expression) for expression in roster_index.expressions] == [
        "users.company_id",
        "users.role",
        "lower(users.name)",
        "users.id",
    ]
