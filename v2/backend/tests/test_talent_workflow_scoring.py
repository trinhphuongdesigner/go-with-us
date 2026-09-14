import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.company_memberships import CompanyMembership
from app.domain.enums import AdminPermission, Role
from app.domain.models import Company, User
from app.security.jwt import hash_password
from app.talent_workflows.models import Assessment, AssessmentCycle, AssessmentTemplate
from app.talent_workflows.router import review_assessment
from app.talent_workflows.schemas import ReviewInput, TemplateInput
from app.talent_workflows.service import (
    deterministic_candidate_matches,
    offboarding_dimension_scores,
    score,
    validate_offboarding_proposal,
)


def scoring_group(
    identifier: str,
    *,
    weight: object = 1,
    dimension: str = "CONTRIBUTION",
    questions: list[dict[str, object]] | None = None,
) -> dict[str, object]:
    return {
        "id": identifier,
        "name": identifier,
        "description": "",
        "weight": weight,
        "scoreDimension": dimension,
        "questions": questions
        or [
            {
                "id": f"{identifier}-question",
                "text": "Evidence question",
                "guidance": "",
                "weight": 1,
                "maxScore": 10,
            }
        ],
    }


def answer(question_id: str, value: object) -> dict[str, object]:
    return {"questionId": question_id, "score": value, "comment": ""}


def test_score_normalizes_questions_and_applies_both_weight_levels():
    snapshot = {
        "groups": [
            scoring_group(
                "contribution-a",
                weight=1,
                questions=[
                    {
                        "id": "delivery",
                        "text": "Delivery",
                        "guidance": "",
                        "weight": 1,
                        "maxScore": 4,
                    },
                    {
                        "id": "quality",
                        "text": "Quality",
                        "guidance": "",
                        "weight": 3,
                        "maxScore": 10,
                    },
                ],
            ),
            scoring_group("contribution-b", weight=3),
            scoring_group("attitude", weight=2, dimension="ATTITUDE"),
        ]
    }
    answers = [
        answer("delivery", 2),
        answer("quality", 9),
        answer("contribution-b-question", 6),
        answer("attitude-question", 10),
    ]

    result = score(snapshot, answers, complete=True)

    # contribution-a=(2/4*10*1 + 9/10*10*3)/(1+3)=8
    # contribution=(8*1 + 6*3)/(1+3)=6.5; total=(8*1 + 6*3 + 10*2)/6=7.67
    assert result == {
        "total_score": 7.67,
        "contribution_score": 6.5,
        "attitude_score": 10.0,
    }


def test_score_rounds_exact_midpoints_half_up_to_two_decimals():
    snapshot = {
        "groups": [
            scoring_group(
                "rounding",
                questions=[
                    {
                        "id": "eight",
                        "text": "Eight",
                        "guidance": "",
                        "weight": 1,
                        "maxScore": 10,
                    },
                    {
                        "id": "eight-quarter",
                        "text": "Eight point two five",
                        "guidance": "",
                        "weight": 1,
                        "maxScore": 40,
                    },
                ],
            )
        ]
    }

    result = score(snapshot, [answer("eight", 8), answer("eight-quarter", 33)], True)

    assert result["total_score"] == 8.13


@pytest.mark.parametrize(
    "answers",
    [
        [answer("unknown", 5)],
        [answer("group-question", 5), answer("group-question", 6)],
    ],
)
def test_score_rejects_unknown_or_duplicate_answer_ids(answers):
    with pytest.raises(HTTPException) as error:
        score({"groups": [scoring_group("group")]}, answers, complete=True)

    assert error.value.status_code == 422


@pytest.mark.parametrize("value", [True, 1.5, 0, 11])
def test_score_rejects_boolean_non_integer_and_out_of_range_answers(value):
    with pytest.raises(HTTPException) as error:
        score(
            {"groups": [scoring_group("group")]},
            [answer("group-question", value)],
            complete=True,
        )

    assert error.value.status_code == 422


def test_score_requires_every_positive_weight_question_when_complete():
    with pytest.raises(HTTPException) as error:
        score({"groups": [scoring_group("group")]}, [], complete=True)

    assert error.value.status_code == 422


@pytest.mark.parametrize(
    "group",
    [
        scoring_group("negative-group", weight=-1),
        scoring_group(
            "negative-question",
            questions=[
                {
                    "id": "negative",
                    "text": "Negative",
                    "guidance": "",
                    "weight": -1,
                    "maxScore": 10,
                },
                {
                    "id": "positive",
                    "text": "Positive",
                    "guidance": "",
                    "weight": 2,
                    "maxScore": 10,
                },
            ],
        ),
        scoring_group("zero-group", weight=0),
        scoring_group(
            "zero-question-sum",
            questions=[
                {
                    "id": "zero",
                    "text": "Zero",
                    "guidance": "",
                    "weight": 0,
                    "maxScore": 10,
                }
            ],
        ),
        scoring_group(
            "zero-scale",
            questions=[
                {
                    "id": "zero-scale-question",
                    "text": "Zero scale",
                    "guidance": "",
                    "weight": 1,
                    "maxScore": 0,
                }
            ],
        ),
        scoring_group("string-weight", weight="not-a-weight"),
    ],
)
def test_score_fails_closed_for_invalid_or_non_positive_weight_configuration(group):
    raw_questions = group["questions"]
    assert isinstance(raw_questions, list)
    answers = [answer(str(question["id"]), 1) for question in raw_questions]

    with pytest.raises(HTTPException) as error:
        score({"groups": [group]}, answers, complete=True)

    assert error.value.status_code == 422


def test_score_rejects_duplicate_question_ids_in_the_immutable_snapshot():
    duplicate = {
        "id": "same-question",
        "text": "Same question",
        "guidance": "",
        "weight": 1,
        "maxScore": 10,
    }
    snapshot = {
        "groups": [
            scoring_group("first", questions=[duplicate]),
            scoring_group("second", questions=[duplicate]),
        ]
    }

    with pytest.raises(HTTPException) as error:
        score(snapshot, [answer("same-question", 8)], complete=True)

    assert error.value.status_code == 422


def test_score_rejects_duplicate_group_ids_even_when_question_ids_are_distinct():
    snapshot = {
        "groups": [
            scoring_group("duplicate"),
            scoring_group(
                "duplicate",
                questions=[
                    {
                        "id": "distinct-question",
                        "text": "Distinct question",
                        "guidance": "",
                        "weight": 1,
                        "maxScore": 10,
                    }
                ],
            ),
        ]
    }

    with pytest.raises(HTTPException) as error:
        score(
            snapshot,
            [answer("duplicate-question", 8), answer("distinct-question", 8)],
            complete=True,
        )

    assert error.value.status_code == 422


@pytest.mark.parametrize(
    ("scope", "missing_field"),
    [
        ("group", "weight"),
        ("group", "scoreDimension"),
        ("question", "weight"),
        ("question", "maxScore"),
    ],
)
def test_score_rejects_snapshot_missing_required_scoring_fields(scope, missing_field):
    group = scoring_group("required-fields")
    target = group if scope == "group" else group["questions"][0]
    del target[missing_field]

    with pytest.raises(HTTPException) as error:
        score(
            {"groups": [group]},
            [answer("required-fields-question", 8)],
            complete=True,
        )

    assert error.value.status_code == 422


def test_score_accepts_valid_legacy_numeric_strings_without_changing_the_result():
    group = scoring_group(
        "legacy",
        weight="2.5",
        questions=[
            {
                "id": "legacy-question",
                "text": "Legacy question",
                "guidance": "",
                "weight": "1.5",
                "maxScore": "10",
            }
        ],
    )

    result = score(
        {"groups": [group]},
        [answer("legacy-question", 8)],
        complete=True,
    )

    assert result == {
        "total_score": 8.0,
        "contribution_score": 8.0,
        "attitude_score": None,
    }


def test_score_keeps_an_absent_dimension_unsupported_instead_of_inventing_neutral_five():
    result = score(
        {"groups": [scoring_group("contribution")]},
        [answer("contribution-question", 8)],
        complete=True,
    )

    assert result["contribution_score"] == 8.0
    assert result["attitude_score"] is None


def test_template_entry_validation_rejects_non_positive_scoring_denominators():
    with pytest.raises(ValidationError):
        TemplateInput.model_validate(
            {
                "name": "Invalid template",
                "groups": [scoring_group("group", weight=0)],
            }
        )


@pytest.mark.asyncio
async def test_approve_recomputes_from_persisted_snapshot_and_answers_not_live_template(
    db_session: AsyncSession,
):
    company = Company(name="Immutable assessment company")
    db_session.add(company)
    await db_session.flush()
    approver = User(
        email="approver@immutable.dev",
        name="Approver",
        hashed_password=hash_password("ImmutableTest123!"),
        role=Role.BOD,
        company_id=company.id,
        admin_permissions=[AdminPermission.ASSESSMENT_REVIEW.value],
    )
    employee = User(
        email="employee@immutable.dev",
        name="Employee",
        hashed_password=hash_password("ImmutableTest123!"),
        role=Role.EMPLOYEE,
        company_id=company.id,
    )
    db_session.add_all([approver, employee])
    await db_session.flush()
    db_session.add(CompanyMembership(user_id=approver.id, company_id=company.id))
    live_group = scoring_group("live")
    template = AssessmentTemplate(
        company_id=company.id,
        created_by_id=approver.id,
        name="Immutable template",
        description="",
        status="ACTIVE",
        groups=[live_group],
    )
    db_session.add(template)
    await db_session.flush()
    cycle = AssessmentCycle(
        company_id=company.id,
        template_id=template.id,
        name="Immutable cycle",
        period="2026-09",
        status="OPEN",
    )
    db_session.add(cycle)
    await db_session.flush()
    persisted_snapshot = {"groups": [scoring_group("snapshot")]}
    row = Assessment(
        company_id=company.id,
        cycle_id=cycle.id,
        reviewee_id=employee.id,
        reviewer_id=employee.id,
        type="SELF",
        status="SUBMITTED",
        template_snapshot=persisted_snapshot,
        answers=[answer("snapshot-question", 8)],
        total_score=1,
        contribution_score=1,
    )
    db_session.add(row)
    await db_session.commit()

    template.groups = [
        scoring_group(
            "live",
            questions=[
                {
                    "id": "live-question",
                    "text": "Live question",
                    "guidance": "",
                    "weight": 1,
                    "maxScore": 100,
                }
            ],
        )
    ]
    await db_session.commit()

    result = await review_assessment(
        row.id,
        "approve",
        ReviewInput(expected_version=1),
        db_session,
        approver,
    )

    assert result.status == "APPROVED"
    assert result.total_score == 8.0
    assert result.contribution_score == 8.0
    assert result.attitude_score is None
    assert result.template_snapshot == persisted_snapshot


def assessment(*, passport_dimension: str | None, score: int, weight: float = 1):
    group = {
        "id": "group-1",
        "name": "Evidence group",
        "weight": weight,
        "scoreDimension": "CONTRIBUTION",
        "questions": [
            {"id": "question-1", "text": "Evidence question", "weight": 1, "maxScore": 10}
        ],
    }
    if passport_dimension is not None:
        group["passportDimension"] = passport_dimension
    return {
        "id": "assessment-1",
        "templateSnapshot": {"groups": [group]},
        "answers": [{"questionId": "question-1", "score": score, "comment": "source"}],
    }


def test_offboarding_scores_are_deterministic_and_average_assessments_equally():
    scores = offboarding_dimension_scores(
        [
            assessment(passport_dimension="KNOWLEDGE", score=8, weight=100),
            assessment(passport_dimension="KNOWLEDGE", score=4, weight=1),
        ]
    )

    assert scores == {"knowledge": 6.0}


def test_offboarding_scores_omit_dimensions_without_explicit_snapshot_mapping():
    assert offboarding_dimension_scores([assessment(passport_dimension=None, score=10)]) == {}


def test_offboarding_scores_reject_unknown_mapping_in_untrusted_snapshot():
    with pytest.raises(HTTPException) as error:
        offboarding_dimension_scores([assessment(passport_dimension="MADE_UP", score=10)])

    assert error.value.status_code == 422


def test_offboarding_narrative_requires_allowlisted_assessment_citations():
    assessment_id = "de769cf9-9370-43f1-8ed2-88d395074636"
    proposal = validate_offboarding_proposal(
        {
            "narrative": {"text": "Đã hoàn thành mục tiêu.", "evidenceRefs": [assessment_id]},
            "evaluation": {"text": "Kết quả ổn định.", "evidenceRefs": [assessment_id]},
            "strengths": [{"text": "Chủ động.", "evidenceRefs": [assessment_id]}],
            "growthAreas": [],
        },
        {assessment_id},
    )

    assert proposal.narrative.text == "Đã hoàn thành mục tiêu."


@pytest.mark.parametrize(
    "bad_refs",
    [[], ["25092358-75b7-4e0e-a2cd-54c67dfbe05e"]],
)
def test_offboarding_narrative_rejects_missing_or_unknown_citations(bad_refs):
    assessment_id = "de769cf9-9370-43f1-8ed2-88d395074636"
    raw = {
        "narrative": {"text": "Không có căn cứ.", "evidenceRefs": bad_refs},
        "evaluation": {"text": "Có căn cứ.", "evidenceRefs": [assessment_id]},
        "strengths": [],
        "growthAreas": [],
    }

    with pytest.raises(HTTPException) as error:
        validate_offboarding_proposal(raw, {assessment_id})

    assert error.value.status_code == 502


def test_candidate_matching_hard_filters_missing_required_skills_and_scores_in_code():
    candidates = [
        {
            "userId": "candidate-complete",
            "skills": [
                {"id": "python-id", "name": "Python", "rating": 5},
                {"id": "sql-id", "name": "SQL", "rating": 3},
            ],
        },
        {
            "userId": "candidate-missing",
            "skills": [{"id": "python-id-2", "name": "Python", "rating": 5}],
        },
    ]

    matches = deterministic_candidate_matches([" python ", "SQL"], candidates)

    assert matches == [
        {
            "userId": "candidate-complete",
            "matchScore": 94,
            "evidenceSkillIds": ["python-id", "sql-id"],
            "matchedSkills": [
                {"id": "python-id", "name": "Python", "rating": 5},
                {"id": "sql-id", "name": "SQL", "rating": 3},
            ],
        }
    ]


def test_candidate_matching_uses_catalog_unicode_and_whitespace_normalization():
    matches = deterministic_candidate_matches(
        ["  Cafe\u0301   Platform  "],
        [
            {
                "userId": "candidate",
                "skills": [
                    {
                        "id": "cafe-id",
                        "name": "Café Platform",
                        "rating": 4,
                    }
                ],
            }
        ],
    )

    assert matches[0]["userId"] == "candidate"
