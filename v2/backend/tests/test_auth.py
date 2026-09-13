import uuid

import bcrypt
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.enums import CompanyStatus, Role
from app.domain.models import ActivityLog, AuthSession, Company, User
from app.repositories.user_repo import CompanyRepository, UserRepository
from app.security.jwt import decode_token, hash_jti, hash_password


async def create_user(
    db: AsyncSession,
    *,
    email: str,
    password: str,
    role: Role = Role.EMPLOYEE,
    company: Company | None = None,
    is_active: bool = True,
    hashed_password: str | None = None,
) -> User:
    if role != Role.SUPER_ADMIN and company is None:
        company = await CompanyRepository(db).add(Company(name=f"Company for {email}"))
        await db.flush()
    user = User(
        email=email,
        name=email.split("@", maxsplit=1)[0],
        job_title="Nhân viên",
        hashed_password=hashed_password or hash_password(password),
        role=role,
        company_id=company.id if company else None,
        is_active=is_active,
    )
    await UserRepository(db).add(user)
    await db.commit()
    return user


@pytest.mark.asyncio
async def test_login_and_me_use_json_contract(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    company = await CompanyRepository(db_session).add(Company(name="Acme"))
    await db_session.flush()
    user = await create_user(
        db_session, email="alice@acme.dev", password="DemoPass123!", company=company
    )

    response = await client.post(
        "/api/v2/auth/login",
        json={"email": "  ALICE@ACME.DEV ", "password": "DemoPass123!"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["user"]["id"] == str(user.id)
    assert body["user"]["companyId"] == str(company.id)
    assert body["accessToken"]
    assert "X-Request-ID" in response.headers

    me = await client.get(
        "/api/v2/auth/me", headers={"Authorization": f"Bearer {body['accessToken']}"}
    )
    assert me.status_code == 200
    assert me.json()["user"]["companyName"] == "Acme"


@pytest.mark.asyncio
async def test_logout_revokes_only_the_presented_session(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await create_user(db_session, email="sessions@acme.dev", password="DemoPass123!")
    credentials = {"email": "sessions@acme.dev", "password": "DemoPass123!"}
    first = (await client.post("/api/v2/auth/login", json=credentials)).json()["accessToken"]
    second = (await client.post("/api/v2/auth/login", json=credentials)).json()["accessToken"]

    logout = await client.post("/api/v2/auth/logout", headers={"Authorization": f"Bearer {first}"})

    assert logout.status_code == 200
    assert (
        await client.get("/api/v2/auth/me", headers={"Authorization": f"Bearer {first}"})
    ).status_code == 401
    assert (
        await client.get("/api/v2/auth/me", headers={"Authorization": f"Bearer {second}"})
    ).status_code == 200


@pytest.mark.asyncio
async def test_auth_session_persists_only_a_jti_hash(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await create_user(db_session, email="hashed-session@acme.dev", password="DemoPass123!")

    response = await client.post(
        "/api/v2/auth/login",
        json={"email": "hashed-session@acme.dev", "password": "DemoPass123!"},
    )

    access_token = response.json()["accessToken"]
    session = await db_session.scalar(select(AuthSession))
    raw_jti = uuid.UUID(decode_token(access_token)["jti"])
    assert session is not None
    assert len(session.jti_hash) == 64
    assert session.jti_hash == hash_jti(raw_jti)
    assert str(raw_jti) != session.jti_hash


@pytest.mark.asyncio
async def test_wrong_email_and_password_share_generic_error(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await create_user(db_session, email="known@acme.dev", password="DemoPass123!")
    wrong_password = await client.post(
        "/api/v2/auth/login", json={"email": "known@acme.dev", "password": "WrongPass123!"}
    )
    wrong_email = await client.post(
        "/api/v2/auth/login", json={"email": "unknown@acme.dev", "password": "WrongPass123!"}
    )
    assert wrong_password.status_code == wrong_email.status_code == 401
    assert wrong_password.json() == wrong_email.json()


@pytest.mark.asyncio
async def test_malformed_password_hash_returns_generic_unauthorized(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await create_user(
        db_session,
        email="malformed@acme.dev",
        password="unused-password",
        hashed_password="not-a-supported-password-hash",
    )

    response = await client.post(
        "/api/v2/auth/login",
        json={"email": "malformed@acme.dev", "password": "DemoPass123!"},
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Email hoặc mật khẩu không đúng"}


@pytest.mark.asyncio
async def test_legacy_bcrypt_long_password_returns_generic_unauthorized(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    legacy_hash = bcrypt.hashpw(b"DemoPass123!", bcrypt.gensalt()).decode()
    await create_user(
        db_session,
        email="legacy@acme.dev",
        password="DemoPass123!",
        hashed_password=legacy_hash,
    )

    response = await client.post(
        "/api/v2/auth/login",
        json={"email": "legacy@acme.dev", "password": "x" * 73},
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Email hoặc mật khẩu không đúng"}


@pytest.mark.asyncio
async def test_me_rejects_missing_and_invalid_tokens(client: AsyncClient) -> None:
    missing = await client.get("/api/v2/auth/me")
    invalid = await client.get("/api/v2/auth/me", headers={"Authorization": "Bearer invalid"})
    assert missing.status_code == invalid.status_code == 401


@pytest.mark.asyncio
async def test_archived_company_cannot_login(client: AsyncClient, db_session: AsyncSession) -> None:
    company = await CompanyRepository(db_session).add(
        Company(name="Archived", status=CompanyStatus.ARCHIVED)
    )
    await db_session.flush()
    await create_user(
        db_session, email="archived@acme.dev", password="DemoPass123!", company=company
    )
    response = await client.post(
        "/api/v2/auth/login",
        json={"email": "archived@acme.dev", "password": "DemoPass123!"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_inactive_user_cannot_login(client: AsyncClient, db_session: AsyncSession) -> None:
    await create_user(
        db_session,
        email="inactive@acme.dev",
        password="DemoPass123!",
        is_active=False,
    )

    response = await client.post(
        "/api/v2/auth/login",
        json={"email": "inactive@acme.dev", "password": "DemoPass123!"},
    )

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_successful_login_persists_bcrypt_upgrade(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    legacy_hash = bcrypt.hashpw(b"DemoPass123!", bcrypt.gensalt()).decode()
    user = await create_user(
        db_session,
        email="upgrade@acme.dev",
        password="DemoPass123!",
        hashed_password=legacy_hash,
    )

    response = await client.post(
        "/api/v2/auth/login",
        json={"email": "upgrade@acme.dev", "password": "DemoPass123!"},
    )

    assert response.status_code == 200
    user_id = user.id
    db_session.expire_all()
    persisted = await db_session.scalar(select(User).where(User.id == user_id))
    assert persisted is not None
    assert persisted.hashed_password.startswith("$argon2id$")


@pytest.mark.asyncio
async def test_login_audit_keeps_sanitized_request_id(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await create_user(db_session, email="audit@acme.dev", password="DemoPass123!")

    response = await client.post(
        "/api/v2/auth/login",
        headers={"X-Request-ID": "request_ABC-123"},
        json={"email": "audit@acme.dev", "password": "DemoPass123!"},
    )

    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == "request_ABC-123"
    audit = await db_session.scalar(select(ActivityLog).where(ActivityLog.action == "auth.login"))
    assert audit is not None and audit.request_id == "request_ABC-123"


@pytest.mark.asyncio
async def test_qc_demo_login_is_hidden_unless_explicitly_enabled(client: AsyncClient) -> None:
    accounts = await client.get("/api/v2/auth/demo-accounts")
    login = await client.post("/api/v2/auth/demo-login", json={"email": "alice@acme.dev"})

    assert accounts.status_code == login.status_code == 404


@pytest.mark.asyncio
async def test_qc_demo_picker_lists_only_seed_allowlist_and_issues_session(
    client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.api.v2 import auth

    monkeypatch.setattr(auth._settings, "environment", "local")
    monkeypatch.setattr(auth._settings, "demo_login_enabled", True)
    company = await CompanyRepository(db_session).add(Company(name="Acme QC"))
    await db_session.flush()
    alice = await create_user(
        db_session, email="alice@acme.dev", password="random-secret", company=company
    )
    await create_user(
        db_session, email="not-a-demo@acme.dev", password="random-secret", company=company
    )

    accounts = await client.get("/api/v2/auth/demo-accounts")
    assert accounts.status_code == 200
    assert [item["email"] for item in accounts.json()["items"]] == ["alice@acme.dev"]

    rejected = await client.post("/api/v2/auth/demo-login", json={"email": "not-a-demo@acme.dev"})
    assert rejected.status_code == 404

    login = await client.post("/api/v2/auth/demo-login", json={"email": "alice@acme.dev"})
    assert login.status_code == 200
    assert login.json()["user"]["id"] == str(alice.id)
    assert login.json()["accessToken"]
    audit = await db_session.scalar(
        select(ActivityLog).where(ActivityLog.action == "auth.demo_login")
    )
    assert audit is not None and audit.actor_id == alice.id


@pytest.mark.asyncio
async def test_invalid_request_id_is_replaced_with_uuid(client: AsyncClient) -> None:
    response = await client.get("/api/v2/health", headers={"X-Request-ID": "x" * 65})

    assert response.status_code == 200
    assert uuid.UUID(response.headers["X-Request-ID"])


@pytest.mark.asyncio
async def test_tenant_lookup_does_not_return_cross_company_user(
    db_session: AsyncSession,
) -> None:
    first = await CompanyRepository(db_session).add(Company(name="First"))
    second = await CompanyRepository(db_session).add(Company(name="Second"))
    await db_session.flush()
    user = await create_user(
        db_session, email="erin@second.dev", password="DemoPass123!", company=second
    )

    assert await UserRepository(db_session).get_in_company(user.id, first.id) is None
    assert await UserRepository(db_session).get_in_company(user.id, second.id) is not None
    assert await UserRepository(db_session).get_in_company(uuid.uuid4(), second.id) is None
