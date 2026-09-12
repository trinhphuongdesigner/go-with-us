import uuid

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.enums import AdminPermission, Role
from app.domain.models import ActivityLog, Company, Employment, User
from app.repositories.user_repo import CompanyRepository, UserRepository
from app.security.jwt import hash_password
from app.services.user_service import AuthorizationDenied, TenantMismatch, UserService


async def make_actor(
    db: AsyncSession,
    *,
    role: Role,
    company: Company | None = None,
    permissions: list[str] | None = None,
) -> User:
    actor = User(
        email=f"{uuid.uuid4()}@example.dev",
        name="Actor",
        hashed_password=hash_password("DemoPass123!"),
        role=role,
        company_id=company.id if company else None,
        admin_permissions=permissions or [],
    )
    await UserRepository(db).add(actor)
    await db.commit()
    return actor


@pytest.mark.asyncio
async def test_super_admin_creates_company_with_audit_as_initiator(
    db_session: AsyncSession,
) -> None:
    actor = await make_actor(db_session, role=Role.SUPER_ADMIN)

    company, admin = await UserService(db_session).create_company_with_admin(
        initiator=actor,
        request_id="req-company",
        company_name="Acme",
        admin_email="admin@acme.dev",
        admin_password="DemoPass123!",
    )

    assert admin.company_id == company.id
    audit = await db_session.scalar(
        select(ActivityLog).where(ActivityLog.action == "company.created")
    )
    assert audit is not None
    assert audit.actor_id == actor.id
    assert audit.request_id == "req-company"


@pytest.mark.asyncio
async def test_company_creation_rejects_non_super_admin(db_session: AsyncSession) -> None:
    company = await CompanyRepository(db_session).add(Company(name="Existing"))
    await db_session.flush()
    actor = await make_actor(db_session, role=Role.COMPANY_ADMIN, company=company)

    with pytest.raises(AuthorizationDenied):
        await UserService(db_session).create_company_with_admin(
            initiator=actor,
            request_id="denied-company",
            company_name="Forbidden",
            admin_email="admin@forbidden.dev",
            admin_password="DemoPass123!",
        )


@pytest.mark.asyncio
async def test_company_creation_rolls_back_company_and_admin_when_audit_fails(
    db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    actor = await make_actor(db_session, role=Role.SUPER_ADMIN)
    service = UserService(db_session)

    async def fail_audit(**_: object) -> None:
        raise RuntimeError("audit unavailable")

    monkeypatch.setattr(service.activity_repo, "log", fail_audit)
    with pytest.raises(RuntimeError, match="audit unavailable"):
        await service.create_company_with_admin(
            initiator=actor,
            request_id="rollback-company",
            company_name="Rollback Corp",
            admin_email="admin@rollback.dev",
            admin_password="DemoPass123!",
        )

    assert await db_session.scalar(select(Company).where(Company.name == "Rollback Corp")) is None
    assert await db_session.scalar(select(User).where(User.email == "admin@rollback.dev")) is None


@pytest.mark.asyncio
async def test_company_admin_creates_employee_only_inside_own_tenant(
    db_session: AsyncSession,
) -> None:
    own = await CompanyRepository(db_session).add(Company(name="Own"))
    other = await CompanyRepository(db_session).add(Company(name="Other"))
    await db_session.flush()
    actor = await make_actor(
        db_session,
        role=Role.COMPANY_ADMIN,
        company=own,
        permissions=[AdminPermission.EMPLOYEE_WRITE.value],
    )
    service = UserService(db_session)
    employee = await service.create_employee(
        initiator=actor,
        request_id="req-employee",
        company_id=own.id,
        email="employee@own.dev",
        password="DemoPass123!",
    )
    audit = await db_session.scalar(
        select(ActivityLog).where(ActivityLog.action == "employee.created")
    )
    assert employee.company_id == own.id
    assert audit is not None and audit.actor_id == actor.id
    assert audit.request_id == "req-employee"

    with pytest.raises(TenantMismatch):
        await service.create_employee(
            initiator=actor,
            request_id="cross-tenant",
            company_id=other.id,
            email="employee@other.dev",
            password="DemoPass123!",
        )


@pytest.mark.asyncio
async def test_company_admin_without_employee_write_is_denied(
    db_session: AsyncSession,
) -> None:
    company = await CompanyRepository(db_session).add(Company(name="Own"))
    await db_session.flush()
    actor = await make_actor(db_session, role=Role.COMPANY_ADMIN, company=company)

    with pytest.raises(AuthorizationDenied):
        await UserService(db_session).create_employee(
            initiator=actor,
            request_id="denied",
            company_id=company.id,
            email="employee@own.dev",
            password="DemoPass123!",
        )


@pytest.mark.asyncio
async def test_employee_creation_rolls_back_all_records_when_audit_fails(
    db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    company = await CompanyRepository(db_session).add(Company(name="Own"))
    await db_session.flush()
    actor = await make_actor(
        db_session,
        role=Role.COMPANY_ADMIN,
        company=company,
        permissions=[AdminPermission.EMPLOYEE_WRITE.value],
    )
    service = UserService(db_session)
    company_id = company.id

    async def fail_audit(**_: object) -> None:
        raise RuntimeError("audit unavailable")

    monkeypatch.setattr(service.activity_repo, "log", fail_audit)
    with pytest.raises(RuntimeError, match="audit unavailable"):
        await service.create_employee(
            initiator=actor,
            request_id="rollback",
            company_id=company_id,
            email="rollback@own.dev",
            password="DemoPass123!",
        )

    assert await db_session.scalar(select(User).where(User.email == "rollback@own.dev")) is None
    assert (
        await db_session.scalar(select(Employment).where(Employment.company_id == company_id))
        is None
    )
