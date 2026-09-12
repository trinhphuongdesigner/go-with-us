"""Serialize selected canonical matches without exposing unselected profiles."""

from uuid import UUID

from app.people_search.canonical_schema import CanonicalCandidateMatch, CanonicalScoreFactor
from app.people_search.canonical_service import CanonicalSearchResult
from app.people_search.schemas import EmployeeSearchPlan, SearchResponse


def canonical_response(
    result: CanonicalSearchResult, plan: EmployeeSearchPlan, *, company_id: UUID
) -> SearchResponse:
    if result.status == "needs_clarification":
        return SearchResponse(
            status=result.status,
            plan=plan.model_copy(
                update={
                    "needs_clarification": True,
                    "clarification_reason": "Yêu cầu có điều kiện chưa thể xác minh đầy đủ; vui lòng làm rõ tiêu chí.",
                }
            ),
        )
    if result.status == "insufficient_evidence":
        return SearchResponse(
            status=result.status,
            plan=plan,
            unsupported_reasons=[
                "Dữ liệu chuẩn hóa hoặc nguồn xác minh chưa sẵn sàng; chưa thực hiện tìm kiếm mở rộng."
            ],
        )
    profiles = {profile.candidate_id: profile for profile in result.profiles}
    if any(match.score_version != "people-search-canonical-v1" for match in result.matches):
        raise ValueError("unsupported canonical score version")
    matches = [
        CanonicalCandidateMatch(
            candidate_id=match.candidate_id,
            company_id=company_id,
            name=profiles[match.candidate_id].name,
            title=profiles[match.candidate_id].title,
            score=match.score,
            score_factors=[
                CanonicalScoreFactor(
                    code=factor.code,
                    points=factor.points,
                    maximum_points=factor.maximum_points,
                    evidence_refs=list(factor.evidence_refs),
                )
                for factor in match.score_factors
            ],
            evidence_refs=list(match.evidence_refs),
            data_freshness_at=match.data_freshness_at,
        )
        for match in result.matches
    ]
    return SearchResponse(
        status=result.status,
        plan=plan,
        candidates=[*matches],
        explanation=None,
        explanation_source="deterministic_fallback" if matches else None,
    )
