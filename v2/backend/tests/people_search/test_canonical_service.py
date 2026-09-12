"""Canonical orchestration with synthetic plaintext evidence and the real ranker."""

import hashlib
from dataclasses import FrozenInstanceError, replace
from datetime import UTC, datetime, timedelta
from importlib.util import find_spec
from uuid import UUID

import pytest

from app.ai.gateway import EvidenceBlock, EvidenceContext, EvidenceRef
from app.people_search.canonical_ranking import (
    AvailabilityFact,
    DomainFact,
    ExperienceFact,
    SkillFact,
    StaffingCandidate,
)
from app.people_search.intent_models import ResolvedSearchIntent, ResolvedSkill

TENANT, ACTOR, REACT = UUID(int=1), UUID(int=2), UUID(int=3)
NOW = datetime(2026, 9, 12, tzinfo=UTC)


def test_canonical_service_exists():
    assert find_spec("app.people_search.canonical_service") is not None


class SyntheticRepository:
    def __init__(self, batch):
        self.batch = batch
        self.calls = []

    async def load(self, intent, *, tenant_id, actor_id):
        self.calls.append((intent, tenant_id, actor_id))
        return self.batch


@pytest.fixture
def plan():
    return ResolvedSearchIntent(
        skills=[
            ResolvedSkill(
                canonical_skill_id=REACT,
                name="React",
                required=True,
                minimum_years=2.0,
                minimum_years_exclusive=True,
            )
        ],
        required_domains=["real-estate"],
    )


@pytest.fixture
def batch_factory():
    from app.people_search.canonical_repository import CandidateProfile, CanonicalCandidateBatch

    def make(years=(2.1,), *, allowed=None):
        candidates, profiles, blocks = [], [], []
        for offset, value in enumerate(years):
            identifier = UUID(int=100 + offset)
            source_id = UUID(int=1000 + offset)
            text = f"Verified React experience: {value} years. Domain: real-estate."
            block = EvidenceBlock(
                subject_id=identifier,
                tenant_id=TENANT,
                source_id=source_id,
                source_version_id=source_id,
                block_id=source_id,
                text=text,
            )
            ref = EvidenceRef(
                subject_id=identifier,
                tenant_id=TENANT,
                source_id=source_id,
                source_version_id=source_id,
                block_id=source_id,
                char_start=0,
                char_end=len(text),
                quote=text,
                quote_sha256=hashlib.sha256(text.encode()).hexdigest(),
            )
            shared = {
                "observed_at": NOW,
                "provenance": "VERIFIED_CANONICAL",
                "evidence_refs": (ref,),
            }
            candidates.append(
                StaffingCandidate(
                    candidate_id=identifier,
                    tenant_id=TENANT,
                    user_active=True,
                    active_employment=True,
                    employment_started_at=NOW - timedelta(days=1000),
                    employment_ended_at=None,
                    facts=(
                        SkillFact(canonical_skill_id=REACT, years=value, **shared),
                        DomainFact(domain="real-estate", **shared),
                    ),
                )
            )
            profiles.append(
                CandidateProfile(identifier, TENANT, f"Synthetic Person {offset}", "Developer")
            )
            if allowed is None or identifier in allowed:
                blocks.append(block)
        context = EvidenceContext(
            tenant_id=TENANT,
            actor_id=ACTOR,
            evidence_blocks=tuple(blocks),
            allowed_entity_ids=frozenset(c.candidate_id for c in candidates)
            if allowed is None
            else allowed,
        )
        return CanonicalCandidateBatch(tuple(candidates), tuple(profiles), context)

    return make


async def search(batch, plan, **kwargs):
    from app.people_search.canonical_service import CanonicalSearchService

    repository = SyntheticRepository(batch)
    result = await CanonicalSearchService(repository).search(
        plan,
        tenant_id=TENANT,
        actor_id=ACTOR,
        now=NOW,
        **kwargs,
    )
    return result, repository


async def test_synthetic_reference_flow_uses_real_ranking(batch_factory, plan):
    batch = batch_factory((2.0, 2.1))
    result, repository = await search(batch, plan)
    assert result.status == "ok"
    assert result.reason_code is None
    assert [m.candidate_id for m in result.matches] == [batch.candidates[1].candidate_id]
    assert result.profiles == (batch.profiles[1],)
    assert result.matches[0].score == sum(f.points for f in result.matches[0].score_factors)
    assert result.matches[0].evidence_refs
    assert repository.calls == [(plan, TENANT, ACTOR)]


async def test_default_unavailable_is_not_valid_empty(plan):
    from app.people_search.canonical_service import get_canonical_search_service

    result = await get_canonical_search_service().search(
        plan,
        tenant_id=TENANT,
        actor_id=ACTOR,
        now=NOW,
    )
    assert result.status == "insufficient_evidence"
    assert result.reason_code == "CANONICAL_DATA_UNAVAILABLE"
    assert result.matches == result.profiles == ()


async def test_valid_empty_batch_reports_empty(batch_factory, plan):
    result, _ = await search(batch_factory(()), plan)
    assert result.status == "empty"
    assert result.matches == result.profiles == ()


async def test_supported_hard_filter_miss_is_valid_empty(batch_factory, plan):
    result, _ = await search(batch_factory((1.0, 2.0)), plan)
    assert result.status == "empty"
    assert result.matches == result.profiles == ()


async def test_partial_required_evidence_is_insufficient_not_empty(batch_factory, plan):
    """A domain fact cannot prove missing required React is a negative result."""
    batch = batch_factory()
    candidate = batch.candidates[0]
    domain_only = replace(candidate, facts=(candidate.facts[1],))

    result, _ = await search(replace(batch, candidates=(domain_only,)), plan)

    assert result.status == "insufficient_evidence"
    assert result.reason_code == "CANONICAL_EVIDENCE_UNAVAILABLE"
    assert result.matches == result.profiles == ()


@pytest.mark.parametrize("fact_state", ["future", "conflicting"])
async def test_unusable_required_skill_fact_is_unknown(batch_factory, plan, fact_state):
    batch = batch_factory()
    candidate = batch.candidates[0]
    skill, domain = candidate.facts
    if fact_state == "future":
        future = skill.model_copy(update={"observed_at": NOW + timedelta(seconds=1)})
        facts = (future, domain)
    else:
        facts = (skill, skill.model_copy(update={"years": 4.0}), domain)

    result, _ = await search(
        replace(batch, candidates=(replace(candidate, facts=facts),)), plan
    )

    assert result.status == "insufficient_evidence"
    assert result.reason_code == "CANONICAL_EVIDENCE_UNAVAILABLE"


async def test_one_incomplete_eligible_candidate_fails_closed(batch_factory, plan):
    batch = batch_factory((3.0, 3.0))
    second = batch.candidates[1]
    incomplete = replace(second, facts=(second.facts[1],))

    result, _ = await search(
        replace(batch, candidates=(batch.candidates[0], incomplete)), plan
    )

    assert result.status == "insufficient_evidence"
    assert result.matches == result.profiles == ()


@pytest.mark.parametrize("required_fact", ["domain", "availability", "experience"])
async def test_missing_required_fact_is_unknown(batch_factory, plan, required_fact):
    batch = batch_factory()
    candidate = batch.candidates[0]
    skill = candidate.facts[0]
    if required_fact == "domain":
        intent = plan
        facts = (skill,)
    elif required_fact == "availability":
        intent = plan.model_copy(
            update={"required_domains": [], "availability": "AVAILABLE"}
        )
        facts = (skill,)
    else:
        intent = plan.model_copy(
            update={"required_domains": [], "minimum_total_years": 2.0}
        )
        facts = (skill,)

    result, _ = await search(
        replace(batch, candidates=(replace(candidate, facts=facts),)), intent
    )

    assert result.status == "insufficient_evidence"
    assert result.reason_code == "CANONICAL_EVIDENCE_UNAVAILABLE"


@pytest.mark.parametrize("required_fact", ["domain", "availability", "experience"])
async def test_future_or_conflicting_required_fact_is_unknown(
    batch_factory, plan, required_fact
):
    batch = batch_factory()
    candidate = batch.candidates[0]
    skill, domain = candidate.facts
    shared = {
        "observed_at": NOW,
        "provenance": "VERIFIED_CANONICAL",
        "evidence_refs": skill.evidence_refs,
    }
    if required_fact == "domain":
        intent = plan
        facts = (
            skill,
            domain.model_copy(update={"observed_at": NOW + timedelta(seconds=1)}),
        )
    elif required_fact == "availability":
        intent = plan.model_copy(
            update={"required_domains": [], "availability": "AVAILABLE"}
        )
        facts = (
            skill,
            AvailabilityFact(availability="AVAILABLE", **shared),
            AvailabilityFact(availability="UNAVAILABLE", **shared),
        )
    else:
        intent = plan.model_copy(
            update={"required_domains": [], "minimum_total_years": 2.0}
        )
        facts = (
            skill,
            ExperienceFact(years=3.0, **shared),
            ExperienceFact(years=4.0, **shared),
        )

    result, _ = await search(
        replace(batch, candidates=(replace(candidate, facts=facts),)), intent
    )

    assert result.status == "insufficient_evidence"
    assert result.reason_code == "CANONICAL_EVIDENCE_UNAVAILABLE"


@pytest.mark.parametrize("required_fact", ["availability", "experience"])
async def test_known_below_threshold_other_required_fact_is_empty(
    batch_factory, plan, required_fact
):
    batch = batch_factory()
    candidate = batch.candidates[0]
    skill = candidate.facts[0]
    shared = {
        "observed_at": NOW,
        "provenance": "VERIFIED_CANONICAL",
        "evidence_refs": skill.evidence_refs,
    }
    if required_fact == "availability":
        intent = plan.model_copy(
            update={"required_domains": [], "availability": "AVAILABLE"}
        )
        fact = AvailabilityFact(availability="UNAVAILABLE", **shared)
    else:
        intent = plan.model_copy(
            update={"required_domains": [], "minimum_total_years": 2.0}
        )
        fact = ExperienceFact(years=1.9, **shared)

    result, _ = await search(
        replace(batch, candidates=(replace(candidate, facts=(skill, fact)),)), intent
    )

    assert result.status == "empty"


async def test_missing_only_optional_facts_does_not_taint_empty_batch(batch_factory):
    batch = batch_factory()
    candidate = replace(batch.candidates[0], facts=())
    optional_only = ResolvedSearchIntent(
        skills=[
            ResolvedSkill(
                canonical_skill_id=UUID(int=999), name="Python", required=False
            )
        ]
    )

    result, _ = await search(replace(batch, candidates=(candidate,)), optional_only)

    assert result.status == "empty"
    assert result.reason_code is None


@pytest.mark.parametrize("field", ["tenant_id", "actor_id"])
async def test_adapter_cannot_change_caller_context(batch_factory, plan, field):
    batch = batch_factory()
    batch = replace(batch, context=batch.context.model_copy(update={field: UUID(int=999)}))
    result, _ = await search(batch, plan)
    assert result.status == "insufficient_evidence"
    assert result.reason_code == "CANONICAL_CONTEXT_INVALID"
    assert result.matches == result.profiles == ()


@pytest.mark.parametrize("invalid", ["missing", "duplicate", "orphan", "foreign", "blank_name"])
async def test_profile_binding_failure_exposes_nothing(batch_factory, plan, invalid):
    batch = batch_factory()
    profile = batch.profiles[0]
    profiles = {
        "missing": (),
        "duplicate": (profile, profile),
        "orphan": (replace(profile, candidate_id=UUID(int=999)),),
        "foreign": (replace(profile, tenant_id=UUID(int=999)),),
        "blank_name": (replace(profile, name=" "),),
    }
    result, _ = await search(replace(batch, profiles=profiles[invalid]), plan)
    assert result.status == "insufficient_evidence"
    assert result.reason_code == "CANONICAL_PROFILES_INVALID"
    assert result.matches == result.profiles == ()


async def test_duplicate_candidate_identity_exposes_nothing(batch_factory, plan):
    batch = batch_factory()
    batch = replace(batch, candidates=(*batch.candidates, batch.candidates[0]))
    result, _ = await search(batch, plan)
    assert result.status == "insufficient_evidence"
    assert result.matches == result.profiles == ()


async def test_foreign_tenant_candidate_exposes_nothing(batch_factory, plan):
    batch = batch_factory()
    batch = replace(batch, candidates=(replace(batch.candidates[0], tenant_id=UUID(int=99)),))
    result, _ = await search(batch, plan)
    assert result.status == "insufficient_evidence"
    assert result.matches == result.profiles == ()


async def test_unauthorized_candidate_needs_no_facts_and_never_exposes_label(batch_factory, plan):
    batch = batch_factory((3.0, 3.0), allowed=frozenset({UUID(int=100)}))
    excluded = replace(batch.candidates[1], facts=())
    batch = replace(batch, candidates=(batch.candidates[0], excluded))
    result, _ = await search(batch, plan)
    assert result.status == "ok"
    assert result.profiles == (batch.profiles[0],)
    assert [m.candidate_id for m in result.matches] == [batch.candidates[0].candidate_id]


async def test_ended_employment_is_excluded_without_requiring_facts(batch_factory, plan):
    batch = batch_factory((3.0, 3.0))
    ended = replace(batch.candidates[1], facts=(), employment_ended_at=NOW)
    result, _ = await search(replace(batch, candidates=(batch.candidates[0], ended)), plan)
    assert result.status == "ok"
    assert result.profiles == (batch.profiles[0],)


@pytest.mark.parametrize(
    "invalid", ["missing_blocks", "duplicate_block", "bad_quote", "foreign_subject"]
)
async def test_invalid_source_fails_closed(batch_factory, plan, invalid):
    batch = batch_factory()
    if invalid == "missing_blocks":
        batch = replace(batch, context=batch.context.model_copy(update={"evidence_blocks": ()}))
    elif invalid == "duplicate_block":
        batch = replace(
            batch,
            context=batch.context.model_copy(
                update={
                    "evidence_blocks": (
                        *batch.context.evidence_blocks,
                        batch.context.evidence_blocks[0],
                    ),
                }
            ),
        )
    else:
        candidate = batch.candidates[0]
        skill = candidate.facts[0]
        update = (
            {"quote": "fabricated"} if invalid == "bad_quote" else {"subject_id": UUID(int=999)}
        )
        ref = skill.evidence_refs[0].model_copy(update=update)
        skill = skill.model_copy(update={"evidence_refs": (ref,)})
        batch = replace(batch, candidates=(replace(candidate, facts=(skill, candidate.facts[1])),))
    result, _ = await search(batch, plan)
    assert result.status == "insufficient_evidence"
    assert result.reason_code == "CANONICAL_EVIDENCE_INVALID"
    assert result.matches == result.profiles == ()


async def test_no_immutable_facts_is_insufficient_evidence(batch_factory, plan):
    batch = batch_factory()
    batch = replace(batch, candidates=(replace(batch.candidates[0], facts=()),))
    result, _ = await search(batch, plan)
    assert result.status == "insufficient_evidence"
    assert result.reason_code == "CANONICAL_EVIDENCE_UNAVAILABLE"
    assert result.matches == result.profiles == ()


async def test_missing_optional_fact_does_not_block_valid_required_match(batch_factory, plan):
    batch = batch_factory()
    optional = ResolvedSkill(canonical_skill_id=UUID(int=999), name="Python", required=False)
    plan = plan.model_copy(update={"skills": [*plan.skills, optional]})
    result, _ = await search(batch, plan)
    assert result.status == "ok"
    assert result.matches[0].score < 100


async def test_unverified_optional_fact_is_not_attributed_or_scored(batch_factory, plan):
    batch = batch_factory()
    candidate = batch.candidates[0]
    optional = SkillFact(
        canonical_skill_id=UUID(int=999),
        years=10.0,
        observed_at=NOW,
        provenance="UNVERIFIED",
        evidence_refs=(),
    )
    batch = replace(batch, candidates=(replace(candidate, facts=(*candidate.facts, optional)),))
    plan = plan.model_copy(
        update={
            "skills": [
                *plan.skills,
                ResolvedSkill(
                    canonical_skill_id=UUID(int=999),
                    name="Python",
                    required=False,
                ),
            ]
        }
    )
    result, _ = await search(batch, plan)
    assert result.status == "ok"
    factor = next(f for f in result.matches[0].score_factors if f.code == "PREFERRED_SKILL")
    assert factor.points == 0
    assert factor.evidence_refs == ()


@pytest.mark.parametrize("provenance", ["UNVERIFIED", "SELF_ASSERTED"])
async def test_only_unverified_facts_do_not_become_valid_empty(batch_factory, plan, provenance):
    batch = batch_factory()
    candidate = batch.candidates[0]
    candidate = replace(
        candidate,
        facts=tuple(f.model_copy(update={"provenance": provenance}) for f in candidate.facts),
    )
    result, _ = await search(replace(batch, candidates=(candidate,)), plan)
    assert result.status == "insufficient_evidence"
    assert result.reason_code == "CANONICAL_EVIDENCE_UNAVAILABLE"
    assert result.matches == result.profiles == ()


async def test_invalid_source_cannot_leak_other_valid_candidate(batch_factory, plan):
    batch = batch_factory((3.0, 3.0))
    broken = batch.candidates[1]
    bad_fact = broken.facts[0].model_copy(update={"evidence_refs": ()})
    broken = replace(broken, facts=(bad_fact, broken.facts[1]))
    result, _ = await search(replace(batch, candidates=(batch.candidates[0], broken)), plan)
    assert result.status == "insufficient_evidence"
    assert result.matches == result.profiles == ()


async def test_service_result_is_frozen(batch_factory, plan):
    result, _ = await search(batch_factory(), plan)
    with pytest.raises(FrozenInstanceError):
        result.profiles = ()


async def test_hard_filters_run_before_top_k_including_after_25(batch_factory, plan):
    batch = batch_factory((*([1.0] * 30), 3.0))
    result, _ = await search(batch, plan, limit=1)
    assert result.status == "ok"
    assert result.profiles == (batch.profiles[30],)


@pytest.mark.parametrize(
    "field",
    ["unresolved_required_skills", "unresolved_required_domains", "unsupported_constraints"],
)
async def test_clarification_precedes_repository_access(plan, field):
    plan = plan.model_copy(update={field: ["unknown"]})
    result, repository = await search(None, plan)
    assert result.status == "needs_clarification"
    assert result.reason_code == "CANONICAL_INTENT_UNRESOLVED"
    assert result.matches == result.profiles == ()
    assert repository.calls == []


async def test_unexpected_repository_bug_is_not_swallowed(plan):
    from app.people_search.canonical_service import CanonicalSearchService

    class BrokenRepository:
        async def load(self, intent, *, tenant_id, actor_id):
            raise RuntimeError("synthetic programming failure")

    with pytest.raises(RuntimeError, match="synthetic programming failure"):
        await CanonicalSearchService(BrokenRepository()).search(
            plan,
            tenant_id=TENANT,
            actor_id=ACTOR,
            now=NOW,
        )


async def test_invalid_clock_propagates_as_programming_error(plan):
    from app.people_search.canonical_service import CanonicalSearchService

    with pytest.raises(ValueError, match="timezone"):
        await CanonicalSearchService(SyntheticRepository(None)).search(
            plan,
            tenant_id=TENANT,
            actor_id=ACTOR,
            now=NOW.replace(tzinfo=None),
        )
