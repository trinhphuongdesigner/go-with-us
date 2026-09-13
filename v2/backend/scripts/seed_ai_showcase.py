"""Add-only evidence for the short assessment-to-AI showcase."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.enums import EmploymentStatus, ProfileSourceType
from app.domain.models import Company, Employment, Project, User
from app.talent_workflows.models import Assessment, AssessmentCycle, AssessmentTemplate
from app.talent_workflows.schemas import TemplateRead
from app.talent_workflows.service import score

NAMESPACE = uuid.UUID("25cf6384-da89-4950-ae3a-26c40ea3483b")
FIXTURE_TIME = datetime(2026, 9, 10, 9, tzinfo=UTC)


def fixture_id(key: str) -> uuid.UUID:
    return uuid.uuid5(NAMESPACE, f"ai-showcase:{key}")


async def seed_ai_showcase(
    db: AsyncSession,
    *,
    company: Company,
    employee: User,
    peer_reviewer: User,
    manager_reviewer: User,
    approver: User,
) -> None:
    """Seed a project plus approved peer/manager reviews without replacing QC edits."""
    participants = (employee, peer_reviewer, manager_reviewer, approver)
    if any(person.company_id != company.id for person in participants):
        raise RuntimeError("AI showcase participants must belong to the same company")

    employment = await db.scalar(
        select(Employment).where(
            Employment.user_id == employee.id,
            Employment.company_id == company.id,
            Employment.status == EmploymentStatus.ACTIVE,
        )
    )
    cycle = await db.scalar(
        select(AssessmentCycle)
        .where(AssessmentCycle.company_id == company.id)
        .order_by(AssessmentCycle.period.desc())
        .limit(1)
    )
    if employment is None or cycle is None:
        raise RuntimeError("AI showcase requires an active employment and assessment cycle")
    template = await db.get(AssessmentTemplate, cycle.template_id)
    if template is None or template.company_id != company.id:
        raise RuntimeError("AI showcase assessment cycle has no valid company template")

    project_id = fixture_id(f"project:{employee.id}")
    project = await db.get(Project, project_id)
    if project is None:
        project = await db.scalar(
            select(Project).where(
                Project.user_id == employee.id,
                Project.company_id == company.id,
                Project.name == "CareerMate Assessment Experience",
            )
        )
    if project is None:
        db.add(
            Project(
                id=project_id,
                user_id=employee.id,
                company_id=company.id,
                employment_id=employment.id,
                name="CareerMate Assessment Experience",
                role="Frontend Owner",
                domain="HR Technology",
                description="Thiết kế lại trải nghiệm đánh giá để nhân viên hoàn thành nhanh và ít lỗi hơn.",
                tech_stack=["React", "TypeScript", "Playwright"],
                contribution="Rút ngắn 30% thời gian hoàn thành phiếu và giảm 25% lỗi nhập liệu trong đợt thử nghiệm nội bộ.",
                start_date=date(2026, 6, 1),
                source_type=ProfileSourceType.ADMIN,
                created_by=approver.id,
                updated_by=approver.id,
            )
        )

    snapshot = TemplateRead.model_validate(template).model_dump(mode="json", by_alias=True)
    question_ids = [
        question["id"] for group in snapshot["groups"] for question in group["questions"]
    ]
    max_scores = {
        question["id"]: question["maxScore"]
        for group in snapshot["groups"]
        for question in group["questions"]
    }
    fixtures = (
        (
            "PEER",
            peer_reviewer,
            (9, 8, 9, 8),
            "Phối hợp chủ động, chia sẻ component pattern và hỗ trợ đồng đội xử lý tình huống khó.",
            "Đồng nghiệp xác nhận đóng góp có tác động rõ; tiếp tục chia sẻ kiến thức theo lịch cố định.",
        ),
        (
            "MANAGER",
            manager_reviewer,
            (8, 9, 8, 9),
            "Hoàn thành vai trò frontend owner, cải thiện tốc độ hoàn thành phiếu và chất lượng nhập liệu.",
            "Quản lý xác nhận kết quả dự án và đề nghị phát triển thêm năng lực dẫn dắt kỹ thuật.",
        ),
    )
    for assessment_type, reviewer, values, highlights, review_comment in fixtures:
        assessment_id = fixture_id(f"assessment:{employee.id}:{assessment_type}")
        existing = await db.get(Assessment, assessment_id)
        if existing is not None:
            if existing.company_id != company.id or existing.reviewee_id != employee.id:
                raise RuntimeError("AI showcase assessment belongs to an unexpected scope")
            continue
        answers = [
            {
                "questionId": question_id,
                "score": min(max_scores[question_id], values[index % len(values)]),
                "comment": "Minh chứng tổng hợp phục vụ demo AI; không mô tả nhân sự thật.",
            }
            for index, question_id in enumerate(question_ids)
        ]
        db.add(
            Assessment(
                id=assessment_id,
                company_id=company.id,
                cycle_id=cycle.id,
                reviewee_id=employee.id,
                reviewer_id=reviewer.id,
                employment_id=employment.id,
                type=assessment_type,
                status="APPROVED",
                template_snapshot=snapshot,
                answers=answers,
                mood="Tích cực",
                highlights=highlights,
                comment="Dữ liệu tổng hợp để trình diễn luồng đánh giá đa chiều.",
                review_comment=review_comment,
                submitted_at=FIXTURE_TIME,
                approved_at=FIXTURE_TIME,
                approved_by_id=approver.id,
                **score(snapshot, answers, True),
            )
        )
    await db.flush()
