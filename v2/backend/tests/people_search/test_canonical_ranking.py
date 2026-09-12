"""Synthetic immutable-source reference flow; no production HR or provider calls."""

import hashlib
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from importlib.util import find_spec
from uuid import UUID

import pytest
from pydantic import ValidationError

from app.ai.gateway import EvidenceBlock, EvidenceContext, EvidenceRef
from app.people_search.intent_models import ResolvedSearchIntent, ResolvedSkill

NOW = datetime(2026, 9, 12, tzinfo=UTC)
TENANT = UUID(int=1)
REACT = UUID(int=10)
PYTHON = UUID(int=11)


def test_canonical_engine_exists():
    assert find_spec("app.people_search.canonical_ranking") is not None


@pytest.fixture
def engine():
    from app.people_search import canonical_ranking

    return canonical_ranking


@pytest.fixture
def source():
    blocks = []

    def make(subject, text="Verified React experience: 3 years; level 4."):
        identifier = UUID(int=1000 + len(blocks))
        block = EvidenceBlock(
            subject_id=subject,
            tenant_id=TENANT,
            source_id=identifier,
            source_version_id=identifier,
            block_id=identifier,
            text=text,
        )
        blocks.append(block)
        return EvidenceRef(
            subject_id=subject,
            tenant_id=TENANT,
            source_id=identifier,
            source_version_id=identifier,
            block_id=identifier,
            char_start=0,
            char_end=len(text),
            quote=text,
            quote_sha256=hashlib.sha256(text.encode()).hexdigest(),
        )

    make.blocks = blocks
    return make


def context(source, candidates):
    return EvidenceContext(
        tenant_id=TENANT,
        actor_id=UUID(int=2),
        evidence_blocks=tuple(source.blocks),
        allowed_entity_ids=frozenset(c.candidate_id for c in candidates),
    )


def candidate(
    engine,
    source,
    identifier=100,
    *,
    skills=(REACT,),
    domain=True,
    availability="AVAILABLE",
    years=3.0,
    level=4,
    observed_at=NOW,
):
    subject = UUID(int=identifier)
    shared = {"observed_at": observed_at, "provenance": "VERIFIED_CANONICAL"}
    facts = [
        engine.SkillFact(
            canonical_skill_id=skill,
            level=level,
            years=years,
            evidence_refs=(
                source(
                    subject,
                    (
                        f"Verified { {REACT: 'React', PYTHON: 'Python'}.get(skill, str(skill)) } "
                        f"experience: {years if years is not None else 'not recorded'} years; "
                        f"level {level if level is not None else 'not recorded'}."
                    ),
                ),
            ),
            **shared,
        )
        for skill in skills
    ]
    if domain:
        facts.append(
            engine.DomainFact(
                domain="real-estate",
                evidence_refs=(source(subject, "Worked in real-estate."),),
                **shared,
            )
        )
    if availability:
        facts.append(
            engine.AvailabilityFact(
                availability=availability,
                evidence_refs=(source(subject, f"Staffing availability: {availability}."),),
                **shared,
            )
        )
    return engine.StaffingCandidate(
        candidate_id=subject,
        tenant_id=TENANT,
        user_active=True,
        active_employment=True,
        employment_started_at=NOW - timedelta(days=1000),
        employment_ended_at=None,
        facts=tuple(facts),
    )


def intent(*, preferred=(), required=(REACT,), domains=("real-estate",), availability="ANY"):
    return ResolvedSearchIntent(
        skills=[
            ResolvedSkill(
                canonical_skill_id=skill,
                name="alias already resolved",
                required=True,
                minimum_years=2.0,
                minimum_level=3,
            )
            for skill in required
        ]
        + [
            ResolvedSkill(
                canonical_skill_id=skill,
                name="preferred",
                required=False,
            )
            for skill in preferred
        ],
        required_domains=list(domains),
        availability=availability,
    )


def rank(engine, source, candidates, plan=None, **kwargs):
    return engine.rank_candidates(
        candidates,
        plan or intent(),
        context=context(source, candidates),
        now=NOW,
        **kwargs,
    )


def test_reference_flow_react_years_and_domain(engine, source):
    good = candidate(engine, source)
    (result,) = rank(engine, source, [good], intent(availability="AVAILABLE"))
    assert result.candidate_id == good.candidate_id
    assert result.score == 100
    assert {f.code for f in result.score_factors} == {"REQUIRED_SKILL", "DOMAIN", "AVAILABILITY"}
    assert result.evidence_refs
    assert result.score_version == engine.SCORE_VERSION


@pytest.mark.parametrize(
    "changes",
    [
        {"skills": ()},
        {"domain": False},
        {"years": 1.9},
        {"level": 2},
        {"years": None},
        {"level": None},
        {"availability": None},
        {"availability": "UNAVAILABLE"},
    ],
)
def test_missing_or_insufficient_required_fact_excludes(engine, source, changes):
    person = candidate(engine, source, **changes)
    assert rank(engine, source, [person], intent(availability="AVAILABLE")) == ()


def test_all_required_skills_are_and_not_or(engine, source):
    only_one = candidate(engine, source)
    both = candidate(engine, source, 101, skills=(REACT, PYTHON))
    assert [
        r.candidate_id
        for r in rank(
            engine,
            source,
            [only_one, both],
            intent(required=(REACT, PYTHON)),
        )
    ] == [both.candidate_id]


def test_preferred_cannot_rescue_hard_failure(engine, source):
    wrong = candidate(engine, source, skills=(PYTHON,))
    assert rank(engine, source, [wrong], intent(preferred=(PYTHON,))) == ()


def test_preferred_ranks_without_excluding_missing_preference(engine, source):
    basic = candidate(engine, source, 100)
    better = candidate(engine, source, 101, skills=(REACT, PYTHON))
    results = rank(engine, source, [basic, better], intent(preferred=(PYTHON,)))
    assert [r.candidate_id for r in results] == [better.candidate_id, basic.candidate_id]
    assert results[0].score > results[1].score


@pytest.mark.parametrize(
    "changes",
    [
        {"tenant_id": UUID(int=99)},
        {"user_active": False},
        {"active_employment": False},
        {"employment_ended_at": NOW},
        {"employment_started_at": NOW + timedelta(days=1)},
    ],
)
def test_tenant_and_active_employment_gate(engine, source, changes):
    person = replace(candidate(engine, source), **changes)
    assert rank(engine, source, [person]) == ()


def test_allowed_candidate_gate_before_ranking(engine, source):
    person = candidate(engine, source)
    ctx = EvidenceContext(tenant_id=TENANT, actor_id=UUID(int=2))
    assert engine.rank_candidates([person], intent(), context=ctx, now=NOW) == ()


@pytest.mark.parametrize(
    "bad_ref", ["subject", "tenant", "source", "version", "block", "quote", "hash"]
)
def test_mismatched_evidence_cannot_support_skill(engine, source, bad_ref):
    person = candidate(engine, source)
    fact = person.facts[0]
    ref = fact.evidence_refs[0]
    fields = {
        "subject": {"subject_id": UUID(int=101)},
        "tenant": {"tenant_id": UUID(int=99)},
        "source": {"source_id": UUID(int=999)},
        "version": {"source_version_id": UUID(int=999)},
        "block": {"block_id": UUID(int=999)},
        "quote": {"quote": "invented claim"},
        "hash": {"quote_sha256": "0" * 64},
    }
    bad = fact.model_copy(update={"evidence_refs": (ref.model_copy(update=fields[bad_ref]),)})
    person = replace(person, facts=(bad, *person.facts[1:]))
    assert rank(engine, source, [person]) == ()


@pytest.mark.parametrize(
    "changes",
    [
        {"provenance": "SELF_ASSERTED"},
        {"provenance": "UNVERIFIED"},
        {"evidence_refs": ()},
        {"observed_at": NOW + timedelta(seconds=1)},
    ],
)
def test_unverified_or_future_facts_are_not_rewarded(engine, source, changes):
    person = candidate(engine, source)
    bad = person.facts[0].model_copy(update=changes)
    person = replace(person, facts=(bad, *person.facts[1:]))
    assert rank(engine, source, [person]) == ()


def test_eligibility_and_rank_happen_before_top_k_including_after_25(engine, source):
    people = [candidate(engine, source, 100 + i, domain=False) for i in range(30)]
    good = candidate(engine, source, 999)
    people.append(good)
    assert rank(engine, source, people, limit=1)[0].candidate_id == good.candidate_id


def test_higher_preferred_score_after_25_wins(engine, source):
    people = [candidate(engine, source, 100 + i) for i in range(30)]
    good = candidate(engine, source, 999, skills=(REACT, PYTHON))
    people.append(good)
    assert (
        rank(engine, source, people, intent(preferred=(PYTHON,)), limit=1)[0].candidate_id
        == good.candidate_id
    )


def test_factors_sum_exactly_and_ties_are_input_order_independent(engine, source):
    people = [candidate(engine, source, 100 + i) for i in range(4)]
    plan = intent(preferred=(PYTHON,), availability="AVAILABLE")
    first = rank(engine, source, people, plan, include_freshness=True)
    second = rank(engine, source, list(reversed(people)), plan, include_freshness=True)
    assert first == second
    assert [m.candidate_id for m in first] == sorted(p.candidate_id for p in people)
    for match in first:
        assert sum(f.points for f in match.score_factors) == match.score
        assert 0 <= match.score <= 100


@pytest.mark.parametrize(
    "kwargs",
    [
        {"unresolved_required_skills": ["unknown"]},
        {"unsupported_constraints": ["relocation"]},
        {"soft_preferences": ["personality fit"]},
        {"title_keywords": ["engineer"]},
    ],
)
def test_unknown_required_or_unimplemented_semantics_clarify(engine, source, kwargs):
    with pytest.raises(engine.RankingNeedsClarification):
        rank(engine, source, [], ResolvedSearchIntent(**kwargs))


def test_unknown_canonical_required_id_cannot_match_display_name(engine, source):
    person = candidate(engine, source)
    assert rank(engine, source, [person], intent(required=(UUID(int=999),))) == ()


def test_unresolved_required_domain_never_drops_a_hard_constraint(engine, source):
    person = candidate(engine, source)
    plan = intent().model_copy(update={"unresolved_required_domains": ["unknown domain"]})
    with pytest.raises(engine.RankingNeedsClarification):
        rank(engine, source, [person], plan)


def test_no_unspecified_experience_or_availability_bonus(engine, source):
    person = candidate(engine, source)
    (match,) = rank(engine, source, [person], intent(domains=()))
    assert [f.code for f in match.score_factors] == ["REQUIRED_SKILL"]


def test_minimum_total_experience_requires_its_own_supported_fact(engine, source):
    person = candidate(engine, source)
    plan = intent().model_copy(update={"minimum_total_years": 2.0})
    assert rank(engine, source, [person], plan) == ()
    fact = engine.ExperienceFact(
        years=4.0,
        observed_at=NOW,
        provenance="VERIFIED_CANONICAL",
        evidence_refs=(source(person.candidate_id, "Verified total experience: four years."),),
    )
    person = replace(person, facts=(*person.facts, fact))
    (match,) = rank(engine, source, [person], plan)
    assert "EXPERIENCE" in {f.code for f in match.score_factors}


def test_freshness_uses_oldest_contributing_fact_and_frozen_time(engine, source):
    person = candidate(engine, source, observed_at=NOW - timedelta(days=180))
    (match,) = rank(engine, source, [person], include_freshness=True)
    freshness = next(f for f in match.score_factors if f.code == "DATA_FRESHNESS")
    assert freshness.points == pytest.approx(freshness.maximum_points / 2, abs=0.0002)
    assert match.data_freshness_at == NOW - timedelta(days=180)


def test_available_now_also_meets_available_soon(engine, source):
    person = candidate(engine, source)
    assert rank(engine, source, [person], intent(availability="AVAILABLE_SOON"))


def test_invalid_evidence_context_fails_closed(engine, source):
    person = candidate(engine, source)
    ctx = context(source, [person])
    ctx = ctx.model_copy(update={"evidence_blocks": (*ctx.evidence_blocks, ctx.evidence_blocks[0])})
    with pytest.raises(engine.RankingEvidenceError):
        engine.rank_candidates([person], intent(), context=ctx, now=NOW)


def test_empty_criteria_cannot_reward_unspecified_facts(engine, source):
    person = candidate(engine, source)
    assert rank(engine, source, [person], ResolvedSearchIntent()) == ()


@pytest.mark.parametrize("years,expected", [(2.0, False), (2.1, True)])
def test_strict_more_than_skill_years(engine, source, years, expected):
    person = candidate(engine, source, years=years)
    plan = intent()
    plan.skills[0] = plan.skills[0].model_copy(update={"minimum_years_exclusive": True})
    assert bool(rank(engine, source, [person], plan)) is expected


@pytest.mark.parametrize("years,expected", [(2.0, False), (2.1, True)])
def test_strict_more_than_total_years(engine, source, years, expected):
    person = candidate(engine, source)
    total = engine.ExperienceFact(
        years=years,
        observed_at=NOW,
        provenance="VERIFIED_CANONICAL",
        evidence_refs=(source(person.candidate_id, f"Verified total experience: {years} years."),),
    )
    person = replace(person, facts=(*person.facts, total))
    plan = intent().model_copy(
        update={
            "minimum_total_years": 2.0,
            "minimum_total_years_exclusive": True,
        }
    )
    assert bool(rank(engine, source, [person], plan)) is expected


def test_equal_timestamp_conflict_cannot_select_higher_skill_value(engine, source):
    person = candidate(engine, source)
    conflict = person.facts[0].model_copy(
        update={
            "years": 1.0,
            "evidence_refs": (source(person.candidate_id, "React: one year; level 4."),),
        }
    )
    person = replace(person, facts=(*person.facts, conflict))
    assert rank(engine, source, [person]) == ()


def test_latest_verified_observation_supersedes_old_value(engine, source):
    person = candidate(engine, source, observed_at=NOW - timedelta(days=1))
    newer = person.facts[0].model_copy(
        update={
            "years": 1.0,
            "observed_at": NOW,
            "evidence_refs": (
                source(person.candidate_id, "Corrected React experience: one year; level 4."),
            ),
        }
    )
    person = replace(person, facts=(*person.facts, newer))
    assert rank(engine, source, [person]) == ()


@pytest.mark.parametrize("limit", [0, -1, 101, True])
def test_invalid_top_k_is_rejected(engine, source, limit):
    with pytest.raises(ValueError, match="limit"):
        rank(engine, source, [], limit=limit)


def test_naive_clock_rejected(engine, source):
    with pytest.raises(ValueError, match="timezone"):
        engine.rank_candidates(
            [], intent(), context=context(source, []), now=NOW.replace(tzinfo=None)
        )


def test_duplicate_candidate_identity_rejected(engine, source):
    person = candidate(engine, source)
    with pytest.raises(engine.RankingEvidenceError, match="duplicate_candidate"):
        rank(engine, source, [person, person])


def test_preferred_only_missing_skill_gets_zero_without_exclusion(engine, source):
    person = candidate(engine, source)
    (match,) = rank(engine, source, [person], intent(required=(), domains=(), preferred=(PYTHON,)))
    assert match.score == 0
    assert match.score_factors[0].code == "PREFERRED_SKILL"


def test_unresolved_preferred_is_unmet_not_clarification(engine, source):
    person = candidate(engine, source)
    plan = intent().model_copy(update={"unresolved_preferred_skills": ["unknown preferred"]})
    (match,) = rank(engine, source, [person], plan)
    factor = next(f for f in match.score_factors if f.code == "PREFERRED_SKILL")
    assert factor.points == 0


def test_all_six_full_factors_sum_to_exactly_100(engine, source):
    person = candidate(engine, source, skills=(REACT, PYTHON))
    total = engine.ExperienceFact(
        years=5.0,
        observed_at=NOW,
        provenance="VERIFIED_CANONICAL",
        evidence_refs=(source(person.candidate_id, "Verified five years of total experience."),),
    )
    person = replace(person, facts=(*person.facts, total))
    plan = intent(preferred=(PYTHON,), availability="AVAILABLE").model_copy(
        update={"minimum_total_years": 2.0}
    )
    (match,) = rank(engine, source, [person], plan, include_freshness=True)
    assert len(match.score_factors) == 6
    assert sum(f.points for f in match.score_factors) == match.score == 100


@pytest.mark.parametrize("mask", range(32))
def test_each_active_group_combination_preserves_exact_score_bounds(engine, source, mask):
    person = candidate(engine, source, skills=(REACT, PYTHON))
    total = engine.ExperienceFact(
        years=5.0,
        observed_at=NOW,
        provenance="VERIFIED_CANONICAL",
        evidence_refs=(source(person.candidate_id, "Verified five years of total experience."),),
    )
    person = replace(person, facts=(*person.facts, total))
    plan = intent(
        preferred=(PYTHON,) if mask & 1 else (),
        domains=("real-estate",) if mask & 2 else (),
        availability="AVAILABLE" if mask & 4 else "ANY",
    ).model_copy(update={"minimum_total_years": 2.0 if mask & 8 else None})
    (match,) = rank(engine, source, [person], plan, include_freshness=bool(mask & 16))
    assert sum(f.points for f in match.score_factors) == match.score == 100


@pytest.mark.parametrize("years", [float("nan"), float("inf"), -1.0, 61.0])
def test_invalid_numeric_fact_rejected(engine, years):
    with pytest.raises(ValidationError):
        engine.SkillFact(
            canonical_skill_id=REACT,
            years=years,
            observed_at=NOW,
            provenance="VERIFIED_CANONICAL",
        )


def test_required_domains_are_and(engine, source):
    person = candidate(engine, source)
    assert rank(engine, source, [person], intent(domains=("real-estate", "healthcare"))) == ()


def test_preferred_minimum_years_is_scored_not_a_hard_filter(engine, source):
    person = candidate(engine, source)
    plan = intent(required=(), domains=(), preferred=(REACT,))
    plan.skills[0] = plan.skills[0].model_copy(update={"minimum_years": 5.0})
    (match,) = rank(engine, source, [person], plan)
    assert match.score == 0


def test_future_preferred_fact_cannot_increase_score(engine, source):
    person = candidate(engine, source, skills=(REACT, PYTHON))
    future = person.facts[1].model_copy(update={"observed_at": NOW + timedelta(days=1)})
    person = replace(person, facts=(person.facts[0], future, *person.facts[2:]))
    (match,) = rank(engine, source, [person], intent(preferred=(PYTHON,)))
    assert next(f for f in match.score_factors if f.code == "PREFERRED_SKILL").points == 0


def test_foreign_tenant_context_block_rejects_whole_invocation(engine, source):
    person = candidate(engine, source)
    ctx = context(source, [person])
    foreign = ctx.evidence_blocks[0].model_copy(update={"tenant_id": UUID(int=999)})
    ctx = ctx.model_copy(update={"evidence_blocks": (foreign, *ctx.evidence_blocks[1:])})
    with pytest.raises(engine.RankingEvidenceError, match="cross_tenant"):
        engine.rank_candidates([person], intent(), context=ctx, now=NOW)
