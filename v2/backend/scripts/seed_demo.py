import asyncio
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import Settings, get_settings
from app.domain.enums import AdminPermission, Role
from app.domain.models import User
from app.repositories.user_repo import UserRepository
from app.security.jwt import hash_password, verify_and_upgrade_password
from app.services.user_service import UserService

DEMO_SUPER = "superadmin@careermate.dev"
DEMO_ADMIN = "admin@acme.dev"
DEMO_EMPLOYEE = "alice@acme.dev"
DEMO_COMPANY = "Acme Demo Corp"


@dataclass(frozen=True)
class DemoPasswords:
    super_admin: str
    company_admin: str
    employee: str


def resolve_demo_passwords(settings: Settings) -> DemoPasswords:
    if settings.environment not in {"local", "test"}:
        raise RuntimeError("Demo seed can run only in local or test environments")
    configured = (
        settings.demo_super_admin_password,
        settings.demo_company_admin_password,
        settings.demo_employee_password,
    )
    if any(password is None for password in configured):
        raise RuntimeError("All three role-specific CAREERMATE_DEMO_*_PASSWORD values are required")
    values = tuple(password.get_secret_value() for password in configured if password is not None)
    if any(len(password) < 12 for password in values):
        raise RuntimeError("Demo passwords must contain at least 12 characters")
    if len(set(values)) != 3:
        raise RuntimeError("Demo passwords must be different for every privilege level")
    return DemoPasswords(*values)


def set_demo_password(user: User, password: str) -> None:
    valid, upgraded_hash = verify_and_upgrade_password(password, user.hashed_password)
    if not valid:
        user.hashed_password = hash_password(password)
    elif upgraded_hash is not None:
        user.hashed_password = upgraded_hash


async def seed() -> None:
    settings = get_settings()
    passwords = resolve_demo_passwords(settings)
    engine = create_async_engine(settings.database_url, pool_pre_ping=True)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with session_factory() as session:
        service = UserService(session)
        user_repo = UserRepository(session)
        super_admin = await user_repo.get_by_email(DEMO_SUPER)
        if super_admin is None:
            super_admin = await user_repo.add(
                User(
                    email=DEMO_SUPER,
                    name="Quản trị CareerMate",
                    job_title="Quản trị hệ thống",
                    hashed_password=hash_password(passwords.super_admin),
                    role=Role.SUPER_ADMIN,
                    company_id=None,
                    is_active=True,
                )
            )
            await session.commit()
        elif super_admin.role != Role.SUPER_ADMIN or super_admin.company_id is not None:
            raise RuntimeError("Demo super-admin email is already assigned to another identity")
        else:
            set_demo_password(super_admin, passwords.super_admin)

        company = await service.company_repo.get_by_name(DEMO_COMPANY)
        if company is None:
            company, _ = await service.create_company_with_admin(
                initiator=super_admin,
                request_id="seed-demo",
                company_name=DEMO_COMPANY,
                admin_email=DEMO_ADMIN,
                admin_password=passwords.company_admin,
            )
        else:
            admin = await user_repo.get_by_email(DEMO_ADMIN)
            if admin is None:
                admin = await user_repo.add(
                    User(
                        email=DEMO_ADMIN,
                        name="Quản trị viên",
                        job_title="Quản lý công ty",
                        hashed_password=hash_password(passwords.company_admin),
                        role=Role.COMPANY_ADMIN,
                        company_id=company.id,
                        admin_permissions=[permission.value for permission in AdminPermission],
                        is_active=True,
                    )
                )
            elif admin.role != Role.COMPANY_ADMIN or admin.company_id != company.id:
                raise RuntimeError("Demo company-admin email is already assigned elsewhere")
            else:
                set_demo_password(admin, passwords.company_admin)

        employee = await user_repo.get_by_email(DEMO_EMPLOYEE)
        if employee is None:
            await service.create_employee(
                initiator=super_admin,
                request_id="seed-demo",
                company_id=company.id,
                email=DEMO_EMPLOYEE,
                password=passwords.employee,
                title="Software Engineer",
            )
        elif employee.role != Role.EMPLOYEE or employee.company_id != company.id:
            raise RuntimeError("Demo employee email is already assigned elsewhere")
        else:
            set_demo_password(employee, passwords.employee)

        await session.commit()

    await engine.dispose()
    print("Seeded synthetic CareerMate v2 demo personas; credentials were not printed.")


if __name__ == "__main__":
    asyncio.run(seed())
