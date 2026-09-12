"""Deterministic canonical staffing ranking, independent of persistence/providers.

Trust boundary: an application-owned W1 adapter must load VERIFIED_CANONICAL facts
from verified/applied canonical records and their original immutable plaintext
source spans. Never construct these objects from model/client output or manufacture
citations from mutable User/Employment rows. Reference validation proves source
and subject binding, not semantic extraction: the adapter owns verification that
each numeric/domain value is supported by its cited source. Unverified, edited
self-asserted, unsupported, and future observations are unusable here.

Formula people-search-canonical-v1: active requested groups have relative weights
REQUIRED_SKILL=40, PREFERRED_SKILL=30, EXPERIENCE=15, DOMAIN=10, AVAILABILITY=5.
Hard groups score full credit only after *every* hard criterion passes. Preferred
skills score their satisfied fraction and cannot affect eligibility. An unresolved
preferred skill counts as an unmet preference. No unspecified group earns points.
Optional caller-configured DATA_FRESHNESS=5 decays with a 180-day half-life using
the oldest contributing observation; it never creates eligibility or new facts.
Weights normalize across active groups to exactly 1,000,000 integer units (100
points, four decimals). Floored factor points are summed as the actual published
Python float, avoiding a separately rounded score that differs from factor sums.
Ties sort by candidate UUID. AVAILABLE_SOON includes AVAILABLE now. Latest verified
observation wins per fact key; equal-time conflicting observations fail closed.

This is a fixture-tested engine, not a W1 database adapter or deployed search.
Authorization and hard filters must also run in SQL before retrieval in that
future adapter; this module repeats them before any ranking or top-k selection.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import AwareDatetime, ConfigDict, Field

from app.ai.gateway import (
    EvidenceBlock,
    EvidenceContext,
    EvidenceKey,
    EvidenceRef,
    StrictModel,
    _evidence_ref_failure,
    _trusted_evidence_index,
)
from app.people_search.intent_models import ResolvedSearchIntent, ResolvedSkill

SCORE_VERSION = "people-search-canonical-v1"
FactorCode = Literal[
    "REQUIRED_SKILL", "PREFERRED_SKILL", "EXPERIENCE", "DOMAIN", "AVAILABILITY", "DATA_FRESHNESS"
]
_WEIGHTS: dict[FactorCode, int] = {
    "REQUIRED_SKILL": 40,
    "PREFERRED_SKILL": 30,
    "EXPERIENCE": 15,
    "DOMAIN": 10,
    "AVAILABILITY": 5,
    "DATA_FRESHNESS": 5,
}


class RankingNeedsClarification(ValueError):
    """Intent has unresolved required or not-yet-supported semantics."""


class RankingEvidenceError(ValueError):
    """Trusted context or candidate identity is internally inconsistent."""


class _Fact(StrictModel):
    model_config = ConfigDict(extra="forbid", strict=True, frozen=True)

    observed_at: AwareDatetime
    provenance: Literal["VERIFIED_CANONICAL", "SELF_ASSERTED", "UNVERIFIED"]
    evidence_refs: tuple[EvidenceRef, ...] = Field(default=(), max_length=10)


class SkillFact(_Fact):
    canonical_skill_id: UUID
    level: int | None = Field(default=None, ge=1, le=5)
    years: float | None = Field(default=None, ge=0, le=60, allow_inf_nan=False)


class DomainFact(_Fact):
    domain: str = Field(min_length=1, max_length=200)


class AvailabilityFact(_Fact):
    availability: Literal["AVAILABLE", "AVAILABLE_SOON", "UNAVAILABLE"]


class ExperienceFact(_Fact):
    years: float = Field(ge=0, le=60, allow_inf_nan=False)


StaffingFact = SkillFact | DomainFact | AvailabilityFact | ExperienceFact


@dataclass(frozen=True, slots=True)
class StaffingCandidate:
    """Authorized projection; employment fields are eligibility gates, not citations."""

    candidate_id: UUID
    tenant_id: UUID
    user_active: bool
    active_employment: bool
    employment_started_at: datetime
    employment_ended_at: datetime | None
    facts: tuple[StaffingFact, ...] = ()


@dataclass(frozen=True, slots=True)
class CanonicalScoreFactor:
    code: FactorCode
    points: float
    maximum_points: float
    evidence_refs: tuple[EvidenceRef, ...]


@dataclass(frozen=True, slots=True)
class CanonicalMatch:
    candidate_id: UUID
    score: float
    score_factors: tuple[CanonicalScoreFactor, ...]
    evidence_refs: tuple[EvidenceRef, ...]
    data_freshness_at: datetime
    score_version: str = SCORE_VERSION


def _key(fact: StaffingFact) -> tuple[str, str]:
    if isinstance(fact, SkillFact):
        return "skill", str(fact.canonical_skill_id)
    if isinstance(fact, DomainFact):
        return "domain", fact.domain.strip().casefold()
    return type(fact).__name__, ""


def _verified_facts(
    candidate: StaffingCandidate,
    context: EvidenceContext,
    index: Mapping[EvidenceKey, EvidenceBlock],
    now: datetime,
) -> tuple[StaffingFact, ...]:
    grouped: dict[tuple[str, str], list[StaffingFact]] = {}
    for fact in candidate.facts:
        if (
            fact.provenance != "VERIFIED_CANONICAL"
            or not fact.evidence_refs
            or fact.observed_at > now
        ):
            continue
        if any(
            _evidence_ref_failure(ref, candidate.candidate_id, context.tenant_id, index) is not None
            for ref in fact.evidence_refs
        ):
            continue
        grouped.setdefault(_key(fact), []).append(fact)
    result: list[StaffingFact] = []
    for key in sorted(grouped):
        facts = grouped[key]
        latest = max(f.observed_at for f in facts)
        current = [f for f in facts if f.observed_at == latest]
        # Conflicting current values cannot be arbitrarily selected by input order.
        payloads = {f.model_dump_json(exclude={"evidence_refs"}) for f in current}
        if len(payloads) == 1:
            result.append(min(current, key=lambda f: f.model_dump_json()))
    return tuple(result)


def _skill_matches(fact: SkillFact, constraint: ResolvedSkill) -> bool:
    return (
        fact.canonical_skill_id == constraint.canonical_skill_id
        and (
            constraint.minimum_level is None
            or fact.level is not None
            and fact.level >= constraint.minimum_level
        )
        and (
            constraint.minimum_years is None
            or fact.years is not None
            and (
                fact.years > constraint.minimum_years
                if constraint.minimum_years_exclusive
                else fact.years >= constraint.minimum_years
            )
        )
    )


def _refs(facts: Iterable[StaffingFact]) -> tuple[EvidenceRef, ...]:
    refs = {ref.model_dump_json(): ref for fact in facts for ref in fact.evidence_refs}
    return tuple(refs[key] for key in sorted(refs))


def _eligible(candidate: StaffingCandidate, context: EvidenceContext, now: datetime) -> bool:
    start, end = candidate.employment_started_at, candidate.employment_ended_at
    return (
        candidate.tenant_id == context.tenant_id
        and candidate.candidate_id in context.allowed_entity_ids
        and candidate.user_active
        and candidate.active_employment
        and start.tzinfo is not None
        and start.utcoffset() is not None
        and start <= now
        and (end is None or (end.tzinfo is not None and end.utcoffset() is not None and end > now))
    )


def _score(
    candidate: StaffingCandidate,
    intent: ResolvedSearchIntent,
    facts: tuple[StaffingFact, ...],
    *,
    now: datetime,
    include_freshness: bool,
) -> CanonicalMatch | None:
    groups: dict[FactorCode, tuple[float, tuple[StaffingFact, ...]]] = {}
    skills = [f for f in facts if isinstance(f, SkillFact)]
    for required in (True, False):
        constraints = [s for s in intent.skills if s.required == required]
        denominator = len(constraints) + (
            0 if required else len(intent.unresolved_preferred_skills)
        )
        if not denominator:
            continue
        matches = tuple(f for s in constraints for f in skills if _skill_matches(f, s))
        if required and len(matches) != denominator:
            return None
        factor_code: FactorCode = "REQUIRED_SKILL" if required else "PREFERRED_SKILL"
        groups[factor_code] = (len(matches) / denominator, matches)
    if intent.minimum_total_years is not None:
        experience = tuple(
            f
            for f in facts
            if isinstance(f, ExperienceFact)
            and (
                f.years > intent.minimum_total_years
                if intent.minimum_total_years_exclusive
                else f.years >= intent.minimum_total_years
            )
        )
        if not experience:
            return None
        groups["EXPERIENCE"] = (1.0, experience)
    if intent.required_domains:
        domains = {d.strip().casefold() for d in intent.required_domains}
        matched_domains = tuple(
            f for f in facts if isinstance(f, DomainFact) and f.domain.strip().casefold() in domains
        )
        if len(matched_domains) != len(domains):
            return None
        groups["DOMAIN"] = (1.0, matched_domains)
    if intent.availability != "ANY":
        availability = tuple(
            f
            for f in facts
            if isinstance(f, AvailabilityFact)
            and (
                f.availability == intent.availability
                or intent.availability == "AVAILABLE_SOON"
                and f.availability == "AVAILABLE"
            )
        )
        if not availability:
            return None
        groups["AVAILABILITY"] = (1.0, availability)
    contributing = tuple(f for _, fs in groups.values() for f in fs)
    if not groups or not facts:
        return None
    # A missing preferred skill never excludes a source-backed person. In a
    # preferred-only zero match, refs establish record provenance, not a match.
    cited = contributing or facts
    freshness_at = min(f.observed_at for f in cited)
    if include_freshness and contributing:
        age_days = (now - freshness_at).total_seconds() / 86400
        groups["DATA_FRESHNESS"] = (0.5 ** (age_days / 180), contributing)
    active_codes = [code for code in _WEIGHTS if code in groups]
    weight_sum = sum(_WEIGHTS[code] for code in active_codes)
    maximum_units = {code: 1_000_000 * _WEIGHTS[code] // weight_sum for code in active_codes}
    for code in active_codes[: 1_000_000 - sum(maximum_units.values())]:
        maximum_units[code] += 1
    factors = tuple(
        CanonicalScoreFactor(
            code=code,
            points=int(maximum_units[code] * groups[code][0]) / 10_000,
            maximum_points=maximum_units[code] / 10_000,
            evidence_refs=_refs(groups[code][1]),
        )
        for code in active_codes
    )
    score = sum(f.points for f in factors)
    if not 0 <= score <= 100:
        raise RankingEvidenceError("score_out_of_range")
    return CanonicalMatch(candidate.candidate_id, score, factors, _refs(cited), freshness_at)


def rank_candidates(
    candidates: Iterable[StaffingCandidate],
    intent: ResolvedSearchIntent,
    *,
    context: EvidenceContext,
    now: datetime,
    limit: int = 25,
    include_freshness: bool = False,
) -> tuple[CanonicalMatch, ...]:
    """Filter all input candidates before scoring/sorting/top-k; never truncate retrieval.

    Unsupported intent requires explicit clarification. Invalid individual facts
    are absent; invalid global evidence contexts reject the invocation. ``now``
    must be injected and timezone-aware. No provider, SQL, writes, or PII traces.
    """
    if now.tzinfo is None or now.utcoffset() is None:
        raise ValueError("now must be timezone-aware")
    if isinstance(limit, bool) or not isinstance(limit, int) or not 1 <= limit <= 100:
        raise ValueError("limit must be between 1 and 100")
    if (
        intent.unresolved_required_skills
        or intent.unresolved_required_domains
        or intent.unsupported_constraints
        or intent.soft_preferences
        or intent.title_keywords
    ):
        raise RankingNeedsClarification("unresolved_or_unsupported_search_constraints")
    index, failure = _trusted_evidence_index(context)
    if failure:
        raise RankingEvidenceError(failure)
    matches: list[CanonicalMatch] = []
    seen: set[UUID] = set()
    for candidate in candidates:
        if not _eligible(candidate, context, now):
            continue
        if candidate.candidate_id in seen:
            raise RankingEvidenceError("duplicate_candidate_id")
        seen.add(candidate.candidate_id)
        facts = _verified_facts(candidate, context, index, now)
        match = _score(candidate, intent, facts, now=now, include_freshness=include_freshness)
        if match is not None:
            matches.append(match)
    return tuple(sorted(matches, key=lambda m: (-m.score, m.candidate_id.int))[:limit])
