import json
import math
import re
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.company_memberships import resolve_company_scope
from app.domain.enums import Permission, Role
from app.domain.models import Company, EmployeeSkill, Employment, Project, Skill, User
from app.security.permissions import effective_permissions
from app.security.roles import can_manage_role
from app.talent_workflows.models import Assessment, CareerSummary
from app.talent_workflows.schemas import AssessmentRead, SummaryRead


def permit(actor: User, permission: Permission) -> None:
    if permission not in effective_permissions(actor):
        raise HTTPException(403, "Bạn không có quyền thực hiện thao tác này")


async def company_scope(
    db: AsyncSession, actor: User, requested: uuid.UUID | None = None
) -> uuid.UUID:
    scope = await resolve_company_scope(db, actor, requested)
    assert scope is not None  # This package always requires a concrete selected tenant.
    return scope


def primary_company(actor: User, company_id: uuid.UUID) -> None:
    """Membership access does not grant another company's management authority."""
    if actor.role != Role.SUPER_ADMIN and actor.company_id != company_id:
        raise HTTPException(403, "Thao tác này chỉ dành cho công ty quản lý chính của bạn")


async def manage(db: AsyncSession, actor: User, company_id: uuid.UUID, action: str) -> None:
    await company_scope(db, actor, company_id)
    if action != "requirements":
        primary_company(actor, company_id)
    allowed = {
        "templates": (
            {Role.HR, Role.COMPANY_ADMIN, Role.SUPER_ADMIN},
            Permission.ASSESSMENT_REVIEW,
        ),
        "approve": ({Role.BOD, Role.COMPANY_ADMIN, Role.SUPER_ADMIN}, Permission.ASSESSMENT_REVIEW),
        "passport": ({Role.BOD, Role.COMPANY_ADMIN, Role.SUPER_ADMIN}, Permission.PASSPORT_APPROVE),
        "narrative": ({Role.HR, Role.COMPANY_ADMIN, Role.SUPER_ADMIN}, Permission.PASSPORT_APPROVE),
        "requirements": (
            {Role.HR, Role.BOD, Role.COMPANY_ADMIN, Role.SUPER_ADMIN},
            Permission.PEOPLE_WRITE,
        ),
    }
    roles, permission = allowed[action]
    if actor.role not in roles:
        raise HTTPException(403, "Vai trò hiện tại không thực hiện được thao tác này")
    permit(actor, permission)


def version_check(row: Any, expected: int) -> None:
    if row.version != expected:
        raise HTTPException(409, "Dữ liệu đã thay đổi. Tải lại trước khi lưu.")


async def scoped_row(
    db: AsyncSession, model: Any, identifier: uuid.UUID, actor: User, lock: bool = False
) -> Any:
    query = select(model).where(model.id == identifier)
    if lock:
        query = query.with_for_update()
    row = await db.scalar(query)
    if row is None:
        raise HTTPException(404, "Không tìm thấy bản ghi")
    await company_scope(db, actor, row.company_id)
    return row


async def person(db: AsyncSession, actor: User, identifier: uuid.UUID | None = None) -> User:
    user = await db.get(User, identifier or actor.id)
    if user is None or user.company_id is None:
        raise HTTPException(404, "Không tìm thấy hồ sơ")
    await company_scope(db, actor, user.company_id)
    if user.id != actor.id:
        primary_company(actor, user.company_id)
        if not can_manage_role(actor.role, user.role):
            raise HTTPException(403, "Không có quyền xem hồ sơ của vai trò này")
        permit(actor, Permission.PEOPLE_READ)
    else:
        permit(actor, Permission.PROFILE_SELF)
    return user


async def assessment_read(db: AsyncSession, row: Assessment) -> AssessmentRead:
    values = {
        field: getattr(row, field)
        for field in AssessmentRead.model_fields
        if field not in {"reviewee_name", "reviewer_name"}
    }
    reviewee = await db.get(User, row.reviewee_id)
    reviewer = await db.get(User, row.reviewer_id)
    return AssessmentRead.model_validate(
        {
            **values,
            "reviewee_name": reviewee.name if reviewee else "",
            "reviewer_name": reviewer.name if reviewer else "",
        }
    )


async def summary_read(db: AsyncSession, row: CareerSummary) -> SummaryRead:
    values = {
        field: getattr(row, field) for field in SummaryRead.model_fields if field != "owner_name"
    }
    owner = await db.get(User, row.owner_user_id)
    return SummaryRead.model_validate({**values, "owner_name": owner.name if owner else ""})


def score(
    snapshot: dict[str, Any], answers: list[dict[str, Any]], complete: bool = False
) -> dict[str, float | None]:
    questions = {q["id"]: q for group in snapshot["groups"] for q in group["questions"]}
    answered: dict[str, int] = {}
    for answer in answers:
        identifier = answer["questionId"]
        value = answer["score"]
        if (
            identifier not in questions
            or identifier in answered
            or isinstance(value, bool)
            or not isinstance(value, int)
            or not 1 <= value <= questions[identifier]["maxScore"]
        ):
            raise HTTPException(
                422, "Điểm phải nằm trong thang điểm và mỗi tiêu chí chỉ có một câu trả lời"
            )
        answered[identifier] = value
    groups = []
    for group in snapshot["groups"]:
        if (
            complete
            and group["weight"] > 0
            and any(q["weight"] > 0 and q["id"] not in answered for q in group["questions"])
        ):
            raise HTTPException(422, "Hoàn thành các tiêu chí có trọng số trước khi gửi")
        weight = sum(q["weight"] for q in group["questions"])
        value = sum(
            answered.get(q["id"], 0) / q["maxScore"] * 10 * q["weight"] for q in group["questions"]
        )
        if weight > 0 and group["weight"] > 0:
            groups.append((group["scoreDimension"], group["weight"], value / weight))

    def average(dimension: str | None = None) -> float | None:
        selected = [g for g in groups if dimension is None or g[0] == dimension]
        weight = sum(g[1] for g in selected)
        return (
            math.floor(sum(g[1] * g[2] for g in selected) / weight * 100 + 0.5) / 100
            if weight
            else None
        )

    if complete and average() is None:
        raise HTTPException(422, "Mẫu đánh giá chưa có trọng số hợp lệ")
    return {
        "total_score": average(),
        "contribution_score": average("CONTRIBUTION"),
        "attitude_score": average("ATTITUDE"),
    }


async def career_context(
    db: AsyncSession, user: User, employment_id: uuid.UUID | None = None
) -> dict[str, Any]:
    if employment_id:
        employment = await db.get(Employment, employment_id)
        if (
            not employment
            or employment.user_id != user.id
            or employment.company_id != user.company_id
        ):
            raise HTTPException(404, "Không tìm thấy quá trình làm việc")
    query = select(Assessment).where(
        Assessment.reviewee_id == user.id,
        Assessment.company_id == user.company_id,
        Assessment.status == "APPROVED",
    )
    projects_query = select(Project).where(
        Project.user_id == user.id, Project.company_id == user.company_id
    )
    if employment_id:
        query = query.where(Assessment.employment_id == employment_id)
        projects_query = projects_query.where(Project.employment_id == employment_id)
    assessments = (await db.scalars(query.order_by(Assessment.approved_at.desc()).limit(100))).all()
    projects = (await db.scalars(projects_query.limit(100))).all()
    skills = (
        await db.execute(
            select(Skill.name, EmployeeSkill.rating)
            .join(EmployeeSkill, EmployeeSkill.skill_id == Skill.id)
            .where(EmployeeSkill.user_id == user.id, EmployeeSkill.company_id == user.company_id)
        )
    ).all()
    return {
        "person": {"name": user.name, "jobTitle": user.job_title},
        "assessments": [
            {
                "type": a.type,
                "totalScore": a.total_score,
                "contributionScore": a.contribution_score,
                "attitudeScore": a.attitude_score,
                "approvedAt": a.approved_at.isoformat() if a.approved_at else None,
            }
            for a in assessments
        ],
        "projects": [
            {"name": p.name, "role": p.role, "contribution": p.contribution} for p in projects
        ],
        "skills": [
            {"name": name, "rating": rating, "source": "self-reported"} for name, rating in skills
        ],
    }


async def redact_text(db: AsyncSession, user: User, value: str) -> str:
    company = await db.get(Company, user.company_id)
    projects = (
        await db.scalars(
            select(Project.name).where(
                Project.user_id == user.id, Project.company_id == user.company_id
            )
        )
    ).all()
    labels = [user.email, *(projects), company.name if company else ""]
    for label in sorted((label for label in labels if label), key=len, reverse=True):
        value = re.sub(re.escape(label), "[Đã ẩn]", value, flags=re.IGNORECASE)
    value = re.sub(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", "[Email đã ẩn]", value)
    return value


async def approved_snapshot(db: AsyncSession, row: CareerSummary) -> dict[str, Any]:
    user = await db.get(User, row.owner_user_id)
    if user is None:
        raise HTTPException(404, "Không tìm thấy hồ sơ")
    context = await career_context(db, user, row.employment_id)
    # Explicit allowlist: no user IDs, email, private comments, draft scores or project names.
    return {
        "name": user.name,
        "jobTitle": user.job_title,
        "content": await redact_text(db, user, row.content),
        "strengths": [await redact_text(db, user, item) for item in row.strengths],
        "growthAreas": [await redact_text(db, user, item) for item in row.growth_areas],
        "evaluation": await redact_text(db, user, row.evaluation),
        "dimensionScores": row.dimension_scores,
        "assessments": context["assessments"],
        "skills": context["skills"],
        "approvedAt": datetime.now(UTC).isoformat(),
    }


async def ai_json(db: AsyncSession, system_prompt: str, context: dict[str, Any]) -> dict[str, Any]:
    from app.career_ai.provider import send_chat

    result = await send_chat(
        db,
        system_prompt=system_prompt,
        messages=[{"role": "user", "content": json.dumps(context, ensure_ascii=False)}],
    )
    try:
        content = str(result["content"]).strip()
        # Extract from code fence if present (```json ... ``` or ``` ... ```)
        fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", content, re.IGNORECASE)
        if fence:
            content = fence.group(1).strip()
        elif content.startswith("```"):
            # Fallback: strip leading/trailing fence markers
            content = re.sub(r"^```(?:json)?\s*", "", content)
            content = re.sub(r"\s*```\s*$", "", content)
        data = json.loads(content)
        if not isinstance(data, dict):
            raise ValueError("Expected object")
        return data
    except (ValueError, KeyError, TypeError, json.JSONDecodeError):
        raise HTTPException(502, "AI trả về dữ liệu không hợp lệ; chưa lưu thay đổi") from None
