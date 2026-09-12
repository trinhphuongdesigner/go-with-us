"""Compiler-to-ranker contract, with synthetic provider and canonical evidence.

This deliberately runs both production modules; it does not prove the missing
W1 persistence adapter or the live Madison service works.
"""

from dataclasses import replace
from uuid import UUID

import httpx
import pytest

from app.people_search import canonical_ranking as engine
from app.people_search.intent import CatalogSkill, StaticSkillCatalog

from .test_canonical_ranking import NOW, REACT, TENANT, candidate, context
from .test_canonical_ranking import source as source  # noqa: PLC0414 -- pytest fixture re-export
from .test_intent import ACTOR, compiler_for, intent_data, synthetic_domains, tool_stream

QUERY = "Tìm nhân sự có kinh nghiệm React trên 2 năm và từng làm lĩnh vực bất động sản."


async def compile_reference(*, domains=True):
    proposal = intent_data(
        normalized_query=QUERY,
        title_keywords=[],
        skills=[
            {
                "name": "React.js",
                "required": True,
                "minimum_years": 2.0,
                "minimum_years_exclusive": True,
            }
        ],
        required_domains=["bất động sản"],
    )

    def handler(request):
        # Entity/catalog IDs must be assigned by the application, not the model.
        assert str(REACT) not in request.content.decode()
        assert str(TENANT) not in request.content.decode()
        return httpx.Response(200, text=tool_stream(proposal))

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        return await compiler_for(
            client,
            catalog=StaticSkillCatalog([CatalogSkill(REACT, "React", ("React.js",))]),
            domain_catalog=synthetic_domains() if domains else None,
        ).compile(QUERY, tenant_id=TENANT, actor_id=ACTOR)


@pytest.mark.parametrize("years, eligible", [(1.9, False), (2.0, False), (2.1, True), (3.0, True)])
async def test_vietnamese_reference_preserves_strict_duration_and_domain(source, years, eligible):
    compiled = await compile_reference()
    assert not compiled.provider_failed and not compiled.plan.needs_clarification
    assert compiled.intent is not None
    assert compiled.intent.required_domains == ["real-estate"]
    assert compiled.intent.skills[0].canonical_skill_id == REACT
    person = candidate(engine, source, years=years)
    matches = engine.rank_candidates(
        [person], compiled.intent, context=context(source, [person]), now=NOW
    )
    assert bool(matches) is eligible
    if eligible:
        assert matches[0].candidate_id == person.candidate_id
        assert matches[0].score == sum(f.points for f in matches[0].score_factors)
        assert {f.code for f in matches[0].score_factors} == {"REQUIRED_SKILL", "DOMAIN"}


@pytest.mark.parametrize("disqualifier", ["domain", "inactive", "tenant", "permission", "evidence"])
async def test_compiled_reference_cannot_bypass_canonical_eligibility(source, disqualifier):
    compiled = await compile_reference()
    assert compiled.intent is not None
    person = candidate(engine, source, domain=disqualifier != "domain")
    if disqualifier == "inactive":
        person = replace(person, user_active=False)
    if disqualifier == "tenant":
        person = replace(person, tenant_id=UUID(int=99))
    if disqualifier == "evidence":
        person = replace(
            person,
            facts=tuple(f.model_copy(update={"provenance": "SELF_ASSERTED"}) for f in person.facts),
        )
    evidence = context(source, [person] if disqualifier != "permission" else [])
    if disqualifier == "permission":
        # An authorized context must not contain any disallowed subject's blocks.
        evidence = evidence.model_copy(update={"evidence_blocks": ()})
    assert engine.rank_candidates([person], compiled.intent, context=evidence, now=NOW) == ()


async def test_missing_domain_catalog_never_becomes_unrestricted_search(source):
    compiled = await compile_reference(domains=False)
    assert compiled.plan.needs_clarification
    assert compiled.intent is not None
    assert compiled.intent.unresolved_required_domains == ["bất động sản"]
    person = candidate(engine, source)
    with pytest.raises(engine.RankingNeedsClarification):
        engine.rank_candidates(
            [person], compiled.intent, context=context(source, [person]), now=NOW
        )
