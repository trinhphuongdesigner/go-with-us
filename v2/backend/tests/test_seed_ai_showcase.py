import importlib
import uuid
from datetime import UTC, date, datetime

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.enums import EmploymentStatus, Role
from app.domain.models import Company, Employment, Project, User
from app.talent_workflows.models import Assessment, AssessmentCycle, AssessmentTemplate
from app.talent_workflows.service import career_context


def identifier(value: str) -> uuid.UUID:
    return uuid.uuid5(uuid.NAMESPACE_URL, f"careermate-test:{value}")


@pytest.mark.asyncio
async def test_ai_showcase_seed_is_idempotent_and_supplies_approved_evidence(
    db_session: AsyncSession,
) -> None:
    company = Company(id=identifier("company"), name="Acme Demo Corp")
    db_session.add(company)
    await db_session.flush()

    employee = User(
        id=identifier("employee"),
        email="alice@acme.dev",
        name="QC Alice",
        job_title="Software Engineer",
        hashed_password="synthetic-test-hash",
        role=Role.EMPLOYEE,
        company_id=company.id,
        admin_permissions=[],
        is_active=True,
    )
    peer = User(
        id=identifier("peer"),
        email="hr@acme.dev",
        name="QC People Partner",
        job_title="HR Manager",
        hashed_password="synthetic-test-hash",
        role=Role.HR,
        company_id=company.id,
        admin_permissions=[],
        is_active=True,
    )
    manager = User(
        id=identifier("manager"),
        email="bod@acme.dev",
        name="QC Director",
        job_title="Director",
        hashed_password="synthetic-test-hash",
        role=Role.BOD,
        company_id=company.id,
        admin_permissions=[],
        is_active=True,
    )
    db_session.add_all([employee, peer, manager])
    await db_session.flush()

    employment = Employment(
        id=identifier("employment"),
        user_id=employee.id,
        company_id=company.id,
        title="Software Engineer",
        start_date=datetime(2024, 1, 1, tzinfo=UTC),
        status=EmploymentStatus.ACTIVE,
    )
    template = AssessmentTemplate(
        id=identifier("template"),
        company_id=company.id,
        created_by_id=peer.id,
        family_id=identifier("template-family"),
        name="Khung đánh giá demo AI",
        description="Synthetic test template",
        status="ACTIVE",
        groups=[
            {
                "id": str(identifier("group-contribution")),
                "name": "Đóng góp",
                "weight": 60,
                "scoreDimension": "CONTRIBUTION",
                "questions": [
                    {
                        "id": str(identifier("question-delivery")),
                        "text": "Hoàn thành mục tiêu",
                        "guidance": "",
                        "weight": 100,
                        "maxScore": 10,
                    }
                ],
            },
            {
                "id": str(identifier("group-attitude")),
                "name": "Thái độ",
                "weight": 40,
                "scoreDimension": "ATTITUDE",
                "questions": [
                    {
                        "id": str(identifier("question-collaboration")),
                        "text": "Hợp tác cùng đội ngũ",
                        "guidance": "",
                        "weight": 100,
                        "maxScore": 10,
                    }
                ],
            },
        ],
    )
    db_session.add_all([employment, template])
    await db_session.flush()
    cycle = AssessmentCycle(
        id=identifier("cycle"),
        company_id=company.id,
        template_id=template.id,
        name="Chu kỳ demo AI",
        period="2026-09",
        due_date=date(2026, 12, 31),
        status="OPEN",
    )
    db_session.add(cycle)
    await db_session.commit()

    seed_module = importlib.import_module("scripts.seed_ai_showcase")
    for _ in range(2):
        await seed_module.seed_ai_showcase(
            db_session,
            company=company,
            employee=employee,
            peer_reviewer=peer,
            manager_reviewer=manager,
            approver=manager,
        )
        await db_session.commit()

    project_count = await db_session.scalar(
        select(func.count(Project.id)).where(Project.user_id == employee.id)
    )
    assessments = (
        await db_session.scalars(
            select(Assessment)
            .where(Assessment.reviewee_id == employee.id)
            .order_by(Assessment.type)
        )
    ).all()
    context = await career_context(db_session, employee)

    assert project_count == 1
    assert [(row.type, row.status) for row in assessments] == [
        ("MANAGER", "APPROVED"),
        ("PEER", "APPROVED"),
    ]
    assert all(row.total_score is not None for row in assessments)
    assert len(context["assessments"]) == 2
    assert context["projects"] == [
        {
            "name": "CareerMate Assessment Experience",
            "role": "Frontend Owner",
            "contribution": "Rút ngắn 30% thời gian hoàn thành phiếu và giảm 25% lỗi nhập liệu trong đợt thử nghiệm nội bộ.",
        }
    ]
