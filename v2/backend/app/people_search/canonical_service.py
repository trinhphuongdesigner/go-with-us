"""Internal canonical search orchestration; no providers, persistence, or public schemas.

The default explicitly reports unavailable W1 data. An injected repository can
exercise the complete canonical flow, but remains responsible for verified fact
values and permission allowlists. This service binds its tenant/actor context to
the authenticated caller, validates profile identity and immutable citations,
then runs the deterministic engine and returns only selected profile labels.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Literal
from uuid import UUID

from app.ai.gateway import EvidenceContext, _evidence_ref_failure, _trusted_evidence_index
from app.people_search.canonical_ranking import (
    AvailabilityFact,
    CanonicalMatch,
    DomainFact,
    ExperienceFact,
    RankingEvidenceError,
    RankingNeedsClarification,
    SkillFact,
    _eligible,
    _verified_facts,
    rank_candidates,
)
from app.people_search.canonical_repository import (
    CandidateProfile,
    CanonicalCandidateBatch,
    CanonicalRepository,
    UnavailableCanonicalRepository,
)
from app.people_search.intent_models import ResolvedSearchIntent


@dataclass(frozen=True, slots=True)
class CanonicalSearchResult:
    status: Literal["ok", "empty", "insufficient_evidence", "needs_clarification"]
    matches: tuple[CanonicalMatch, ...] = ()
    profiles: tuple[CandidateProfile, ...] = ()
    reason_code: str | None = None


def _batch_issue(batch: CanonicalCandidateBatch, tenant_id: UUID, actor_id: UUID) -> str | None:
    if batch.context.tenant_id != tenant_id or batch.context.actor_id != actor_id:
        return "CANONICAL_CONTEXT_INVALID"
    candidates = {candidate.candidate_id: candidate for candidate in batch.candidates}
    if len(candidates) != len(batch.candidates) or any(
        candidate.tenant_id != tenant_id for candidate in batch.candidates
    ):
        return "CANONICAL_CANDIDATES_INVALID"
    profiles = {profile.candidate_id: profile for profile in batch.profiles}
    if (
        len(profiles) != len(batch.profiles)
        or profiles.keys() != candidates.keys()
        or any(
            profile.tenant_id != tenant_id or not profile.name.strip() for profile in batch.profiles
        )
    ):
        return "CANONICAL_PROFILES_INVALID"
    return None


def _evidence_issue(
    batch: CanonicalCandidateBatch, intent: ResolvedSearchIntent, now: datetime
) -> str | None:
    index, failure = _trusted_evidence_index(batch.context)
    if failure is not None:
        return "CANONICAL_EVIDENCE_INVALID"
    required_skills = [skill for skill in intent.skills if skill.required]
    required_domains = {domain.strip().casefold() for domain in intent.required_domains}
    for candidate in batch.candidates:
        if not _eligible(candidate, batch.context, now):
            continue
        for fact in candidate.facts:
            # Missing optional facts and unverified/future observations are not
            # attributed. An explicitly verified fact with broken refs is invalid.
            if fact.provenance != "VERIFIED_CANONICAL" or fact.observed_at > now:
                continue
            if not fact.evidence_refs or any(
                _evidence_ref_failure(ref, candidate.candidate_id, batch.context.tenant_id, index)
                is not None
                for ref in fact.evidence_refs
            ):
                return "CANONICAL_EVIDENCE_INVALID"
        facts = _verified_facts(candidate, batch.context, index, now)
        skills = [fact for fact in facts if isinstance(fact, SkillFact)]
        if any(
            not any(
                fact.canonical_skill_id == required.canonical_skill_id
                and (required.minimum_years is None or fact.years is not None)
                and (required.minimum_level is None or fact.level is not None)
                for fact in skills
            )
            for required in required_skills
        ):
            return "CANONICAL_EVIDENCE_UNAVAILABLE"
        domains = {fact.domain.strip().casefold() for fact in facts if isinstance(fact, DomainFact)}
        if not required_domains.issubset(domains):
            return "CANONICAL_EVIDENCE_UNAVAILABLE"
        if intent.minimum_total_years is not None and not any(
            isinstance(fact, ExperienceFact) for fact in facts
        ):
            return "CANONICAL_EVIDENCE_UNAVAILABLE"
        if intent.availability != "ANY" and not any(
            isinstance(fact, AvailabilityFact) for fact in facts
        ):
            return "CANONICAL_EVIDENCE_UNAVAILABLE"
    return None


class CanonicalSearchService:
    def __init__(self, repository: CanonicalRepository) -> None:
        self._repository = repository

    async def search(
        self,
        intent: ResolvedSearchIntent,
        *,
        tenant_id: UUID,
        actor_id: UUID,
        now: datetime,
        limit: int = 25,
    ) -> CanonicalSearchResult:
        # Use the same intent/time/limit validation as the engine before any
        # retrieval, so unresolved hard criteria never become an empty search.
        try:
            rank_candidates(
                (),
                intent,
                context=EvidenceContext(tenant_id=tenant_id, actor_id=actor_id),
                now=now,
                limit=limit,
            )
        except RankingNeedsClarification:
            return CanonicalSearchResult(
                "needs_clarification", reason_code="CANONICAL_INTENT_UNRESOLVED"
            )

        batch = await self._repository.load(intent, tenant_id=tenant_id, actor_id=actor_id)
        if batch is None:
            return CanonicalSearchResult(
                "insufficient_evidence", reason_code="CANONICAL_DATA_UNAVAILABLE"
            )
        issue = _batch_issue(batch, tenant_id, actor_id) or _evidence_issue(batch, intent, now)
        if issue is not None:
            return CanonicalSearchResult("insufficient_evidence", reason_code=issue)
        try:
            matches = rank_candidates(
                batch.candidates, intent, context=batch.context, now=now, limit=limit
            )
        except RankingNeedsClarification:
            return CanonicalSearchResult(
                "needs_clarification", reason_code="CANONICAL_INTENT_UNRESOLVED"
            )
        except RankingEvidenceError:
            return CanonicalSearchResult(
                "insufficient_evidence", reason_code="CANONICAL_EVIDENCE_INVALID"
            )
        if not matches:
            return CanonicalSearchResult("empty")
        profiles = {profile.candidate_id: profile for profile in batch.profiles}
        return CanonicalSearchResult(
            "ok",
            matches=matches,
            profiles=tuple(profiles[match.candidate_id] for match in matches),
        )


def get_canonical_search_service() -> CanonicalSearchService:
    """Inject a real canonical repository when W1 is available; never fake its data."""
    return CanonicalSearchService(UnavailableCanonicalRepository())
