"""Deterministic scoring: sum(factors.contribution) == CandidateMatch.score, enforced at runtime.

Only EXPERIENCE, TITLE_TEXT_SIGNAL, DATA_FRESHNESS factors are computed -- the
contract-aspirational REQUIRED_SKILL/PREFERRED_SKILL/DOMAIN/AVAILABILITY codes
are not produced because there is no skill catalog to ground them in (W1 gap).
"""

from __future__ import annotations

from datetime import UTC, datetime

from app.people_search.repository import CandidateRow
from app.people_search.schemas import EmployeeSearchPlan, ScoreFactor

_EXPERIENCE_WEIGHT = 50.0
_TITLE_SIGNAL_WEIGHT = 40.0
_FRESHNESS_WEIGHT = 10.0
_FRESHNESS_HALF_LIFE_DAYS = 180.0


def _experience_contribution(candidate: CandidateRow, plan: EmployeeSearchPlan) -> float:
    if plan.min_experience_years is None or plan.min_experience_years <= 0:
        ratio = min(candidate.total_experience_years / 10.0, 1.0)
    else:
        ratio = min(candidate.total_experience_years / plan.min_experience_years, 1.0)
    return round(ratio * _EXPERIENCE_WEIGHT, 4)


def _title_signal_contribution(candidate: CandidateRow, plan: EmployeeSearchPlan) -> float:
    terms = [phrase.phrase for phrase in plan.required_skills + plan.preferred_skills]
    if not terms:
        return 0.0
    haystacks = [(candidate.user.job_title or "").casefold()] + [
        employment.title.casefold() for employment in candidate.employments
    ]
    hits = sum(
        1
        for term in terms
        if any(term.casefold() in haystack for haystack in haystacks)
    )
    ratio = min(hits / len(terms), 1.0)
    return round(ratio * _TITLE_SIGNAL_WEIGHT, 4)


def _freshness_contribution(candidate: CandidateRow, now: datetime) -> float:
    updated_at = candidate.updated_at
    if updated_at.tzinfo is None:
        updated_at = updated_at.replace(tzinfo=UTC)
    age_days = max((now - updated_at).days, 0)
    decay: float = 0.5 ** (age_days / _FRESHNESS_HALF_LIFE_DAYS)
    return round(decay * _FRESHNESS_WEIGHT, 4)


def score_candidate(
    candidate: CandidateRow, plan: EmployeeSearchPlan, *, now: datetime | None = None
) -> tuple[float, list[ScoreFactor]]:
    instant = now or datetime.now(UTC)
    factors = [
        ScoreFactor(
            code="EXPERIENCE",
            label="Kinh nghiệm làm việc",
            weight=_EXPERIENCE_WEIGHT,
            contribution=_experience_contribution(candidate, plan),
        ),
        ScoreFactor(
            code="TITLE_TEXT_SIGNAL",
            label="Trùng khớp từ khóa chức danh",
            weight=_TITLE_SIGNAL_WEIGHT,
            contribution=_title_signal_contribution(candidate, plan),
        ),
        ScoreFactor(
            code="DATA_FRESHNESS",
            label="Dữ liệu cập nhật gần đây",
            weight=_FRESHNESS_WEIGHT,
            contribution=_freshness_contribution(candidate, instant),
        ),
    ]
    score = round(sum(factor.contribution for factor in factors), 4)
    assert abs(sum(factor.contribution for factor in factors) - score) < 1e-9, (
        "score must equal sum of factor contributions"
    )
    return score, factors
