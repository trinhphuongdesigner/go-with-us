import uuid
from datetime import UTC, datetime, timedelta

import pytest

from app.domain.enums import EmploymentStatus, Role
from app.domain.models import Employment, User
from app.people_search.repository import CandidateRow, experience_years
from app.people_search.schemas import EmployeeSearchPlan, SkillConstraint
from app.people_search.scoring import score_candidate


def _make_candidate(title_match: bool = True, years: float = 5.0) -> CandidateRow:
    company_id = uuid.uuid4()
    user = User(
        id=uuid.uuid4(),
        email="a@b.dev",
        name="A",
        job_title="Senior Python Engineer" if title_match else "Sales Rep",
        hashed_password="x",
        role=Role.EMPLOYEE,
        company_id=company_id,
    )
    employment = Employment(
        id=uuid.uuid4(),
        user_id=user.id,
        company_id=company_id,
        title=user.job_title,
        start_date=datetime.now(UTC) - timedelta(days=int(years * 365.25)),
        status=EmploymentStatus.ACTIVE,
    )
    return CandidateRow(
        user=user,
        employments=(employment,),
        total_experience_years=years,
        updated_at=datetime.now(UTC),
    )


def test_score_equals_sum_of_factor_contributions() -> None:
    plan = EmployeeSearchPlan(
        raw_query="python",
        required_skills=[SkillConstraint(phrase="python", required=True)],
    )
    candidate = _make_candidate()
    score, factors = score_candidate(candidate, plan)
    assert abs(sum(f.contribution for f in factors) - score) < 1e-9


def test_factor_codes_are_only_the_supported_three() -> None:
    plan = EmployeeSearchPlan(raw_query="anything")
    candidate = _make_candidate()
    _, factors = score_candidate(candidate, plan)
    assert {f.code for f in factors} == {"EXPERIENCE", "TITLE_TEXT_SIGNAL", "DATA_FRESHNESS"}


def test_title_match_scores_higher_than_no_match() -> None:
    plan = EmployeeSearchPlan(
        raw_query="python",
        required_skills=[SkillConstraint(phrase="python", required=True)],
    )
    matching = _make_candidate(title_match=True)
    non_matching = _make_candidate(title_match=False)
    matching_score, _ = score_candidate(matching, plan)
    non_matching_score, _ = score_candidate(non_matching, plan)
    assert matching_score > non_matching_score

def test_experience_merges_overlaps_and_rejects_future() -> None:
    now = datetime(2026, 1, 1, tzinfo=UTC)
    candidate = _make_candidate()
    first = candidate.employments[0]
    first.start_date = now - timedelta(days=730)
    first.end_date = now - timedelta(days=365)
    second = Employment(
        id=uuid.uuid4(),
        user_id=candidate.user.id,
        company_id=candidate.user.company_id,
        title="Engineer",
        start_date=now - timedelta(days=548),
        end_date=now,
        status=EmploymentStatus.ENDED,
    )
    assert experience_years([first, second], now=now) == 2.0
    second.start_date = now + timedelta(days=1)
    with pytest.raises(ValueError, match="future-dated"):
        experience_years([second], now=now)


def test_scoring_now_is_injectable() -> None:
    candidate = _make_candidate()
    plan = EmployeeSearchPlan(raw_query="anything")
    frozen = datetime(2026, 1, 1, tzinfo=UTC)
    assert score_candidate(candidate, plan, now=frozen) == score_candidate(candidate, plan, now=frozen)
