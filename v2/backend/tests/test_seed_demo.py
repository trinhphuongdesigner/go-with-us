import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import Settings
from app.domain.models import Base, User
from app.security.jwt import verify_and_upgrade_password
from scripts import seed_demo


def settings_for_seed(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "_env_file": None,
        "environment": "test",
        "database_url": "sqlite+aiosqlite://",
        "jwt_secret": "test-only-secret-that-is-at-least-32-characters",
        "demo_super_admin_password": "SyntheticSuperPass123!",
        "demo_company_admin_password": "SyntheticAdminPass123!",
        "demo_employee_password": "SyntheticEmployeePass123!",
    }
    values.update(overrides)
    return Settings(**values)  # type: ignore[arg-type]


@pytest.mark.asyncio
async def test_demo_seed_is_blocked_outside_local_and_test(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = settings_for_seed(
        environment="production",
        database_url="postgresql+asyncpg://careermate@127.0.0.1:1/never-used",
    )
    monkeypatch.setattr(seed_demo, "get_settings", lambda: settings)

    with pytest.raises(RuntimeError, match="local or test"):
        await seed_demo.seed()


@pytest.mark.parametrize(
    "overrides, message",
    [
        ({"demo_employee_password": None}, "All three role-specific"),
        (
            {
                "demo_company_admin_password": "SyntheticSuperPass123!",
            },
            "different for every privilege level",
        ),
        ({"demo_employee_password": "TooShort1!"}, "at least 12 characters"),
    ],
)
def test_demo_seed_requires_three_strong_distinct_role_passwords(
    overrides: dict[str, object], message: str
) -> None:
    with pytest.raises(RuntimeError, match=message):
        seed_demo.resolve_demo_passwords(settings_for_seed(**overrides))


@pytest.mark.asyncio
async def test_demo_seed_assigns_distinct_passwords_and_is_idempotent(
    tmp_path,
    monkeypatch: pytest.MonkeyPatch,  # type: ignore[no-untyped-def]
) -> None:
    database_url = f"sqlite+aiosqlite:///{tmp_path / 'seed.db'}"
    settings = settings_for_seed(database_url=database_url)
    engine = create_async_engine(database_url)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    await engine.dispose()
    monkeypatch.setattr(seed_demo, "get_settings", lambda: settings)

    await seed_demo.seed()
    await seed_demo.seed()

    engine = create_async_engine(database_url)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        users = {user.email: user for user in (await session.scalars(select(User))).all()}
    await engine.dispose()

    assert set(users) == {
        seed_demo.DEMO_SUPER,
        seed_demo.DEMO_ADMIN,
        seed_demo.DEMO_EMPLOYEE,
    }
    password_by_email = {
        seed_demo.DEMO_SUPER: "SyntheticSuperPass123!",
        seed_demo.DEMO_ADMIN: "SyntheticAdminPass123!",
        seed_demo.DEMO_EMPLOYEE: "SyntheticEmployeePass123!",
    }
    for email, password in password_by_email.items():
        assert verify_and_upgrade_password(password, users[email].hashed_password)[0]
        for other_password in password_by_email.values():
            if other_password != password:
                assert not verify_and_upgrade_password(
                    other_password, users[email].hashed_password
                )[0]
