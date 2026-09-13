import pytest
from fastapi import HTTPException

from app.talent_workflows.service import (
    deterministic_candidate_matches,
    offboarding_dimension_scores,
    validate_offboarding_proposal,
)


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
