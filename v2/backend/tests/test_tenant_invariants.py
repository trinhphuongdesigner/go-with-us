import uuid
from datetime import UTC, datetime

import pytest
from sqlalchemy import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.enums import EmploymentStatus, Role
from app.domain.models import Company, Employment, User, validate_user_tenant_invariant
from app.repositories.user_repo import CompanyRepository
from app.security.jwt import hash_password


def user(role: Role, company_id: uuid.UUID | None) -> User:
    return User(
        email=f"{uuid.uuid4()}@example.dev",
        name="Invariant Test",
        hashed_password=hash_password("DemoPass123!"),
        role=role,
        company_id=company_id,
    )


@pytest.mark.parametrize("role", [Role.COMPANY_ADMIN, Role.EMPLOYEE])
def test_runtime_rejects_tenant_role_without_company(role: Role) -> None:
    with pytest.raises(ValueError, match="company_id"):
        validate_user_tenant_invariant(user(role, None))


def test_runtime_rejects_super_admin_with_company() -> None:
    with pytest.raises(ValueError, match="company_id"):
        validate_user_tenant_invariant(user(Role.SUPER_ADMIN, uuid.uuid4()))


@pytest.mark.asyncio
async def test_database_rejects_tenant_role_without_company(db_session: AsyncSession) -> None:
    with pytest.raises(IntegrityError):
        await db_session.execute(
            insert(User).values(
                email="invalid-tenant@example.dev",
                name="Invalid",
                hashed_password="unused",
                role=Role.EMPLOYEE,
                company_id=None,
                admin_permissions=[],
            )
        )
        await db_session.commit()


@pytest.mark.asyncio
async def test_database_rejects_super_admin_with_company(db_session: AsyncSession) -> None:
    company = await CompanyRepository(db_session).add(Company(name="Acme"))
    await db_session.flush()

    with pytest.raises(IntegrityError):
        await db_session.execute(
            insert(User).values(
                email="invalid-super@example.dev",
                name="Invalid",
                hashed_password="unused",
                role=Role.SUPER_ADMIN,
                company_id=company.id,
                admin_permissions=[],
            )
        )
        await db_session.commit()


@pytest.mark.asyncio
async def test_database_rejects_noncanonical_email(db_session: AsyncSession) -> None:
    company = await CompanyRepository(db_session).add(Company(name="Acme"))
    await db_session.flush()

    with pytest.raises(IntegrityError):
        await db_session.execute(
            insert(User).values(
                email=" Upper@Example.dev ",
                name="Invalid",
                hashed_password="unused",
                role=Role.EMPLOYEE,
                company_id=company.id,
                admin_permissions=[],
            )
        )
        await db_session.commit()


@pytest.mark.asyncio
async def test_postgresql_rejects_cross_tenant_employment(db_session: AsyncSession) -> None:
    bind = db_session.get_bind()
    if bind.dialect.name != "postgresql":
        pytest.skip("PostgreSQL integration constraint")

    first = await CompanyRepository(db_session).add(Company(name="First tenant"))
    second = await CompanyRepository(db_session).add(Company(name="Second tenant"))
    await db_session.flush()
    employee = user(Role.EMPLOYEE, first.id)
    db_session.add(employee)
    await db_session.commit()

    with pytest.raises(IntegrityError) as error:
        db_session.add(
            Employment(
                user_id=employee.id,
                company_id=second.id,
                title="Cross-tenant assignment",
                start_date=datetime.now(UTC),
                status=EmploymentStatus.ACTIVE,
            )
        )
        await db_session.commit()
    assert "fk_employments_user_company" in str(error.value)
