"""Create synthetic QC personas and idempotently enrich local QC workflow data.

Run from v2/backend with `python -m scripts.seed_qc` after migrations. Requires
CAREERMATE_ENVIRONMENT=local, database careermate_v2_qc on db/localhost, the three
CAREERMATE_DEMO_*_PASSWORD variables, QC_BOD_PASSWORD and QC_HR_PASSWORD.
Passwords are used only when creating accounts; reruns never reset passwords.
"""

import asyncio
import hashlib
import os
import sys
import uuid
from datetime import UTC, date, datetime

from sqlalchemy import select, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.company_memberships import CompanyMembership
from app.core.config import Settings, get_settings
from app.domain.enums import AdminPermission, EmploymentStatus, ProfileSourceType, Role
from app.domain.models import Company, EmployeeSkill, Employment, Experience, Skill, User
from app.domain.roadmap_models import (
    DevelopmentMilestone,
    DevelopmentPlanSettings,
    DevelopmentRoadmap,
    DevelopmentTask,
)
from app.domain.roadmap_schemas import RoadmapSave
from app.security.jwt import hash_password
from scripts.seed_ai_showcase import seed_ai_showcase
from scripts.seed_demo import (
    DEMO_ADMIN,
    DEMO_COMPANY,
    DEMO_EMPLOYEE,
    DEMO_SUPER,
    resolve_demo_passwords,
)
from scripts.seed_people_search_demo import seed_people_search_demo
from scripts.seed_qc_workflows import seed_ai_connection, seed_company_workflows

QC_DATABASE = "careermate_v2_qc"
QC_BOD = "bod@acme.dev"
QC_HR = "hr@acme.dev"
QC_NAMESPACE = uuid.UUID("65a6a9f5-dc81-43b3-8d21-34f07602cf01")
QC_START = datetime(2026, 1, 5, tzinfo=UTC)


def stable_id(key: str) -> uuid.UUID:
    return uuid.uuid5(QC_NAMESPACE, key)


def validate_target(settings: Settings) -> None:
    """Fail before opening a connection, without echoing database credentials."""
    if settings.environment != "local":
        raise RuntimeError("QC seed requires CAREERMATE_ENVIRONMENT=local")
    try:
        target = make_url(settings.database_url)
    except (ArgumentError, TypeError, ValueError):
        raise RuntimeError("QC database URL is invalid") from None
    if (
        target.drivername != "postgresql+asyncpg"
        or target.database != QC_DATABASE
        or target.host not in {"db", "localhost", "127.0.0.1", "::1"}
        or target.query
    ):
        raise RuntimeError(
            "QC seed requires local PostgreSQL database careermate_v2_qc without URL overrides"
        )


def resolve_passwords(settings: Settings) -> dict[Role, str]:
    # Reuse demo identities/password policy, not seed_demo.seed(): its reruns reset passwords.
    demo = resolve_demo_passwords(settings)
    bod, hr = os.environ.get("QC_BOD_PASSWORD", ""), os.environ.get("QC_HR_PASSWORD", "")
    if len(bod) < 12 or len(hr) < 12:
        raise RuntimeError(
            "QC_BOD_PASSWORD and QC_HR_PASSWORD must each contain at least 12 characters"
        )
    passwords = {
        Role.SUPER_ADMIN: demo.super_admin,
        Role.COMPANY_ADMIN: demo.company_admin,
        Role.EMPLOYEE: demo.employee,
        Role.BOD: bod,
        Role.HR: hr,
    }
    if len(set(passwords.values())) != len(passwords):
        raise RuntimeError("QC passwords must differ between all five privilege levels")
    return passwords


async def ensure_company(session: AsyncSession, key: str, name: str) -> Company:
    company = await session.get(Company, stable_id(f"company:{key}"))
    if company is None:
        company = await session.scalar(select(Company).where(Company.name == name))
    if company is None:
        company = Company(id=stable_id(f"company:{key}"), name=name)
        session.add(company)
        await session.flush()
    return company


async def ensure_user(
    session: AsyncSession,
    *,
    email: str,
    name: str,
    title: str,
    role: Role,
    company: Company | None,
    password: str,
) -> User:
    user = await session.get(User, stable_id(f"user:{email}"))
    if user is None:
        user = await session.scalar(select(User).where(User.email == email))
    company_id = company.id if company is not None else None
    if user is not None:
        if user.company_id != company_id:
            raise RuntimeError("QC persona already exists in an unexpected tenant; no data changed")
        # Preserve names, title, active state, role, permissions, email and password edits.
        return user
    permissions = []
    if role in {Role.COMPANY_ADMIN, Role.BOD}:
        permissions = [item.value for item in AdminPermission]
    elif role == Role.HR:
        permissions = [
            AdminPermission.COMPANY_READ.value,
            AdminPermission.EMPLOYEE_READ.value,
            AdminPermission.EMPLOYEE_WRITE.value,
            AdminPermission.ASSESSMENT_REVIEW.value,
            AdminPermission.PASSPORT_APPROVE.value,
        ]
    user = User(
        id=stable_id(f"user:{email}"),
        email=email,
        name=name,
        job_title=title,
        hashed_password=hash_password(password),
        role=role,
        company_id=company_id,
        admin_permissions=permissions,
        is_active=True,
    )
    session.add(user)
    await session.flush()
    # Seed only newly created personas. Existing memberships may have been
    # intentionally removed by QC and must not be silently recreated on rerun.
    if company_id is not None:
        session.add(CompanyMembership(user_id=user.id, company_id=company_id))
        await session.flush()
    return user


async def ensure_profile(session: AsyncSession, user: User, company: Company) -> None:
    employment = await session.scalar(select(Employment).where(Employment.user_id == user.id))
    if employment is None:
        employment = Employment(
            id=stable_id(f"employment:{user.id}"),
            user_id=user.id,
            company_id=company.id,
            title=user.job_title or "QC team member",
            start_date=QC_START,
            status=EmploymentStatus.ACTIVE,
        )
        session.add(employment)
        await session.flush()
    elif employment.company_id != company.id:
        raise RuntimeError("QC employment belongs to an unexpected tenant")

    experience_id = stable_id(f"experience:{user.id}")
    if await session.get(Experience, experience_id) is None:
        session.add(
            Experience(
                id=experience_id,
                user_id=user.id,
                company_id=company.id,
                employment_id=employment.id,
                title=user.job_title or "QC team member",
                organization=company.name,
                description="Synthetic QC profile for tenant and profile workflows.",
                start_date=date(2026, 1, 5),
                source_type=ProfileSourceType.SELF,
                created_by=user.id,
                updated_by=user.id,
            )
        )

    role_skills = {
        Role.BOD: [("Leadership", "leadership"), ("Strategic Planning", "strategic planning")],
        Role.HR: [("Recruitment", "recruitment"), ("Communication", "communication")],
    }
    for index, (name, key) in enumerate(
        role_skills.get(user.role, [("Python", "python"), ("React", "react")])
    ):
        skill = await session.scalar(select(Skill).where(Skill.normalized_key == key))
        if skill is None:
            skill = Skill(
                id=stable_id(f"skill:{key}"), name=name, normalized_key=key, category="QC catalog"
            )
            session.add(skill)
            await session.flush()
        association = await session.scalar(
            select(EmployeeSkill).where(
                EmployeeSkill.user_id == user.id,
                EmployeeSkill.skill_id == skill.id,
            )
        )
        if association is None:
            session.add(
                EmployeeSkill(
                    id=stable_id(f"employee-skill:{user.id}:{skill.id}"),
                    user_id=user.id,
                    company_id=company.id,
                    skill_id=skill.id,
                    rating=3 + index,
                    note="Synthetic QC self assessment",
                    self_assessed=True,
                    source_type=ProfileSourceType.SELF,
                    created_by=user.id,
                    updated_by=user.id,
                )
            )
    await session.flush()


async def ensure_roadmaps(session: AsyncSession, user: User) -> None:
    for category in ("WORK", "PERSONAL"):
        key = f"roadmap:{user.id}:{category}:initial"
        roadmap_id, request_id = stable_id(key), stable_id(f"request:{key}")
        existing = await session.get(DevelopmentRoadmap, roadmap_id)
        if existing is None:
            existing = await session.scalar(
                select(DevelopmentRoadmap).where(
                    DevelopmentRoadmap.owner_user_id == user.id,
                    DevelopmentRoadmap.company_id == user.company_id,
                    DevelopmentRoadmap.client_request_id == request_id,
                )
            )
        if existing is not None:
            if existing.owner_user_id != user.id or existing.company_id != user.company_id:
                raise RuntimeError("QC roadmap belongs to an unexpected owner or tenant")
            continue
        work = category == "WORK"
        payload = RoadmapSave.model_validate(
            {
                "clientRequestId": request_id,
                "category": category,
                "title": "QC: Grow professional skills"
                if work
                else "QC: Build a personal learning habit",
                "durationWeeks": 8,
                "hoursPerWeek": 4 if work else 2,
                "milestones": [
                    {
                        "title": "Explore and prepare",
                        "dueDate": "2026-11-01",
                        "tasks": [
                            {"title": "Define the learning outcome", "metric": "One written goal"},
                            {
                                "title": "Complete the first learning session",
                                "metric": "One session",
                            },
                        ],
                    },
                    {
                        "title": "Practice and reflect",
                        "dueDate": "2026-12-01",
                        "tasks": [
                            {"title": "Apply the learning", "metric": "One practical example"},
                            {"title": "Record lessons learned", "metric": "One short reflection"},
                        ],
                    },
                ],
            }
        )
        session.add(
            DevelopmentRoadmap(
                id=roadmap_id,
                owner_user_id=user.id,
                company_id=user.company_id,
                client_request_id=request_id,
                request_hash=hashlib.sha256(
                    payload.model_dump_json(exclude={"client_request_id"}).encode()
                ).hexdigest(),
                category=payload.category,
                title=payload.title,
                duration_weeks=payload.duration_weeks,
                hours_per_week=payload.hours_per_week,
                milestones=[
                    DevelopmentMilestone(
                        id=stable_id(f"{key}:milestone:{index}"),
                        title=milestone.title,
                        description=milestone.description,
                        due_date=milestone.due_date,
                        order=index,
                        tasks=[
                            DevelopmentTask(
                                id=stable_id(f"{key}:milestone:{index}:task:{task_index}"),
                                title=task.title,
                                metric=task.metric,
                                order=task_index,
                                done=work and index == 0 and task_index == 0,
                            )
                            for task_index, task in enumerate(milestone.tasks)
                        ],
                    )
                    for index, milestone in enumerate(payload.milestones)
                ],
            )
        )
    if await session.get(DevelopmentPlanSettings, (user.id, user.company_id)) is None:
        session.add(
            DevelopmentPlanSettings(
                owner_user_id=user.id,
                company_id=user.company_id,
                display_settings={
                    "character": "milo",
                    "view_mode": "stair",
                    "costume_color": "#6366f1",
                    "reduce_motion": False,
                    "font_size": "md",
                },
            )
        )
    await session.flush()


async def seed() -> None:
    settings = get_settings()
    validate_target(settings)
    passwords = resolve_passwords(settings)
    engine = create_async_engine(settings.database_url, pool_pre_ping=True, hide_parameters=True)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with factory() as session, session.begin():
            if await session.scalar(text("SELECT current_database()")) != QC_DATABASE:
                raise RuntimeError("Connected database is not careermate_v2_qc")
            # Serialize repeated/concurrent seed invocations while keeping all inserts atomic.
            await session.execute(text("SELECT pg_advisory_xact_lock(62626312001)"))
            await seed_ai_connection(session)
            await ensure_user(
                session,
                email=DEMO_SUPER,
                name="QC Platform Admin",
                title="Platform Admin",
                role=Role.SUPER_ADMIN,
                company=None,
                password=passwords[Role.SUPER_ADMIN],
            )
            for company_key, company_name, domain in (
                ("acme", DEMO_COMPANY, "acme.dev"),
                ("northstar", "Northstar QC Studio", "northstar.dev"),
            ):
                company = await ensure_company(session, company_key, company_name)
                company_admin = await ensure_user(
                    session,
                    email=DEMO_ADMIN if company_key == "acme" else f"admin@{domain}",
                    name=f"QC {company_key.title()} Admin",
                    title="Company Admin",
                    role=Role.COMPANY_ADMIN,
                    company=company,
                    password=passwords[Role.COMPANY_ADMIN],
                )
                personas = [company_admin]
                for role, email, name, title in (
                    (
                        Role.BOD,
                        QC_BOD if company_key == "acme" else f"bod@{domain}",
                        "QC Director",
                        "Director",
                    ),
                    (
                        Role.HR,
                        QC_HR if company_key == "acme" else f"hr@{domain}",
                        "QC People Partner",
                        "HR Manager",
                    ),
                    (
                        Role.EMPLOYEE,
                        DEMO_EMPLOYEE if company_key == "acme" else f"alex@{domain}",
                        "QC Alice" if company_key == "acme" else "QC Alex",
                        "Software Engineer",
                    ),
                ):
                    user = await ensure_user(
                        session,
                        email=email,
                        name=name,
                        title=title,
                        role=role,
                        company=company,
                        password=passwords[role],
                    )
                    personas.append(user)
                    if user.role in {Role.BOD, Role.HR, Role.EMPLOYEE}:
                        await ensure_profile(session, user, company)
                        await ensure_roadmaps(session, user)
                await seed_people_search_demo(
                    session,
                    company,
                    company_admin,
                    personas,
                )
                await seed_company_workflows(session, company, personas)
                if company_key == "acme":
                    await seed_ai_showcase(
                        session,
                        company=company,
                        employee=next(user for user in personas if user.role == Role.EMPLOYEE),
                        peer_reviewer=next(user for user in personas if user.role == Role.HR),
                        manager_reviewer=next(user for user in personas if user.role == Role.BOD),
                        approver=company_admin,
                    )
    finally:
        await engine.dispose()
    print(
        "QC seed complete: two synthetic companies and five role levels; existing login personas preserved. Credentials were not printed."
    )


if __name__ == "__main__":
    try:
        asyncio.run(seed())
    except Exception:  # noqa: BLE001 - redact all startup failures before exiting the CLI
        # Avoid rendering database URLs, secret-bearing config validation or SQL parameters.
        print(
            "QC seed failed; check local QC database/migrations and required password variables. No credentials printed.",
            file=sys.stderr,
        )
        raise SystemExit(1) from None
