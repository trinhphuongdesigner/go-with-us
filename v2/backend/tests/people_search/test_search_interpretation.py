"""Public interpretation mirrors validated intent, not invented staffing facts."""

import httpx

from app.people_search.intent import CatalogSkill, StaticSkillCatalog
from tests.people_search.test_intent import (
    ACTOR,
    REACT,
    TENANT,
    compiler_for,
    intent_data,
    synthetic_domains,
    tool_stream,
)


async def compile_data(data, query="React trên 2 năm, bất động sản"):
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, text=tool_stream(data)))
    ) as client:
        return await compiler_for(
            client,
            catalog=StaticSkillCatalog([CatalogSkill(REACT, "React", ("React.js",))]),
            domain_catalog=synthetic_domains(),
        ).compile(query, tenant_id=TENANT, actor_id=ACTOR)


async def test_public_interpretation_preserves_exact_skill_and_total_years_separately():
    result = await compile_data(
        intent_data(
            normalized_query="React trên 2 năm và bất động sản, tổng kinh nghiệm từ 5 năm",
            skills=[
                {
                    "name": "React.js",
                    "required": True,
                    "minimum_years": 2.0,
                    "minimum_years_exclusive": True,
                    "minimum_level": 3,
                }
            ],
            required_domains=["bất động sản"],
            minimum_total_years=5.0,
            availability="AVAILABLE_SOON",
            title_keywords=[],
        )
    )
    interpretation = result.plan.model_dump(mode="json").get("interpretation")
    assert interpretation is not None
    assert interpretation["skills"] == [
        {
            "name": "React",
            "canonical_skill_id": str(REACT),
            "required": True,
            "minimum_level": 3,
            "minimum_years": 2.0,
            "minimum_years_exclusive": True,
        }
    ]
    assert interpretation["required_domains"] == [
        {"name": "bất động sản", "canonical_domain": "real-estate"}
    ]
    assert interpretation["minimum_total_years"] == 5.0
    assert interpretation["minimum_total_years_exclusive"] is False
    assert interpretation["availability"] == "AVAILABLE_SOON"


async def test_unknown_terms_remain_visible_as_unresolved_not_as_applied_filters():
    result = await compile_data(
        intent_data(
            skills=[{"name": "UnknownStack", "required": True, "minimum_years": 4.0}],
            required_domains=["UnknownDomain"],
            missing_fields=["TIMEFRAME"],
            unsupported_constraints=["loại trừ dự án cũ"],
        )
    )
    assert result.plan.needs_clarification
    interpretation = result.plan.model_dump(mode="json").get("interpretation")
    assert interpretation is not None
    assert interpretation["skills"][0]["canonical_skill_id"] is None
    assert interpretation["skills"][0]["minimum_years"] == 4.0
    assert interpretation["required_domains"][0]["canonical_domain"] is None
    assert interpretation["missing_fields"] == ["TIMEFRAME"]
    assert interpretation["unsupported_constraints"] == ["loại trừ dự án cũ"]


async def test_sensitive_or_invalid_proposals_never_publish_interpretation():
    for data in [
        intent_data(sensitive_constraints_detected=True),
        intent_data(candidate_id="foreign"),
    ]:
        result = await compile_data(data)
        assert result.plan.model_dump(mode="json").get("interpretation") is None


async def test_structured_clause_mismatch_does_not_publish_misleading_interpretation():
    result = await compile_data(intent_data(), query="kỹ năng bắt buộc: React")
    assert result.plan.needs_clarification
    assert result.plan.model_dump(mode="json").get("interpretation") is None
