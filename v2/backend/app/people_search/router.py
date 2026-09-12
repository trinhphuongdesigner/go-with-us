"""Model intent, then deterministic tenant-scoped search; no model ranking."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Response, HTTPException, Query
from pydantic import Field

from app.api.v2.dependencies import (
    CurrentUser,
    DbSession,
    get_tenant_company_id,
    require_permission,
)
from app.domain.enums import Permission, Role, CompanyStatus
from app.domain.models import Company
from app.people_search.canonical_response import canonical_response
from app.people_search.canonical_service import CanonicalSearchService, get_canonical_search_service
from app.people_search.evidence import build_evidence
from app.people_search.intent import IntentCompiler, get_intent_compiler
from app.people_search.repository import search_candidates
from app.people_search.schemas import (
    CandidateMatch,
    EmployeeSearchPlan,
    SearchResponse,
    SkillConstraint,
    StrictModel,
)
from app.people_search.scoring import score_candidate

router = APIRouter(prefix="/people-search", tags=["people-search"])
TenantCompanyId = Annotated[uuid.UUID | None, Depends(get_tenant_company_id)]
RequirePeopleRead = Annotated[None, Depends(require_permission(Permission.PEOPLE_READ))]


class PeopleSearchRequest(StrictModel):
    query: str = Field(min_length=1, max_length=2000)


_TIMEOUT_FAILURE_CODE = "provider_timeout"


async def selected_search_company(current_user: CurrentUser, db: DbSession,
                                  company_id: uuid.UUID | None = Query(default=None, alias="companyId")):
    if current_user.role != Role.SUPER_ADMIN:
        if company_id not in {None, current_user.company_id}:
            raise HTTPException(403, "Không thể tìm ngoài công ty của bạn")
        return current_user.company_id
    if company_id is not None:
        company = await db.get(Company, company_id)
        if company is None or company.status != CompanyStatus.ACTIVE:
            raise HTTPException(404, "Công ty không tồn tại hoặc đã khóa")
    return company_id


def live_intent_compiler(db: DbSession):
    from app.ai.shared_provider import SharedIntentProvider
    from app.people_search.settings import get_people_search_settings
    return IntentCompiler(get_people_search_settings(), provider_factory=lambda query: SharedIntentProvider(db, query))


def _provider_failure_status_code(failure_codes: tuple[str, ...]) -> int:
    """Map gateway failure warning codes to HTTP status deterministically.

    Per ai-reliability-contract.md section 8: provider timeout with no
    fallback is 504; every other malformed/invalid/failed provider outcome
    (schema errors, invented IDs, exhausted transient/circuit failures) is
    502. Never parses error text; only checks the exact warning code set.
    """
    if _TIMEOUT_FAILURE_CODE in failure_codes:
        return 504
    return 502


@router.post("/query", response_model=SearchResponse)
async def query_people(
    payload: PeopleSearchRequest,
    current_user: CurrentUser,
    db: DbSession,
    company_id: Annotated[uuid.UUID | None, Depends(selected_search_company)],
    _permission_check: RequirePeopleRead,
    response: Response,
    compiler: Annotated[IntentCompiler, Depends(live_intent_compiler)],
    canonical_service: Annotated[CanonicalSearchService, Depends(get_canonical_search_service)],
) -> SearchResponse:
    # Identity and permission dependencies complete before calling the provider.
    # Platform callers without a selected tenant must not compile or retrieve.
    if company_id is None:
        return SearchResponse(
            status="needs_clarification",
            plan=EmployeeSearchPlan(
                raw_query=payload.query,
                needs_clarification=True,
                clarification_reason="Vui lòng chọn công ty trước khi tìm nhân sự.",
            ),
        )
    compilation = await compiler.compile(
        payload.query, tenant_id=company_id, actor_id=current_user.id
    )
    plan = compilation.plan
    if compilation.provider_failed:
        response.status_code = _provider_failure_status_code(compilation.failure_codes)
        return SearchResponse(
            status="provider_failure",
            plan=plan,
            unsupported_reasons=["Không thể phân tích yêu cầu lúc này; vui lòng thử lại."],
        )
    unsupported: list[str] = []
    intent = compilation.intent
    if (
        not plan.needs_clarification
        and intent is not None
        and (
            intent.skills
            or intent.unresolved_preferred_skills
            or intent.required_domains
            or intent.availability != "ANY"
            or intent.soft_preferences
        )
    ):
        result = await canonical_service.search(
            intent, tenant_id=company_id, actor_id=current_user.id, now=datetime.now(UTC)
        )
        return canonical_response(result, plan, company_id=company_id)
    if plan.required_skills:
        plan.needs_clarification = True
        plan.clarification_reason = (
            "Không thể xác minh điều kiện kỹ năng bắt buộc vì chưa có dữ liệu kỹ năng chuẩn hóa."
        )
        unsupported.append("Kỹ năng bắt buộc chưa được hỗ trợ; không thực hiện tìm kiếm mở rộng.")
    if plan.availability is not None:
        plan.needs_clarification = True
        plan.clarification_reason = "Không thể xác minh trạng thái sẵn sàng từ dữ liệu hiện có."
        unsupported.append("Trạng thái sẵn sàng chưa được lưu trữ.")
    if intent is not None and intent.required_domains:
        plan.needs_clarification = True
        plan.clarification_reason = (
            "Chưa có dữ liệu lĩnh vực chuẩn hóa để xác minh điều kiện bắt buộc."
        )
        unsupported.append("Kinh nghiệm theo lĩnh vực chưa được hỗ trợ.")
    if intent is not None and (
        intent.unresolved_preferred_skills or any(not skill.required for skill in intent.skills)
    ):
        unsupported.append("Kỹ năng ưu tiên chưa có dữ liệu chuẩn hóa để chấm điểm.")
    if intent is not None and intent.soft_preferences:
        unsupported.append("Các ưu tiên bổ sung chưa có dữ liệu để chấm điểm.")
    if plan.needs_clarification:
        return SearchResponse(
            status="needs_clarification", plan=plan, unsupported_reasons=unsupported
        )
    preferred = intent.title_keywords if intent else []
    # Legacy scorer only consumes explicit title preferences; skills never gain
    # false title-provenance points while the W1 canonical projection is absent.
    scoring_plan = plan.model_copy(
        update={
            "required_skills": [],
            "preferred_skills": [
                SkillConstraint(phrase=term, required=False) for term in preferred
            ],
        }
    )
    # Plain/title preferences remain ranking signals, never hard filters.
    rows = await search_candidates(
        db,
        company_id=company_id,
        required_terms=[],
        preferred_terms=preferred,
        min_total_experience_years=plan.min_experience_years,
        limit=None,
    )
    if intent and intent.minimum_total_years_exclusive and intent.minimum_total_years is not None:
        rows = [row for row in rows if row.total_experience_years > intent.minimum_total_years]
    if not rows:
        return SearchResponse(status="empty", plan=plan, unsupported_reasons=unsupported)

    instant = datetime.now(UTC)
    candidates: list[CandidateMatch] = []
    for row in rows:
        score, factors = score_candidate(row, scoring_plan, now=instant)
        candidates.append(
            CandidateMatch(
                user_id=row.user.id,
                name=row.user.name,
                title=row.user.job_title,
                company_id=company_id,
                score=score,
                factors=factors,
                evidence=build_evidence(row),
            )
        )
    candidates.sort(
        key=lambda candidate: (-candidate.score, candidate.name.casefold(), str(candidate.user_id))
    )
    candidates = candidates[:25]

    # W1 immutable SourceBlock projection is absent. Calling AiGateway would correctly
    # return insufficient_evidence; expose deterministic supported facts instead.
    return SearchResponse(
        status="ok",
        plan=plan,
        candidates=[*candidates],
        unsupported_reasons=unsupported,
        explanation=None,
        explanation_source="deterministic_fallback",
    )
