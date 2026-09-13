"""Seed search evidence onto the QC users that already exist in the local database.

The fixtures never create login accounts. They enrich the existing BOD, HR and
employee personas with deterministic, tenant-scoped skills, experience and
projects. A narrow cleanup removes the six legacy generated-only people created
by the previous Smart People Search fixture.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import date

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.company_memberships import CompanyMembership
from app.domain.enums import ProfileSourceType, Role
from app.domain.models import Company, EmployeeSkill, Employment, Experience, Project, Skill, User

SEARCH_NAMESPACE = uuid.UUID("9c52a1cf-217f-46f8-9e31-e02e2a1e53e7")
LEGACY_GENERATED_KEYS = ("minh-anh", "bao-tran", "chi-nguyen", "duy-le", "ha-vo", "kim-pham")
LEGACY_GENERATED_EMAILS = tuple(
    f"demo.{key.replace('-', '.')}@acme.dev" for key in LEGACY_GENERATED_KEYS
)


def fixture_id(key: str) -> uuid.UUID:
    return uuid.uuid5(SEARCH_NAMESPACE, key)


@dataclass(frozen=True, slots=True)
class SkillFixture:
    name: str
    key: str
    rating: int
    note: str


@dataclass(frozen=True, slots=True)
class ProjectFixture:
    name: str
    role: str
    domain: str
    tech_stack: tuple[str, ...]
    description: str
    contribution: str
    start_date: date


@dataclass(frozen=True, slots=True)
class ProfileFixture:
    email: str
    role: Role
    experience_title: str
    experience: str
    experience_start: date
    skills: tuple[SkillFixture, ...]
    project: ProjectFixture


PROFILE_FIXTURES: tuple[ProfileFixture, ...] = (
    ProfileFixture(
        email="alice@acme.dev",
        role=Role.EMPLOYEE,
        experience_title="Senior Software Engineer",
        experience="5 năm phát triển sản phẩm web, trong đó 3 năm dẫn dắt kỹ thuật frontend và tích hợp API.",
        experience_start=date(2021, 3, 1),
        skills=(
            SkillFixture("React", "react", 5, "4 năm triển khai React trong sản phẩm production."),
            SkillFixture("TypeScript", "typescript", 5, "Thiết kế contract và component library dùng chung."),
            SkillFixture("FastAPI", "fastapi", 4, "Tích hợp và phát triển API bất đồng bộ cho sản phẩm nội bộ."),
            SkillFixture("PostgreSQL", "postgresql", 4, "Thiết kế schema và truy vấn cho luồng nghiệp vụ."),
            SkillFixture("Technical Leadership", "technical leadership", 4, "Dẫn dắt review code và chia nhỏ phạm vi delivery."),
        ),
        project=ProjectFixture(
            name="Atlas Customer Portal",
            role="Frontend Tech Lead",
            domain="Digital Commerce",
            tech_stack=("React", "Next.js", "TypeScript", "FastAPI", "PostgreSQL"),
            description="Dẫn dắt 5 kỹ sư xây cổng khách hàng và migration design system.",
            contribution="Thiết kế kiến trúc frontend, kết nối API và giảm 35% thời gian tải trang.",
            start_date=date(2024, 1, 1),
        ),
    ),
    ProfileFixture(
        email="hr@acme.dev",
        role=Role.HR,
        experience_title="HR Manager",
        experience="6 năm tuyển dụng và phát triển trải nghiệm nhân viên dựa trên dữ liệu.",
        experience_start=date(2020, 5, 1),
        skills=(
            SkillFixture("Recruitment", "recruitment", 5, "Thiết kế quy trình tuyển dụng theo năng lực."),
            SkillFixture("Communication", "communication", 5, "Điều phối workshop và phản hồi đa phòng ban."),
            SkillFixture("Figma", "figma", 4, "Dùng prototype để kiểm chứng hành trình nhân viên."),
            SkillFixture("Accessibility", "accessibility", 4, "Thiết kế nội dung và quy trình dễ tiếp cận."),
            SkillFixture("UX Research", "ux research", 4, "Phỏng vấn nhân viên và tổng hợp pain point."),
        ),
        project=ProjectFixture(
            name="Employee Growth Journey",
            role="People Experience Lead",
            domain="Employee Experience",
            tech_stack=("Figma", "Design System"),
            description="Thiết kế hành trình hồ sơ năng lực và lộ trình phát triển cùng Milo.",
            contribution="Dẫn dắt discovery, prototype và usability test với nhân viên.",
            start_date=date(2024, 3, 1),
        ),
    ),
    ProfileFixture(
        email="bod@acme.dev",
        role=Role.BOD,
        experience_title="Transformation Director",
        experience="10 năm dẫn dắt chương trình chuyển đổi và xây đội ngũ sản phẩm đa chức năng.",
        experience_start=date(2016, 2, 1),
        skills=(
            SkillFixture("Leadership", "leadership", 5, "Dẫn dắt đội ngũ đa chức năng và phát triển lãnh đạo kế cận."),
            SkillFixture("Strategic Planning", "strategic planning", 5, "Xây chiến lược và phân bổ nguồn lực theo quý."),
            SkillFixture("Program Management", "program management", 5, "Điều hành chương trình chuyển đổi nhiều phòng ban."),
            SkillFixture("Technical Leadership", "technical leadership", 4, "Review quyết định kiến trúc và rủi ro delivery."),
        ),
        project=ProjectFixture(
            name="Workforce Transformation",
            role="Executive Sponsor",
            domain="Organization Development",
            tech_stack=("People Analytics", "Portfolio Management"),
            description="Chuyển đổi mô hình năng lực và điều phối nguồn lực cho các sáng kiến chiến lược.",
            contribution="Chốt governance, ngân sách và tiêu chí đo hiệu quả chương trình.",
            start_date=date(2023, 1, 1),
        ),
    ),
    ProfileFixture(
        email="alex@northstar.dev",
        role=Role.EMPLOYEE,
        experience_title="Backend AI Engineer",
        experience="5 năm phát triển backend Python và 2 năm triển khai ứng dụng RAG có kiểm chứng.",
        experience_start=date(2021, 6, 1),
        skills=(
            SkillFixture("Python", "python", 5, "Phát triển backend và pipeline xử lý dữ liệu."),
            SkillFixture("FastAPI", "fastapi", 5, "Thiết kế API bất đồng bộ, validation và OpenAPI."),
            SkillFixture("PostgreSQL", "postgresql", 5, "Tối ưu truy vấn, index và migration an toàn."),
            SkillFixture("RAG", "rag", 4, "Thiết kế retrieval có tenant scope và evidence grounding."),
            SkillFixture("Docker", "docker", 4, "Đóng gói dịch vụ và môi trường phát triển."),
        ),
        project=ProjectFixture(
            name="Northstar Talent API",
            role="Backend AI Engineer",
            domain="HR Technology",
            tech_stack=("Python", "FastAPI", "PostgreSQL", "RAG", "Docker"),
            description="Xây API tìm kiếm hồ sơ năng lực theo quyền truy cập và bằng chứng có cấu trúc.",
            contribution="Thiết kế retrieval, schema output và deterministic fallback.",
            start_date=date(2024, 7, 1),
        ),
    ),
    ProfileFixture(
        email="hr@northstar.dev",
        role=Role.HR,
        experience_title="People Analytics Manager",
        experience="7 năm vận hành tuyển dụng và phân tích năng lực tổ chức.",
        experience_start=date(2019, 4, 1),
        skills=(
            SkillFixture("Recruitment", "recruitment", 5, "Xây talent pipeline theo vai trò và năng lực."),
            SkillFixture("Communication", "communication", 5, "Điều phối stakeholder và truyền thông thay đổi."),
            SkillFixture("People Analytics", "people analytics", 4, "Phân tích khoảng cách năng lực và nhu cầu nguồn lực."),
            SkillFixture("Accessibility", "accessibility", 4, "Rà soát trải nghiệm nhân viên đa dạng."),
        ),
        project=ProjectFixture(
            name="Capability Marketplace",
            role="People Analytics Lead",
            domain="Internal Mobility",
            tech_stack=("People Analytics", "Skills Taxonomy"),
            description="Xây bản đồ năng lực phục vụ luân chuyển nhân sự nội bộ.",
            contribution="Thiết kế taxonomy, tiêu chí bằng chứng và dashboard theo dõi.",
            start_date=date(2024, 2, 1),
        ),
    ),
    ProfileFixture(
        email="bod@northstar.dev",
        role=Role.BOD,
        experience_title="Strategy Director",
        experience="11 năm hoạch định chiến lược và quản trị danh mục chương trình dữ liệu.",
        experience_start=date(2015, 3, 1),
        skills=(
            SkillFixture("Leadership", "leadership", 5, "Phát triển đội ngũ lãnh đạo và cơ chế ra quyết định."),
            SkillFixture("Strategic Planning", "strategic planning", 5, "Xây chiến lược tăng trưởng theo danh mục."),
            SkillFixture("Data Leadership", "data leadership", 4, "Thiết lập governance và chất lượng dữ liệu."),
            SkillFixture("Program Management", "program management", 5, "Điều hành chương trình nhiều workstream."),
        ),
        project=ProjectFixture(
            name="Workforce Analytics Program",
            role="Executive Sponsor",
            domain="People Analytics",
            tech_stack=("Data Governance", "Portfolio Management"),
            description="Xây nền tảng phân tích nguồn lực cho quyết định đầu tư và tuyển dụng.",
            contribution="Chốt operating model, governance và tiêu chí thành công.",
            start_date=date(2023, 5, 1),
        ),
    ),
)


async def _remove_legacy_generated_people(db: AsyncSession, company_id: uuid.UUID) -> None:
    legacy_ids = tuple(fixture_id(f"user:{key}") for key in LEGACY_GENERATED_KEYS)
    user_ids = tuple(
        await db.scalars(
            select(User.id).where(
                User.company_id == company_id,
                User.id.in_(legacy_ids),
                User.email.in_(LEGACY_GENERATED_EMAILS),
            )
        )
    )
    if not user_ids:
        return
    for model in (Project, Experience, EmployeeSkill, Employment):
        await db.execute(delete(model).where(model.user_id.in_(user_ids)))
    await db.execute(delete(CompanyMembership).where(CompanyMembership.user_id.in_(user_ids)))
    await db.execute(delete(User).where(User.id.in_(user_ids)))


async def _ensure_profile_evidence(
    db: AsyncSession,
    user: User,
    fixture: ProfileFixture,
    company: Company,
    creator: User,
) -> None:
    if user.role != fixture.role or user.company_id != company.id:
        raise RuntimeError("People Search fixture target has an unexpected role or tenant")
    employment = await db.scalar(
        select(Employment).where(
            Employment.user_id == user.id,
            Employment.company_id == user.company_id,
        )
    )
    if employment is None:
        raise RuntimeError("People Search fixture target has no employment")

    experience_id = fixture_id(f"experience:{fixture.email}")
    experience = await db.get(Experience, experience_id)
    if experience is None:
        db.add(
            Experience(
                id=experience_id,
                user_id=user.id,
                company_id=user.company_id,
                employment_id=employment.id,
                title=fixture.experience_title,
                organization=company.name,
                description=fixture.experience,
                start_date=fixture.experience_start,
                source_type=ProfileSourceType.ADMIN,
                created_by=creator.id,
                updated_by=creator.id,
            )
        )
    elif experience.user_id != user.id or experience.company_id != company.id:
        raise RuntimeError("People Search experience belongs to an unexpected user or tenant")
    else:
        experience.organization = company.name

    for skill_fixture in fixture.skills:
        skill = await db.scalar(select(Skill).where(Skill.normalized_key == skill_fixture.key))
        if skill is None:
            skill = Skill(
                id=fixture_id(f"skill:{skill_fixture.key}"),
                name=skill_fixture.name,
                normalized_key=skill_fixture.key,
                category="QC talent catalog",
            )
            db.add(skill)
            await db.flush()
        association = await db.scalar(
            select(EmployeeSkill).where(
                EmployeeSkill.user_id == user.id,
                EmployeeSkill.skill_id == skill.id,
            )
        )
        if association is None:
            db.add(
                EmployeeSkill(
                    id=fixture_id(f"employee-skill:{fixture.email}:{skill_fixture.key}"),
                    user_id=user.id,
                    company_id=user.company_id,
                    skill_id=skill.id,
                    rating=skill_fixture.rating,
                    note=skill_fixture.note,
                    self_assessed=False,
                    source_type=ProfileSourceType.ADMIN,
                    created_by=creator.id,
                    updated_by=creator.id,
                )
            )
        elif association.note == "Synthetic QC self assessment":
            association.rating = skill_fixture.rating
            association.note = skill_fixture.note
            association.self_assessed = False
            association.source_type = ProfileSourceType.ADMIN
            association.created_by = creator.id
            association.updated_by = creator.id

    project_id = fixture_id(f"project:{fixture.email}:{fixture.project.name}")
    if await db.get(Project, project_id) is None:
        db.add(
            Project(
                id=project_id,
                user_id=user.id,
                company_id=user.company_id,
                employment_id=employment.id,
                name=fixture.project.name,
                role=fixture.project.role,
                domain=fixture.project.domain,
                tech_stack=list(fixture.project.tech_stack),
                description=fixture.project.description,
                contribution=fixture.project.contribution,
                start_date=fixture.project.start_date,
                source_type=ProfileSourceType.ADMIN,
                created_by=creator.id,
                updated_by=creator.id,
            )
        )
    await db.flush()


async def seed_people_search_demo(
    db: AsyncSession,
    company: Company,
    creator: User,
    users: list[User],
) -> None:
    """Enrich current personas and remove only the legacy generated-only people."""
    await _remove_legacy_generated_people(db, company.id)
    fixtures = {fixture.email: fixture for fixture in PROFILE_FIXTURES}
    for user in users:
        fixture = fixtures.get(user.email)
        if fixture is not None:
            await _ensure_profile_evidence(db, user, fixture, company, creator)
