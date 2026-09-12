#!/usr/bin/env python3
"""Smoke test for people-search: runs sample queries via TestClient, prints status/counts only.

Never prints secrets or .env content.
"""

from __future__ import annotations

import asyncio
import os
import sys
import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

os.environ.setdefault("CAREERMATE_ENVIRONMENT", "test")
os.environ.setdefault("CAREERMATE_DATABASE_URL", "sqlite+aiosqlite://")
os.environ.setdefault("CAREERMATE_JWT_SECRET", "smoke-test-secret-at-least-32-characters-long")
# Deliberate: never let this smoke run make a real Madison call or echo a real key.
os.environ["CAREERMATE_MADISON_API_KEY"] = ""

from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.domain.enums import AdminPermission, EmploymentStatus, Role
from app.domain.models import Company, Employment, User
from app.people_search.app import app
from app.repositories.user_repo import CompanyRepository, UserRepository
from app.security.jwt import hash_password

SAMPLE_QUERIES = [
    "Backend engineer",
    "Python required, at least 3 years experience",
    "Người có kỹ năng lãnh đạo tốt",
    "",
]


async def _seed(session_factory: async_sessionmaker[AsyncSession]) -> tuple[str, str]:
    async with session_factory() as db:
        company = await CompanyRepository(db).add(Company(name="Smoke Co"))
        await db.flush()
        admin = User(
            id=uuid.uuid4(),
            email="smoke-admin@example.dev",
            name="Smoke Admin",
            job_title="Admin",
            hashed_password=hash_password("Password123!"),
            role=Role.COMPANY_ADMIN,
            company_id=company.id,
            admin_permissions=[AdminPermission.EMPLOYEE_READ.value],
        )
        await UserRepository(db).add(admin)
        engineer = User(
            id=uuid.uuid4(),
            email="smoke-eng@example.dev",
            name="Smoke Engineer",
            job_title="Backend Engineer",
            hashed_password=hash_password("Password123!"),
            role=Role.EMPLOYEE,
            company_id=company.id,
        )
        await UserRepository(db).add(engineer)
        await db.flush()
        db.add(
            Employment(
                user_id=engineer.id,
                company_id=company.id,
                title="Backend Engineer",
                start_date=datetime.now(UTC) - timedelta(days=1200),
                status=EmploymentStatus.ACTIVE,
            )
        )
        await db.commit()
        return admin.email, "Password123!"


def main() -> None:
    engine = create_async_engine(
        "sqlite+aiosqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async def _setup() -> tuple[str, str]:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        return await _seed(session_factory)

    email, password = asyncio.run(_setup())

    async def _override_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db

    with TestClient(app) as client:
        login = client.post("/api/v2/auth/login", json={"email": email, "password": password})
        token = login.json()["accessToken"]
        headers = {"Authorization": f"Bearer {token}"}

        for query in SAMPLE_QUERIES:
            response = client.post("/api/v2/people-search/query", json={"query": query}, headers=headers)
            body = response.json()
            print(
                f"query={query!r} http={response.status_code} "
                f"status={body.get('status')} candidates={len(body.get('candidates', []))}"
            )


if __name__ == "__main__":
    main()
