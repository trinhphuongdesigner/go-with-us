import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.company_memberships import CompanyMembership
from app.domain.enums import AdminPermission, ProfileSourceType, Role
from app.domain.models import Company, EmployeeSkill, Skill, User
from app.talent_workflows import router as router_module
from app.talent_workflows.models import JobRequirement


def uid(label: str) -> uuid.UUID:
    return uuid.uuid5(uuid.NAMESPACE_URL, f"matching-test:{label}")


@pytest.mark.asyncio
async def test_matching_filters_incomplete_candidates_and_ai_cannot_set_score(
    db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    company = Company(id=uid("company"), name="Matching Co")
    hr = User(
        id=uid("hr"),
        email="matching-hr@example.com",
        name="HR",
        hashed_password="test",
        role=Role.HR,
        company_id=company.id,
        admin_permissions=[AdminPermission.EMPLOYEE_WRITE.value],
        is_active=True,
    )
    complete = User(
        id=uid("complete"),
        email="matching-complete@example.com",
        name="Complete",
        hashed_password="test",
        role=Role.EMPLOYEE,
        company_id=company.id,
        admin_permissions=[],
        is_active=True,
    )
    missing = User(
        id=uid("missing"),
        email="matching-missing@example.com",
        name="Missing",
        hashed_password="test",
        role=Role.EMPLOYEE,
        company_id=company.id,
        admin_permissions=[],
        is_active=True,
    )
    db_session.add_all([company, hr, complete, missing])
    await db_session.flush()
    db_session.add(CompanyMembership(user_id=hr.id, company_id=company.id))
    python = Skill(id=uid("python"), name="Python", normalized_key="python")
    sql = Skill(id=uid("sql"), name="SQL", normalized_key="sql")
    db_session.add_all([python, sql])
    await db_session.flush()
    for user, skill, rating in (
        (complete, python, 5),
        (complete, sql, 3),
        (missing, python, 5),
    ):
        db_session.add(
            EmployeeSkill(
                user_id=user.id,
                company_id=company.id,
                skill_id=skill.id,
                rating=rating,
                note=None,
                self_assessed=True,
                source_type=ProfileSourceType.SELF,
                created_by=user.id,
                updated_by=user.id,
            )
        )
    requirement = JobRequirement(
        id=uid("requirement"),
        company_id=company.id,
        created_by_id=hr.id,
        title="Backend Engineer",
        description="Python and SQL",
        required_skills=["Python", "SQL"],
    )
    db_session.add(requirement)
    await db_session.commit()
    captured = {}

    async def explain(*args, **kwargs):
        context = kwargs.get("context", args[2])
        captured.update(context)
        match = context["matches"][0]
        return {
            "matches": [
                {
                    "userId": match["userId"],
                    "rationale": "Đủ Python và SQL.",
                    "evidenceSkillIds": match["evidenceSkillIds"],
                }
            ]
        }

    monkeypatch.setattr(router_module, "ai_json", explain)
    result = await router_module.match_requirement(requirement.id, db_session, hr)

    assert [match["userId"] for match in captured["matches"]] == [str(complete.id)]
    assert result["matches"][0]["matchScore"] == 94
    assert result["matches"][0]["rationale"] == "Đủ Python và SQL."
    assert all(match["userId"] != str(missing.id) for match in result["matches"])
