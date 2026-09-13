import uuid
from datetime import UTC, datetime

import pytest
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.company_memberships import CompanyMembership
from app.domain.enums import AdminPermission, EmploymentStatus, Role
from app.domain.models import Company, Employment, User
from app.talent_workflows import router as router_module
from app.talent_workflows.models import (
    Assessment,
    AssessmentCycle,
    AssessmentTemplate,
    CareerSummary,
)
from app.talent_workflows.schemas import SummaryEdit, VersionInput
from app.talent_workflows.service import (
    approved_assessment_averages,
    career_context,
    redact_text,
)


def uid(label: str) -> uuid.UUID:
    return uuid.uuid5(uuid.NAMESPACE_URL, f"offboarding-test:{label}")


async def setup_summary(db: AsyncSession, suffix: str) -> tuple[CareerSummary, User, str]:
    company = Company(id=uid(f"company-{suffix}"), name=f"Acme {suffix}")
    employee = User(
        id=uid(f"employee-{suffix}"),
        email=f"employee-{suffix}@example.com",
        name=f"Alice {suffix}",
        hashed_password="test",
        role=Role.EMPLOYEE,
        company_id=company.id,
        admin_permissions=[],
        is_active=True,
    )
    approver = User(
        id=uid(f"approver-{suffix}"),
        email=f"approver-{suffix}@example.com",
        name=f"Approver {suffix}",
        hashed_password="test",
        role=Role.COMPANY_ADMIN,
        company_id=company.id,
        admin_permissions=[AdminPermission.PASSPORT_APPROVE.value],
        is_active=True,
    )
    db.add_all([company, employee, approver])
    await db.flush()
    db.add_all(
        [
            CompanyMembership(user_id=employee.id, company_id=company.id),
            CompanyMembership(user_id=approver.id, company_id=company.id),
        ]
    )
    employment = Employment(
        id=uid(f"employment-{suffix}"),
        user_id=employee.id,
        company_id=company.id,
        title="Engineer",
        start_date=datetime(2025, 1, 1, tzinfo=UTC),
        status=EmploymentStatus.ACTIVE,
    )
    question_id = str(uid(f"question-{suffix}"))
    groups = [
        {
            "id": str(uid(f"group-{suffix}")),
            "name": "Knowledge",
            "description": "",
            "weight": 100,
            "scoreDimension": "CONTRIBUTION",
            "passportDimension": "KNOWLEDGE",
            "questions": [
                {
                    "id": question_id,
                    "text": "Understands the system",
                    "guidance": "",
                    "weight": 100,
                    "maxScore": 10,
                }
            ],
        }
    ]
    template = AssessmentTemplate(
        id=uid(f"template-{suffix}"),
        company_id=company.id,
        created_by_id=approver.id,
        name="Template",
        description="",
        status="ACTIVE",
        groups=groups,
    )
    db.add_all([employment, template])
    await db.flush()
    cycle = AssessmentCycle(
        id=uid(f"cycle-{suffix}"),
        company_id=company.id,
        template_id=template.id,
        name="Cycle",
        period="2026-09",
        status="CLOSED",
    )
    db.add(cycle)
    await db.flush()
    assessment = Assessment(
        id=uid(f"assessment-{suffix}"),
        company_id=company.id,
        cycle_id=cycle.id,
        reviewee_id=employee.id,
        reviewer_id=approver.id,
        employment_id=employment.id,
        type="MANAGER",
        status="APPROVED",
        template_snapshot={"groups": groups},
        answers=[{"questionId": question_id, "score": 8, "comment": "Observed"}],
        total_score=8,
        contribution_score=8,
        approved_at=datetime(2026, 9, 1, tzinfo=UTC),
    )
    summary = CareerSummary(
        id=uid(f"summary-{suffix}"),
        owner_user_id=employee.id,
        company_id=company.id,
        employment_id=employment.id,
        source="ORGANIZATION_OFFBOARDING",
    )
    db.add_all([assessment, summary])
    await db.commit()
    return summary, approver, str(assessment.id)


@pytest.mark.asyncio
async def test_trigger_uses_deterministic_score_and_persists_citation_basis(
    db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    summary, approver, assessment_id = await setup_summary(db_session, "valid")

    async def valid_ai(*args, **kwargs):
        claim = {"text": "Alice valid hoàn thành tốt.", "evidenceRefs": [assessment_id]}
        return {
            "narrative": claim,
            "evaluation": {"text": "Ổn định.", "evidenceRefs": [assessment_id]},
            "strengths": [{"text": "Kiến thức tốt.", "evidenceRefs": [assessment_id]}],
            "growthAreas": [],
        }

    monkeypatch.setattr(router_module, "ai_json", valid_ai)
    result = await router_module.trigger_summary(
        summary.id, VersionInput(expected_version=1), db_session, approver
    )

    assert result.dimension_scores == {"knowledge": 8.0}
    assert result.content.startswith("[Đã ẩn]")
    assert summary.snapshot["generationBasis"]["assessmentIds"] == [assessment_id]
    assert summary.snapshot["generationBasis"]["narrativeEvidenceRefs"] == [assessment_id]
    summary_id, approver_id = summary.id, approver.id

    with pytest.raises(HTTPException) as stale_evidence:
        await router_module.edit_summary(
            summary_id,
            SummaryEdit(
                expectedVersion=2,
                content="Nội dung mới.",
                evidenceRefs=[uid("unknown-assessment")],
            ),
            db_session,
            approver,
        )
    assert stale_evidence.value.status_code == 422
    await db_session.rollback()
    summary = await db_session.get(CareerSummary, summary_id)
    approver = await db_session.get(User, approver_id)
    assert summary is not None and approver is not None

    edited = await router_module.edit_summary(
        summary_id,
        SummaryEdit(
            expectedVersion=2,
            content="Nội dung mới có nguồn.",
            evidenceRefs=[assessment_id],
        ),
        db_session,
        approver,
    )
    assert edited.content == "Nội dung mới có nguồn."
    assert summary.snapshot["generationBasis"]["narrativeSource"] == "ADMIN_EDIT"
    assert summary.snapshot["generationBasis"]["narrativeEvidenceRefs"] == [assessment_id]
    assert summary.snapshot["generationBasis"]["claimEvidenceRefs"] == [assessment_id]


@pytest.mark.asyncio
async def test_trigger_rejects_ai_supplied_scores_without_mutating_summary(
    db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    summary, approver, assessment_id = await setup_summary(db_session, "invalid")

    async def malicious_ai(*args, **kwargs):
        claim = {"text": "Claim.", "evidenceRefs": [assessment_id]}
        return {
            "narrative": claim,
            "evaluation": claim,
            "strengths": [],
            "growthAreas": [],
            "dimensionScores": {"knowledge": 10},
        }

    monkeypatch.setattr(router_module, "ai_json", malicious_ai)
    with pytest.raises(HTTPException) as error:
        await router_module.trigger_summary(
            summary.id, VersionInput(expected_version=1), db_session, approver
        )

    assert error.value.status_code == 502
    await db_session.refresh(summary)
    assert summary.generated_at is None
    assert summary.dimension_scores == {}
    assert summary.version == 1


@pytest.mark.asyncio
async def test_admin_narrative_edit_preserves_distinct_locked_section_evidence(
    db_session: AsyncSession,
) -> None:
    summary, approver, narrative_ref = await setup_summary(db_session, "section-evidence")
    evaluation_ref = str(uid("evaluation-assessment"))
    strength_ref = str(uid("strength-assessment"))
    growth_ref = str(uid("growth-assessment"))
    replacement_ref = str(uid("replacement-narrative-assessment"))
    summary.generated_at = datetime.now(UTC)
    summary.snapshot = {
        "generationBasis": {
            "assessmentIds": [
                narrative_ref,
                evaluation_ref,
                strength_ref,
                growth_ref,
                replacement_ref,
            ],
            "narrativeEvidenceRefs": [narrative_ref],
            "evaluationEvidenceRefs": [evaluation_ref],
            "strengthEvidenceRefs": [[strength_ref]],
            "growthAreaEvidenceRefs": [[growth_ref]],
            "claimEvidenceRefs": [
                narrative_ref,
                evaluation_ref,
                strength_ref,
                growth_ref,
            ],
            "narrativeSource": "AI",
        }
    }
    await db_session.commit()

    await router_module.edit_summary(
        summary.id,
        SummaryEdit(
            expectedVersion=1,
            content="Narrative thay thế có nguồn riêng.",
            evidenceRefs=[uuid.UUID(replacement_ref)],
        ),
        db_session,
        approver,
    )

    basis = summary.snapshot["generationBasis"]
    assert basis["narrativeEvidenceRefs"] == [replacement_ref]
    assert set(basis["claimEvidenceRefs"]) == {
        replacement_ref,
        evaluation_ref,
        strength_ref,
        growth_ref,
    }


@pytest.mark.asyncio
async def test_public_career_context_does_not_expose_private_assessment_evidence(
    db_session: AsyncSession,
) -> None:
    summary, _, assessment_id = await setup_summary(db_session, "public")
    employee = await db_session.get(User, summary.owner_user_id)

    context = await career_context(db_session, employee, summary.employment_id)

    assert context["assessments"][0]["id"] == assessment_id
    assert "answers" not in context["assessments"][0]
    assert "templateSnapshot" not in context["assessments"][0]
    assert "comment" not in context["assessments"][0]

    evidence_context = await career_context(
        db_session,
        employee,
        summary.employment_id,
        include_assessment_evidence=True,
    )
    assert "templateSnapshot" in evidence_context["assessments"][0]
    assert "answers" in evidence_context["assessments"][0]
    assert "comment" not in evidence_context["assessments"][0]["answers"][0]
    assert "comment" not in evidence_context["assessments"][0]
    assert "reviewComment" not in evidence_context["assessments"][0]
    redacted = await redact_text(
        db_session,
        employee,
        "Gọi +84 912 345 678, https://private.example/path hoặc www.hidden.example/page",
    )
    assert "+84 912 345 678" not in redacted
    assert "private.example" not in redacted
    assert "hidden.example" not in redacted


@pytest.mark.asyncio
async def test_profile_score_projection_averages_only_approved_assessments(
    db_session: AsyncSession,
) -> None:
    summary, approver, _ = await setup_summary(db_session, "projection")
    approved = await db_session.scalar(
        select(Assessment).where(
            Assessment.reviewee_id == summary.owner_user_id,
            Assessment.status == "APPROVED",
        )
    )
    assert approved is not None
    db_session.add(
        Assessment(
            company_id=summary.company_id,
            cycle_id=approved.cycle_id,
            reviewee_id=summary.owner_user_id,
            reviewer_id=approver.id,
            employment_id=summary.employment_id,
            type="PEER",
            status="DRAFT",
            template_snapshot=approved.template_snapshot,
            answers=approved.answers,
            contribution_score=10,
            attitude_score=10,
        )
    )
    await db_session.commit()

    result = await approved_assessment_averages(
        db_session, summary.owner_user_id, summary.company_id
    )

    assert result == {
        "assessmentContributionScore": 8.0,
        "assessmentAttitudeScore": None,
    }
