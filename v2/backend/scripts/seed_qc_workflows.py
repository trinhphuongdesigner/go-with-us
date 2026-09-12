"""Add-only synthetic fixtures; called inside seed_qc's guarded transaction."""

import hashlib
import json
import os
import uuid
from datetime import UTC, date, datetime
from urllib.parse import urlsplit

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.career_ai.models import AiConnection, CareerGoal
from app.career_ai.provider import DEFAULTS, PROVIDERS, cipher
from app.domain.enums import AwardType, EmploymentStatus, ProfileSourceType, Role
from app.domain.models import Award, Company, Employment, User
from app.domain.roadmap_models import DevelopmentMilestone, DevelopmentRoadmap
from app.profile_extensions.models import CompetencyRequest, PersonalDetails, ProfileActivityLog
from app.profile_extensions.schemas import RequestCreate
from app.talent_workflows.models import Assessment, AssessmentCycle, AssessmentTemplate, CareerSummary, JobRequirement
from app.talent_workflows.schemas import TemplateInput, TemplateRead
from app.talent_workflows.service import score

NAMESPACE = uuid.UUID("65a6a9f5-dc81-43b3-8d21-34f07602cf01")
FIXTURE_DATE = date(2026, 9, 1)
FIXTURE_TIME = datetime(2026, 9, 1, 9, tzinfo=UTC)


def fixture_id(key: str) -> uuid.UUID:
    return uuid.uuid5(NAMESPACE, f"qc-workflows:{key}")


async def seed_ai_connection(db: AsyncSession) -> None:
    """Persist an explicitly supplied provider key once; never replace saved settings."""
    key = os.environ.get("CAREERMATE_AI_API_KEY", "").strip()
    if not key:
        return
    provider = os.environ.get("CAREERMATE_AI_PROVIDER", "ANTHROPIC").strip().upper()
    if provider not in PROVIDERS:
        raise RuntimeError("QC AI provider is unsupported")
    if await db.get(AiConnection, provider) is not None:
        return
    base = os.environ.get("CAREERMATE_AI_BASE_URL", "").strip() or DEFAULTS[provider][0]
    model = os.environ.get("CAREERMATE_AI_MODEL", "").strip() or DEFAULTS[provider][1]
    parsed = urlsplit(base)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment or len(base) > 500 or len(model) > 150:
        raise RuntimeError("QC AI endpoint or model is invalid")
    db.add(AiConnection(provider=provider, encrypted_key=cipher().encrypt(key.encode()).decode(), base_url=base.rstrip("/"), model=model))
    await db.flush()


async def add_profile_fixtures(db: AsyncSession, user: User, recipient: User | None) -> None:
    if await db.get(PersonalDetails, user.id) is None:
        db.add(PersonalDetails(user_id=user.id, details={
            "dateOfBirth": "2000-01-01", "gender": "QC synthetic",
            "idNumber": "QC-NOT-A-REAL-ID", "emergencyContactName": "QC synthetic contact",
            "onboardDate": "2026-01-05", "contributionAdjustment": 0,
        }))
    activity_id = fixture_id(f"activity:{user.id}")
    if await db.get(ProfileActivityLog, activity_id) is None:
        db.add(ProfileActivityLog(id=activity_id, owner_user_id=user.id, company_id=user.company_id,
            title="QC: Chia sẻ kiến thức cùng đội ngũ", description="Hoạt động tổng hợp phục vụ kiểm tra giao diện và quyền; không phải thành tích thật.",
            category="KNOWLEDGE_SHARING", date=FIXTURE_DATE))
    employment = await db.scalar(select(Employment).where(Employment.user_id == user.id, Employment.company_id == user.company_id, Employment.status == EmploymentStatus.ACTIVE))
    if employment is None or recipient is None or recipient.id == user.id or recipient.role != Role.HR:
        await db.flush()
        return
    for state in ("PENDING", "APPROVED"):
        award_id = fixture_id(f"award:{user.id}:{state}")
        award = await db.get(Award, award_id)
        if award is None:
            award = Award(id=award_id, user_id=user.id, company_id=user.company_id,
                name=f"QC: Ghi nhận đóng góp ({state})", type=AwardType.WORK,
                issuer="QC synthetic organization", description="Dữ liệu giả lập để kiểm tra quy trình xác nhận, không phải danh hiệu thật.",
                awarded_at=FIXTURE_DATE, self_reported=True, source_type=ProfileSourceType.SELF,
                created_by=user.id, updated_by=user.id)
            db.add(award)
            await db.flush()
        request_id = fixture_id(f"request:{user.id}:{state}")
        if await db.get(CompetencyRequest, request_id) is not None:
            continue
        client_id = fixture_id(f"request-client:{user.id}:{state}")
        existing = await db.scalar(select(CompetencyRequest.id).where(CompetencyRequest.sender_id == user.id, CompetencyRequest.client_request_id == client_id))
        if existing:
            continue
        payload = RequestCreate(sourceType="AWARD", sourceId=award.id, employmentId=employment.id,
            recipientUserId=recipient.id, clientRequestId=client_id, message="QC: Nhờ HR xác nhận đóng góp tổng hợp.")
        snapshot = {"name": award.name, "issuer": award.issuer, "description": award.description,
            "awardedAt": award.awarded_at.isoformat() if award.awarded_at else None,
            "evidenceUrl": award.evidence_url}
        db.add(CompetencyRequest(id=request_id, sender_id=user.id, recipient_id=recipient.id,
            company_id=user.company_id, employment_id=employment.id, source_type="AWARD", source_id=award.id,
            source_snapshot=snapshot, client_request_id=client_id,
            request_hash=hashlib.sha256(json.dumps(payload.model_dump(mode="json"), sort_keys=True).encode()).hexdigest(),
            message=payload.message, status=state, points_awarded=20 if state == "APPROVED" else 0,
            review_note="QC: Đã xác nhận dữ liệu tổng hợp." if state == "APPROVED" else None,
            reviewed_at=FIXTURE_TIME if state == "APPROVED" else None))
    await db.flush()


async def add_roadmap_goals(db: AsyncSession, user: User) -> None:
    roadmaps = (await db.scalars(select(DevelopmentRoadmap).where(
        DevelopmentRoadmap.owner_user_id == user.id, DevelopmentRoadmap.company_id == user.company_id,
    ).options(selectinload(DevelopmentRoadmap.milestones).selectinload(DevelopmentMilestone.tasks)))).all()
    for roadmap in roadmaps:
        identifier = fixture_id(f"goal:{roadmap.id}")
        if await db.get(CareerGoal, identifier) is not None or await db.scalar(select(CareerGoal.id).where(CareerGoal.roadmap_id == roadmap.id)):
            continue
        if not roadmap.milestones:
            continue
        last = roadmap.milestones[-1]
        completed = sum(task.done for task in last.tasks)
        progress = round(100 * completed / len(last.tasks)) if last.tasks else 0
        db.add(CareerGoal(id=identifier, owner_user_id=user.id, company_id=user.company_id,
            roadmap_id=roadmap.id, category=roadmap.category, title=last.title,
            description=last.description, due_date=last.due_date, progress=progress,
            status="ACHIEVED" if progress == 100 else "IN_PROGRESS" if progress else "NOT_STARTED",
            ai_suggested=False))
    await db.flush()


async def seed_company_workflows(db: AsyncSession, company: Company, personas: list[User]) -> None:
    """Preserve every existing row, including edits and lifecycle transitions."""
    workforce = [user for user in personas if user.company_id == company.id and user.role in {Role.EMPLOYEE, Role.HR, Role.BOD}]
    hr = next((user for user in workforce if user.role == Role.HR and user.is_active), None)
    approvers = [user for user in personas if user.company_id == company.id and user.role in {Role.COMPANY_ADMIN, Role.BOD} and user.is_active]
    creator = hr or (approvers[0] if approvers else None)
    for user in workforce:
        await add_profile_fixtures(db, user, hr)
        await add_roadmap_goals(db, user)
    if creator is None:
        return

    template_id = fixture_id(f"template:{company.id}")
    template = await db.get(AssessmentTemplate, template_id)
    if template is None:
        payload = TemplateInput(name="QC: Khung đánh giá phát triển", description="Mẫu tổng hợp phục vụ QC các vai trò, không phải thang đánh giá chính thức.", groups=[
            {"id": str(fixture_id(f"group:{company.id}:contribution")), "name": "Đóng góp", "weight": 60,
                "scoreDimension": "CONTRIBUTION", "questions": [
                    {"id": str(fixture_id(f"question:{company.id}:delivery")), "text": "Hoàn thành mục tiêu", "guidance": "Dùng minh chứng đã thống nhất trong kỳ.", "weight": 60, "maxScore": 10},
                    {"id": str(fixture_id(f"question:{company.id}:quality")), "text": "Chất lượng công việc", "weight": 40, "maxScore": 10},
                ]},
            {"id": str(fixture_id(f"group:{company.id}:attitude")), "name": "Thái độ", "weight": 40,
                "scoreDimension": "ATTITUDE", "questions": [
                    {"id": str(fixture_id(f"question:{company.id}:collaboration")), "text": "Hợp tác cùng đội ngũ", "weight": 50, "maxScore": 10},
                    {"id": str(fixture_id(f"question:{company.id}:learning")), "text": "Chủ động học hỏi", "weight": 50, "maxScore": 10},
                ]},
        ])
        template = AssessmentTemplate(id=template_id, company_id=company.id, created_by_id=creator.id,
            family_id=fixture_id(f"template-family:{company.id}"), name=payload.name,
            description=payload.description, groups=[group.model_dump(by_alias=True) for group in payload.groups], status="ACTIVE")
        db.add(template)
        await db.flush()
    cycle_id = fixture_id(f"cycle:{company.id}")
    cycle = await db.get(AssessmentCycle, cycle_id)
    if cycle is None:
        # Do not overwrite or reopen a cycle that QC has edited; reuse a month collision as-is.
        cycle = await db.scalar(select(AssessmentCycle).where(AssessmentCycle.company_id == company.id, AssessmentCycle.period == "2026-09"))
    if cycle is None:
        cycle = AssessmentCycle(id=cycle_id, company_id=company.id, template_id=template.id,
            name="QC: Chu kỳ phát triển tháng 09/2026", period="2026-09", due_date=date(2026, 12, 31), status="OPEN")
        db.add(cycle)
        await db.flush()
    pinned = await db.get(AssessmentTemplate, cycle.template_id)
    if pinned is None:
        return
    snapshot = TemplateRead.model_validate(pinned).model_dump(mode="json", by_alias=True)
    for user in workforce:
        employment = await db.scalar(select(Employment).where(Employment.user_id == user.id, Employment.company_id == company.id).order_by(Employment.start_date.desc()))
        approver = next((p for p in approvers if p.id != user.id), None)
        answers = [{"questionId": q["id"], "score": max(1, min(q["maxScore"], round(q["maxScore"] * 0.8))), "comment": "QC: Minh chứng tổng hợp, không mô tả nhân sự thật."} for group in snapshot["groups"] for q in group["questions"]]
        for state in ("DRAFT", "SUBMITTED", "APPROVED"):
            identifier = fixture_id(f"assessment:{user.id}:{state}")
            if await db.get(Assessment, identifier) is not None or (state == "APPROVED" and approver is None):
                continue
            scores = score(snapshot, answers, True) if state != "DRAFT" else {"total_score": None, "contribution_score": None, "attitude_score": None}
            db.add(Assessment(id=identifier, company_id=company.id, cycle_id=cycle.id,
                reviewee_id=user.id, reviewer_id=user.id, employment_id=employment.id if employment else None,
                type="SELF", status=state, template_snapshot=snapshot, answers=answers[:1] if state == "DRAFT" else answers,
                mood="Tốt", highlights="QC: Đã hoàn thành buổi chia sẻ kiến thức tổng hợp.",
                comment="Dữ liệu giả lập để kiểm tra luồng đánh giá.",
                review_comment="QC: Đã xác nhận mẫu tổng hợp." if state == "APPROVED" else "",
                submitted_at=FIXTURE_TIME if state != "DRAFT" else None,
                approved_at=FIXTURE_TIME if state == "APPROVED" else None,
                approved_by_id=approver.id if state == "APPROVED" and approver else None, **scores))
        await db.flush()
        for state in ("DRAFT", "APPROVED"):
            identifier = fixture_id(f"summary:{user.id}:{state}")
            if await db.get(CareerSummary, identifier) is not None or (state == "APPROVED" and approver is None):
                continue
            content = "QC: Hồ sơ minh họa quá trình học hỏi và hợp tác. Toàn bộ thông tin và đánh giá trong bản này là dữ liệu tổng hợp để kiểm tra sản phẩm."
            public_snapshot = {"name": user.name, "jobTitle": user.job_title, "content": content,
                "strengths": ["QC: Hợp tác", "QC: Chủ động học hỏi"], "growthAreas": ["QC: Tiếp tục thực hành"],
                "evaluation": "", "dimensionScores": {}, "assessments": [], "skills": [], "approvedAt": FIXTURE_TIME.isoformat()}
            db.add(CareerSummary(id=identifier, owner_user_id=user.id, company_id=company.id,
                employment_id=employment.id if employment else None, source="PERSONAL", status=state,
                content=content, strengths=public_snapshot["strengths"], growth_areas=public_snapshot["growthAreas"],
                approved_at=FIXTURE_TIME if state == "APPROVED" else None,
                approved_by_id=approver.id if state == "APPROVED" and approver else None,
                snapshot=public_snapshot if state == "APPROVED" else {}))
        # A separate ungenerated request exercises the real AI offboarding trigger.
        if employment:
            identifier = fixture_id(f"offboarding:{user.id}")
            if await db.get(CareerSummary, identifier) is None:
                db.add(CareerSummary(id=identifier, owner_user_id=user.id, company_id=company.id,
                    employment_id=employment.id, source="ORGANIZATION_OFFBOARDING", status="DRAFT"))
    requirement_id = fixture_id(f"requirement:{company.id}")
    if await db.get(JobRequirement, requirement_id) is None:
        db.add(JobRequirement(id=requirement_id, company_id=company.id, created_by_id=creator.id,
            title="QC: Phát triển nền tảng nội bộ", description="Nhu cầu tổng hợp để đối chiếu kỹ năng đội ngũ; không phải tin tuyển dụng thật.",
            required_skills=["Python", "React", "Communication"], status="open"))
    # No share tokens: QC owners deliberately create links from approved synthetic snapshots.
    await db.flush()
