import pytest
from fastapi import HTTPException
from sqlalchemy import update

from app.domain.enums import AdminPermission, CompanyStatus, Role
from app.domain.models import Company, User
from app.organization import AccountCreate, CompanyPatch, create_account, patch_company
from app.repositories.user_repo import UserRepository
from app.security.jwt import hash_password


async def test_patch_company_refreshes_locked_row_before_version_check(db_session):
    company = Company(name="Original company")
    db_session.add(company)
    await db_session.flush()
    actor = User(
        email="company-concurrency@example.test",
        name="Company Admin",
        role=Role.COMPANY_ADMIN,
        company_id=company.id,
        hashed_password=hash_password("ConcurrencyTest123!"),
        admin_permissions=[AdminPermission.COMPANY_WRITE.value],
    )
    db_session.add(actor)
    await db_session.commit()
    company_id = company.id

    loaded_actor = await UserRepository(db_session).get_by_id(actor.id)
    assert loaded_actor is not None and loaded_actor.company is not None
    assert loaded_actor.company.version == 1
    await db_session.execute(
        update(Company)
        .where(Company.id == company_id)
        .values(name="Concurrent update", version=2)
        .execution_options(synchronize_session=False)
    )
    await db_session.commit()
    assert loaded_actor.company.version == 1

    with pytest.raises(HTTPException) as error:
        await patch_company(
            company_id,
            CompanyPatch(
                expected_version=1,
                name="Stale overwrite",
                industry=None,
                status=CompanyStatus.ACTIVE,
            ),
            db_session,
            loaded_actor,
        )

    assert error.value.status_code == 409
    db_session.expire_all()
    stored = await db_session.get(Company, company_id)
    assert stored is not None
    assert stored.name == "Concurrent update"
    assert stored.version == 2


async def test_create_account_locks_company_before_copying_role_grants(db_session, monkeypatch):
    company = Company(name="Role grant lock company")
    db_session.add(company)
    await db_session.flush()
    actor = User(
        email="account-lock-admin@example.test",
        name="Company Admin",
        role=Role.COMPANY_ADMIN,
        company_id=company.id,
        hashed_password=hash_password("ConcurrencyTest123!"),
        admin_permissions=[AdminPermission.EMPLOYEE_WRITE.value],
    )
    db_session.add(actor)
    await db_session.commit()

    company_locked = False
    original_scalar = db_session.scalar

    async def tracked_scalar(statement, *args, **kwargs):
        nonlocal company_locked
        if getattr(statement, "_for_update_arg", None) is not None:
            company_locked = True
        return await original_scalar(statement, *args, **kwargs)

    async def grants_after_lock(_db, _company_id, role):
        assert company_locked is True
        assert role == Role.HR
        return [AdminPermission.EMPLOYEE_READ.value]

    monkeypatch.setattr(db_session, "scalar", tracked_scalar)
    monkeypatch.setattr("app.organization.role_grants", grants_after_lock)

    created = await create_account(
        AccountCreate(
            company_id=company.id,
            email="created-hr@example.com",
            name="Created HR",
            role=Role.HR,
            password="ConcurrencyTest123!",
        ),
        db_session,
        actor,
    )

    assert created.admin_permissions == [AdminPermission.EMPLOYEE_READ.value]
