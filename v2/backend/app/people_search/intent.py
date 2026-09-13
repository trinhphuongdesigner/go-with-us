"""Model compiles requests; deterministic code resolves catalog and safety policy."""

from __future__ import annotations

import re
import unicodedata
import uuid
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Protocol

import httpx
from sqlalchemy import select

from app.ai.gateway import AiGateway, AiStatus, AiTask, EvidenceContext
from app.ai.resilience import CircuitBreaker, CircuitState, RetryPolicy, Sleep, async_sleep
from app.api.v2.dependencies import DbSession
from app.domain.models import Skill
from app.people_search.intent_models import CompiledIntent, ResolvedSearchIntent, ResolvedSkill
from app.people_search.providers.madison import MadisonIntentProvider
from app.people_search.schemas import EmployeeSearchPlan, SkillConstraint
from app.people_search.search_interpretation import (
    InterpretedDomain,
    InterpretedSkill,
    SearchInterpretation,
)
from app.people_search.settings import PeopleSearchSettings, get_people_search_settings


@dataclass(frozen=True, slots=True)
class CatalogSkill:
    canonical_skill_id: uuid.UUID
    name: str
    aliases: tuple[str, ...] = ()


class SkillCatalog(Protocol):
    """W1 supplies an authorized canonical catalog; no model-generated catalog IDs."""

    def resolve(self, phrase: str) -> CatalogSkill | None: ...


@dataclass(frozen=True, slots=True)
class CatalogDomain:
    canonical_domain: str
    name: str
    aliases: tuple[str, ...] = ()


class DomainCatalog(Protocol):
    def resolve(self, phrase: str) -> CatalogDomain | None: ...


def _alias_key(value: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", value).casefold().split())


class StaticSkillCatalog:
    """Injected immutable catalog, empty in production until canonical W1 integration."""

    def __init__(self, skills: Iterable[CatalogSkill] = ()) -> None:
        self._aliases: dict[str, CatalogSkill] = {}
        for skill in skills:
            for alias in (skill.name, *skill.aliases):
                key = _alias_key(alias)
                if not key or len(key) > 200:
                    raise ValueError("invalid catalog alias")
                if (
                    key in self._aliases
                    and self._aliases[key].canonical_skill_id != skill.canonical_skill_id
                ):
                    raise ValueError("ambiguous catalog alias")
                self._aliases[key] = skill

    def resolve(self, phrase: str) -> CatalogSkill | None:
        return self._aliases.get(_alias_key(phrase))


class StaticDomainCatalog:
    """Application-owned domain values shared with the canonical facts adapter."""

    def __init__(self, domains: Iterable[CatalogDomain] = ()) -> None:
        self._aliases: dict[str, CatalogDomain] = {}
        for domain in domains:
            if not domain.canonical_domain.strip() or len(domain.canonical_domain) > 200:
                raise ValueError("invalid canonical domain")
            for alias in (domain.canonical_domain, domain.name, *domain.aliases):
                key = _alias_key(alias)
                if not key or len(key) > 200:
                    raise ValueError("invalid domain alias")
                if (
                    key in self._aliases
                    and self._aliases[key].canonical_domain != domain.canonical_domain
                ):
                    raise ValueError("ambiguous domain alias")
                self._aliases[key] = domain

    def resolve(self, phrase: str) -> CatalogDomain | None:
        return self._aliases.get(_alias_key(phrase))


# Defense before sending a query, and after validating model output. The model
# also flags semantic paraphrases. Neither path turns a sensitive query into a
# successful broad search. Raw sensitive strings are not returned in the plan.
_PROTECTED = re.compile(
    r"\b(?:female|male|gender|women|woman|men|man|nonbinary|pregnan\w*|religio\w*|"
    r"christian\w*|muslim\w*|buddhis\w*|ethnic\w*|race(?!\s+conditions?\b)|racial|nationality|"
    r"married|single(?![ -]+sign[ -]+on\b)|disabled|disabilit\w*|sexual|gay|lesbian|age|aged|"
    r"nữ|nu gioi|nam giới|nam gioi|giới tính|gioi tinh|tuổi|do tuoi|"
    r"tôn giáo|ton giao|độc thân|doc than|kết hôn|ket hon|mang thai|"
    r"khuyết tật|khuyet tat|dân tộc|dan toc|quốc tịch|quoc tich)\b",
    re.IGNORECASE,
)


def _has_protected_constraints(value: str) -> bool:
    return bool(_PROTECTED.search(unicodedata.normalize("NFKC", value)))


@dataclass(frozen=True, slots=True)
class IntentCompilation:
    plan: EmployeeSearchPlan
    intent: ResolvedSearchIntent | None = None
    provider_failed: bool = False
    failure_codes: tuple[str, ...] = ()


class IntentCompiler:
    """Persistent resilience; provider query binding is unique to each request."""

    def __init__(
        self,
        settings: PeopleSearchSettings,
        *,
        client: httpx.AsyncClient | None = None,
        catalog: SkillCatalog | None = None,
        domain_catalog: DomainCatalog | None = None,
        circuit_breaker: CircuitBreaker | None = None,
        sleep: Sleep = async_sleep,
        provider_factory=None,
    ) -> None:
        self._settings = settings
        self._client = client
        self._catalog = catalog or StaticSkillCatalog()
        self._domain_catalog = domain_catalog or StaticDomainCatalog()
        self._breaker = circuit_breaker or CircuitBreaker()
        self._sleep = sleep
        self._provider_factory = provider_factory

    async def compile(
        self, query: str, *, tenant_id: uuid.UUID, actor_id: uuid.UUID
    ) -> IntentCompilation:
        plan = EmployeeSearchPlan(raw_query=query)
        if not query.strip():
            plan.needs_clarification = True
            plan.clarification_reason = "Vui lòng mô tả yêu cầu tìm nhân sự."
            return IntentCompilation(plan)
        if _has_protected_constraints(query):
            return self._protected_result()
        gateway = AiGateway(
            {
                "madison": self._provider_factory(query)
                if self._provider_factory
                else MadisonIntentProvider(self._settings, query=query, client=self._client)
            },
            default_provider="madison",
            prompt_version="people-search-intent-v1",
            schema_version="people-search-intent-v1",
            retry_policy=RetryPolicy(max_attempts=2),
            circuit_breakers={"madison": self._breaker},
            sleep=self._sleep,
        )
        result = await gateway.generate(
            AiTask.PEOPLE_SEARCH_INTENT,
            CompiledIntent,
            EvidenceContext(tenant_id=tenant_id, actor_id=actor_id),
        )
        if result.status != AiStatus.OK or result.data is None:
            # Shared gateway leaves non-transient adapter failures half-open.
            # Complete that probe locally: invalid schema is a content failure,
            # not a transport outage, and must not permanently lock this service.
            if self._breaker.state == CircuitState.HALF_OPEN and result.warnings in {
                ("provider_or_schema_failure",),
                ("schema_validation_error",),
            }:
                self._breaker.record_success()
            return IntentCompilation(plan, provider_failed=True, failure_codes=result.warnings)
        proposal = result.data
        if proposal.sensitive_constraints_detected or _has_protected_constraints(
            proposal.model_dump_json()
        ):
            return self._protected_result()
        if not self._structured_constraints_preserved(query, proposal):
            plan.needs_clarification = True
            plan.clarification_reason = (
                "Chưa xác minh được đầy đủ các bộ lọc đã nhập; vui lòng làm rõ yêu cầu."
            )
            return IntentCompilation(plan)

        intent = ResolvedSearchIntent(
            availability=proposal.availability,
            title_keywords=proposal.title_keywords,
            minimum_total_years=proposal.minimum_total_years,
            minimum_total_years_exclusive=proposal.minimum_total_years_exclusive,
            soft_preferences=proposal.soft_preferences,
            unsupported_constraints=proposal.unsupported_constraints,
        )
        interpreted_domains: list[InterpretedDomain] = []
        interpreted_skills: list[InterpretedSkill] = []
        for name in proposal.required_domains:
            domain = self._domain_catalog.resolve(name)
            interpreted_domains.append(
                InterpretedDomain(
                    name=name,
                    canonical_domain=domain.canonical_domain if domain else None,
                )
            )
            if domain is None:
                intent.unresolved_required_domains.append(name)
            else:
                intent.required_domains.append(domain.canonical_domain)
        for skill in proposal.skills:
            resolved = self._catalog.resolve(skill.name)
            interpreted_skills.append(
                InterpretedSkill(
                    name=resolved.name if resolved else skill.name,
                    canonical_skill_id=resolved.canonical_skill_id if resolved else None,
                    required=skill.required,
                    minimum_level=skill.minimum_level,
                    minimum_years=skill.minimum_years,
                    minimum_years_exclusive=skill.minimum_years_exclusive,
                )
            )
            if resolved is None:
                unknown = (
                    intent.unresolved_required_skills
                    if skill.required
                    else intent.unresolved_preferred_skills
                )
                unknown.append(skill.name)
            else:
                intent.skills.append(
                    ResolvedSkill(
                        canonical_skill_id=resolved.canonical_skill_id,
                        name=resolved.name,
                        required=skill.required,
                        minimum_level=skill.minimum_level,
                        minimum_years=skill.minimum_years,
                        minimum_years_exclusive=skill.minimum_years_exclusive,
                    )
                )
            target = plan.required_skills if skill.required else plan.preferred_skills
            target.append(SkillConstraint(phrase=skill.name, required=skill.required))
        plan.min_experience_years = proposal.minimum_total_years
        plan.availability = None if proposal.availability == "ANY" else proposal.availability
        plan.interpretation = SearchInterpretation(
            normalized_query=proposal.normalized_query,
            skills=interpreted_skills,
            required_domains=interpreted_domains,
            availability=proposal.availability,
            minimum_total_years=proposal.minimum_total_years,
            minimum_total_years_exclusive=proposal.minimum_total_years_exclusive,
            title_keywords=proposal.title_keywords,
            soft_preferences=proposal.soft_preferences,
            missing_fields=proposal.missing_fields,
            unsupported_constraints=proposal.unsupported_constraints,
        )
        # Legacy response representation only. Router never treats skill phrases
        # as title evidence; it passes explicit title_keywords to title scoring.
        plan.preferred_skills.extend(
            SkillConstraint(phrase=term, required=False) for term in proposal.title_keywords
        )
        if intent.unresolved_required_skills:
            plan.needs_clarification = True
            plan.clarification_reason = (
                "Chưa xác định được kỹ năng bắt buộc trong danh mục chuẩn hóa."
            )
        elif intent.unresolved_required_domains:
            plan.needs_clarification = True
            plan.clarification_reason = (
                "Chưa xác định được lĩnh vực bắt buộc trong danh mục chuẩn hóa."
            )
        elif proposal.unsupported_constraints or proposal.missing_fields:
            plan.needs_clarification = True
            plan.clarification_reason = (
                "Yêu cầu có điều kiện chưa hỗ trợ hoặc thiếu thông tin cần làm rõ."
            )
        elif not (
            proposal.skills
            or proposal.title_keywords
            or proposal.required_domains
            or proposal.minimum_total_years is not None
            or proposal.availability != "ANY"
        ):
            plan.needs_clarification = True
            plan.clarification_reason = (
                "Vui lòng nêu rõ chức danh, kỹ năng hoặc điều kiện tìm kiếm."
            )
        return IntentCompilation(plan, intent)

    def _structured_constraints_preserved(self, query: str, proposal: CompiledIntent) -> bool:
        """Verify the UI's exact clause grammar; never compile or relax intent.

        Unknown free-text semantics remain the model's task. Recognized UI
        clauses must be represented exactly (or via a trusted catalog alias).
        A mismatch is clarification, not a regex-generated replacement plan.
        """

        def skill_key(name: str) -> str:
            skill = self._catalog.resolve(name)
            return str(skill.canonical_skill_id) if skill else _alias_key(name)

        def domain_key(name: str) -> str:
            domain = self._domain_catalog.resolve(name)
            return domain.canonical_domain if domain else _alias_key(name)

        for clause in query.split(";"):
            normalized = _alias_key(clause)
            for prefix, required in (("kỹ năng bắt buộc:", True), ("kỹ năng ưu tiên:", False)):
                if normalized.startswith(prefix):
                    names = re.split(r",|\s+và\s+|\s+and\s+", normalized[len(prefix) :])
                    proposed = {
                        skill_key(skill.name)
                        for skill in proposal.skills
                        if skill.required == required
                    }
                    if (
                        any(not name.strip() for name in names)
                        or {skill_key(name) for name in names} != proposed
                    ):
                        return False
                    if any(
                        skill.minimum_years is not None
                        or skill.minimum_level is not None
                        or skill.minimum_years_exclusive
                        for skill in proposal.skills
                        if skill.required == required
                    ):
                        return False
            if normalized.startswith("domain bắt buộc:"):
                domains = re.split(r",|\s+và\s+|\s+and\s+", normalized[len("domain bắt buộc:") :])
                proposed_domains = {domain_key(domain) for domain in proposal.required_domains}
                if (
                    any(not domain.strip() for domain in domains)
                    or {domain_key(domain) for domain in domains} != proposed_domains
                ):
                    return False
            if normalized.startswith("trạng thái sẵn sàng:"):
                expected = normalized[len("trạng thái sẵn sàng:") :].strip().upper()
                if (
                    expected not in {"AVAILABLE", "AVAILABLE_SOON"}
                    or proposal.availability != expected
                ):
                    return False
            if normalized.startswith("kinh nghiệm tối thiểu"):
                match = re.fullmatch(r"kinh nghiệm tối thiểu (\d+(?:\.\d+)?) năm", normalized)
                if (
                    match is None
                    or proposal.minimum_total_years != float(match.group(1))
                    or proposal.minimum_total_years_exclusive
                ):
                    return False
        return True

    @staticmethod
    def _protected_result() -> IntentCompilation:
        return IntentCompilation(
            EmployeeSearchPlan(
                raw_query="Yêu cầu có tiêu chí không được hỗ trợ.",
                needs_clarification=True,
                clarification_reason="Vui lòng chỉ dùng tiêu chí công việc; thuộc tính nhạy cảm không được dùng để tìm nhân sự.",
            )
        )


async def get_intent_compiler(db: DbSession) -> IntentCompiler:
    """Build the request compiler from the application-owned skill catalog and AI connection."""
    from app.ai.shared_provider import SharedIntentProvider

    skills = (await db.scalars(select(Skill).order_by(Skill.normalized_key, Skill.id))).all()
    catalog = StaticSkillCatalog(
        CatalogSkill(skill.id, skill.name, (skill.normalized_key,)) for skill in skills
    )
    return IntentCompiler(
        get_people_search_settings(),
        catalog=catalog,
        provider_factory=lambda query: SharedIntentProvider(db, query),
    )
