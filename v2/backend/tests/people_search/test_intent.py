"""Synthetic intent compilation: no HR, credentials, or external network."""

import json
import uuid

import httpx
import pytest
from pydantic import SecretStr

from app.ai.gateway import AiGateway, AiTask
from app.ai.resilience import CircuitBreaker
from app.people_search.settings import PeopleSearchSettings

TENANT = uuid.UUID(int=1)
ACTOR = uuid.UUID(int=2)
REACT = uuid.UUID(int=3)


def intent_data(**overrides):
    return {
        "normalized_query": "Tìm kỹ sư backend",
        "skills": [],
        "required_domains": [],
        "availability": "ANY",
        "title_keywords": ["Backend Engineer"],
        "minimum_total_years": None,
        "soft_preferences": [],
        "sensitive_constraints_detected": False,
        "missing_fields": [],
        "unsupported_constraints": [],
        **overrides,
    }


def tool_stream(data, *, stop_reason="tool_use"):
    events = [
        {"type": "message_start", "message": {"role": "assistant"}},
        {
            "type": "content_block_start",
            "index": 0,
            "content_block": {
                "type": "tool_use",
                "id": "synthetic-tool",
                "name": "compile_people_search",
                "input": {},
            },
        },
        {
            "type": "content_block_delta",
            "index": 0,
            "delta": {
                "type": "input_json_delta",
                "partial_json": json.dumps(data),
            },
        },
        {"type": "content_block_stop", "index": 0},
        {"type": "message_delta", "delta": {"stop_reason": stop_reason}},
        {"type": "message_stop"},
    ]
    return "".join("data: " + json.dumps(event) + "\n\n" for event in events)


async def no_sleep(_delay):
    pass


def compiler_for(client, **kwargs):
    from app.people_search.intent import IntentCompiler

    return IntentCompiler(
        PeopleSearchSettings(_env_file=None, madison_api_key=SecretStr("synthetic-key")),
        client=client,
        sleep=no_sleep,
        **kwargs,
    )


def synthetic_domains():
    from app.people_search.intent import CatalogDomain, StaticDomainCatalog

    return StaticDomainCatalog([CatalogDomain("real-estate", "Real estate", ("bất động sản",))])


async def test_normal_query_invokes_gateway_and_model_changes_plan(monkeypatch):
    tasks = []
    original = AiGateway.generate

    async def observe(self, task, schema, context, provider=None):
        tasks.append(task)
        assert context.tenant_id == TENANT
        assert context.actor_id == ACTOR
        assert context.fixture_id is None
        assert not context.evidence_blocks and not context.allowed_entity_ids
        return await original(self, task, schema, context, provider)

    monkeypatch.setattr(AiGateway, "generate", observe)
    requests = []

    def handler(request):
        payload = json.loads(request.content)
        requests.append(payload)
        assert payload["tools"][0]["strict"] is True
        assert payload["tools"][0]["input_schema"]["additionalProperties"] is False
        assert "Tìm kỹ sư" in payload["messages"][0]["content"]
        assert str(TENANT) not in request.content.decode()
        return httpx.Response(200, text=tool_stream(intent_data(minimum_total_years=4.0)))

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        result = await compiler_for(client).compile(
            "Tìm kỹ sư có tổng cộng ít nhất bốn năm kinh nghiệm",
            tenant_id=TENANT,
            actor_id=ACTOR,
        )
    assert tasks == [AiTask.PEOPLE_SEARCH_INTENT]
    assert len(requests) == 1
    assert result.plan.min_experience_years == 4.0
    assert result.intent.title_keywords == ["Backend Engineer"]
    assert not result.provider_failed and not result.plan.needs_clarification


@pytest.mark.parametrize(
    "extra",
    [
        {"tenant_id": "foreign"},
        {"candidate_ids": ["invented"]},
        {"score": 99},
        {"sql": "SELECT * FROM users"},
        {"skills": [{"name": "React", "required": True, "candidate_id": "invented"}]},
        {"title_keywords": ["x" * 201]},
        {"required_domains": ["x"] * 21},
        {"skills": [{"name": "React", "required": "true"}]},
        {"minimum_total_years": 61},
        {"minimum_total_years": -1},
        {"skills": [{"name": "React", "required": True, "minimum_years": 61}]},
        {"skills": [{"name": "React", "required": True, "minimum_level": 6}]},
        {"skills": [{"name": "", "required": True}]},
        {"normalized_query": "x" * 2001},
    ],
)
async def test_provider_cannot_supply_authority_or_unbounded_or_coerced_data(extra):
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(200, text=tool_stream(intent_data(**extra)))

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        result = await compiler_for(client).compile("Kỹ sư", tenant_id=TENANT, actor_id=ACTOR)
    assert result.provider_failed
    assert result.intent is None
    assert len(calls) == 1  # invalid schema is never retried


async def test_alias_resolves_to_catalog_id_and_preserves_required_duration():
    from app.people_search.intent import CatalogSkill, StaticSkillCatalog

    catalog = StaticSkillCatalog([CatalogSkill(REACT, "React", ("React.js", "ReactJS"))])
    data = intent_data(
        skills=[
            {
                "name": "React.js",
                "required": True,
                "minimum_years": 2.0,
                "minimum_level": 3,
            }
        ],
        required_domains=["bất động sản"],
        availability="AVAILABLE",
    )
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, text=tool_stream(data)))
    ) as client:
        result = await compiler_for(
            client, catalog=catalog, domain_catalog=synthetic_domains()
        ).compile("React.js từ 2 năm, bất động sản, sẵn sàng", tenant_id=TENANT, actor_id=ACTOR)
    skill = result.intent.skills[0]
    assert skill.canonical_skill_id == REACT
    assert skill.minimum_years == 2.0 and skill.minimum_level == 3
    assert skill.required
    assert result.intent.required_domains == ["real-estate"]
    assert result.intent.availability == "AVAILABLE"


async def test_missing_production_catalog_clarifies_unknown_required_skill():
    data = intent_data(skills=[{"name": "UnknownStack", "required": True}])
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, text=tool_stream(data)))
    ) as client:
        result = await compiler_for(client).compile(
            "Bắt buộc UnknownStack", tenant_id=TENANT, actor_id=ACTOR
        )
    assert result.plan.needs_clarification
    assert result.intent.unresolved_required_skills == ["UnknownStack"]
    assert not result.intent.skills
    assert result.plan.required_skills[0].phrase == "UnknownStack"


@pytest.mark.parametrize(
    "query",
    [
        "female React developers",
        "Kỹ sư nữ",
        "nam giới biết Python",
        "người dưới 30 tuổi",
        "chỉ người độc thân",
        "Christian engineers",
        "không có khuyết tật",
        "người dân tộc Kinh",
    ],
)
async def test_protected_requests_cannot_be_broadened_by_model_omission(query):
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(200, text=tool_stream(intent_data()))

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        result = await compiler_for(client).compile(query, tenant_id=TENANT, actor_id=ACTOR)
    assert result.plan.needs_clarification
    assert result.intent is None
    assert not calls
    assert query not in result.plan.raw_query


@pytest.mark.parametrize(
    "data",
    [
        intent_data(sensitive_constraints_detected=True),
        intent_data(title_keywords=["female engineer"]),
        intent_data(unsupported_constraints=["Chỉ những người đã có chứng chỉ nội bộ"]),
        intent_data(missing_fields=["TIMEFRAME"]),
        intent_data(title_keywords=[]),
    ],
)
async def test_model_safety_ambiguity_and_unrepresented_constraints_clarify(data):
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, text=tool_stream(data)))
    ) as client:
        result = await compiler_for(client).compile(
            "Tìm nhân sự phù hợp", tenant_id=TENANT, actor_id=ACTOR
        )
    assert result.plan.needs_clarification


async def test_two_attempts_and_circuit_persist_across_compilations():
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(503, text="unavailable")

    breaker = CircuitBreaker(failure_threshold=2)
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        compiler = compiler_for(client, circuit_breaker=breaker)
        first = await compiler.compile("Kỹ sư backend", tenant_id=TENANT, actor_id=ACTOR)
        second = await compiler.compile("Kỹ sư frontend", tenant_id=TENANT, actor_id=ACTOR)
    assert first.provider_failed and second.provider_failed
    assert len(calls) == 2
    assert second.failure_codes == ("circuit_open",)
    assert not first.plan.preferred_skills  # no regex fallback silently succeeds


async def test_timeout_retries_then_recovers_with_request_local_query():
    seen = []

    def handler(request):
        seen.append(json.loads(request.content)["messages"][0]["content"])
        if len(seen) == 1:
            raise httpx.ReadTimeout("synthetic timeout", request=request)
        return httpx.Response(200, text=tool_stream(intent_data()))

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        compiler = compiler_for(client)
        first = await compiler.compile("Query one", tenant_id=TENANT, actor_id=ACTOR)
        second = await compiler.compile("Query two", tenant_id=TENANT, actor_id=ACTOR)
    assert not first.provider_failed and not second.provider_failed
    assert len(seen) == 3
    assert "Query one" in seen[0] and seen[0] == seen[1]
    assert "Query two" in seen[2] and "Query one" not in seen[2]


@pytest.mark.parametrize(
    "body",
    [
        tool_stream(intent_data(), stop_reason="max_tokens"),
        tool_stream(intent_data()).replace('data: {"type": "message_stop"}\n\n', ""),
        tool_stream(intent_data()) + 'data: {"type":"error"}\n\n',
        tool_stream(intent_data()).replace('"index": 0', '"index": 1', 1),
        'data: {"type":"content_block_delta","delta":{"text":"{}"}}\n\ndata: [DONE]\n\n',
    ],
)
async def test_intent_rejects_truncated_error_misordered_or_text_streams(body):
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, text=body))
    ) as client:
        result = await compiler_for(client).compile("Kỹ sư", tenant_id=TENANT, actor_id=ACTOR)
    assert result.provider_failed
    assert result.intent is None


@pytest.mark.parametrize(
    "query",
    [
        "kỹ năng bắt buộc: React",
        "kỹ năng bắt buộc: React, UnknownStack",
        "domain bắt buộc: bất động sản",
        "trạng thái sẵn sàng: AVAILABLE",
        "kinh nghiệm tối thiểu 3 năm",
        "kỹ năng ưu tiên: Python",
        "kỹ năng bắt buộc: React; domain bắt buộc: bất động sản",
        "kỹ năng bắt buộc: React trên 2 năm",
    ],
)
async def test_model_cannot_silently_drop_explicit_structured_clauses(query):
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda _: httpx.Response(200, text=tool_stream(intent_data()))
        )
    ) as client:
        result = await compiler_for(client).compile(query, tenant_id=TENANT, actor_id=ACTOR)
    assert result.plan.needs_clarification
    assert not result.provider_failed


async def test_complete_structured_clauses_preserve_internal_constraints():
    from app.people_search.intent import CatalogSkill, StaticSkillCatalog

    data = intent_data(
        skills=[{"name": "React", "required": True}],
        required_domains=["bất động sản"],
        minimum_total_years=3.0,
        availability="AVAILABLE_SOON",
    )
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, text=tool_stream(data)))
    ) as client:
        result = await compiler_for(
            client,
            domain_catalog=synthetic_domains(),
            catalog=StaticSkillCatalog(
                [
                    CatalogSkill(REACT, "React", ("React.js",)),
                ]
            ),
        ).compile(
            "kỹ năng bắt buộc: React.js; domain bắt buộc: bất động sản; "
            "kinh nghiệm tối thiểu 3 năm; trạng thái sẵn sàng: AVAILABLE_SOON",
            tenant_id=TENANT,
            actor_id=ACTOR,
        )
    assert not result.plan.needs_clarification
    assert result.intent.skills[0].canonical_skill_id == REACT


@pytest.mark.parametrize("phrase", ["single sign-on", "race condition debugging"])
async def test_technical_terms_do_not_become_protected_attribute_requests(phrase):
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda _: httpx.Response(200, text=tool_stream(intent_data(title_keywords=[phrase])))
        )
    ) as client:
        result = await compiler_for(client).compile(phrase, tenant_id=TENANT, actor_id=ACTOR)
    assert not result.plan.needs_clarification
    assert result.intent is not None


@pytest.mark.parametrize("query", ["single employees", "filter candidates by race"])
async def test_sensitive_meaning_of_ambiguous_technical_words_still_rejected(query):
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda _: httpx.Response(200, text=tool_stream(intent_data()))
        )
    ) as client:
        result = await compiler_for(client).compile(query, tenant_id=TENANT, actor_id=ACTOR)
    assert result.plan.needs_clarification


async def test_missing_configuration_fails_without_transport_or_retry():
    from app.people_search.intent import IntentCompiler

    calls = []
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda request: calls.append(request) or httpx.Response(500))
    ) as client:
        compiler = IntentCompiler(
            PeopleSearchSettings(_env_file=None, madison_api_key=None), client=client
        )
        result = await compiler.compile("Kỹ sư", tenant_id=TENANT, actor_id=ACTOR)
    assert result.provider_failed and not calls


async def test_oversized_provider_output_is_rejected():
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, text=":" + "x" * 131_072))
    ) as client:
        result = await compiler_for(client).compile("Kỹ sư", tenant_id=TENANT, actor_id=ACTOR)
    assert result.provider_failed


async def test_duplicate_json_keys_are_rejected_instead_of_overwriting_constraints():
    body = tool_stream(intent_data())
    body = body.replace(
        '\\"sensitive_constraints_detected\\": false',
        '\\"sensitive_constraints_detected\\": true, \\"sensitive_constraints_detected\\": false',
    )
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, text=body))
    ) as client:
        result = await compiler_for(client).compile("Kỹ sư", tenant_id=TENANT, actor_id=ACTOR)
    assert result.provider_failed


def test_ambiguous_catalog_alias_is_rejected():
    from app.people_search.intent import CatalogSkill, StaticSkillCatalog

    with pytest.raises(ValueError, match="ambiguous catalog alias"):
        StaticSkillCatalog(
            [
                CatalogSkill(REACT, "React", ("shared alias",)),
                CatalogSkill(uuid.UUID(int=4), "Python", ("shared alias",)),
            ]
        )


async def test_reference_query_preserves_strict_skill_years_and_domain():
    from app.people_search.intent import CatalogSkill, StaticSkillCatalog

    data = intent_data(
        skills=[
            {
                "name": "React",
                "required": True,
                "minimum_years": 2.0,
                "minimum_years_exclusive": True,
            }
        ],
        required_domains=["bất động sản"],
        title_keywords=[],
    )
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, text=tool_stream(data)))
    ) as client:
        result = await compiler_for(
            client,
            domain_catalog=synthetic_domains(),
            catalog=StaticSkillCatalog(
                [
                    CatalogSkill(REACT, "React"),
                ]
            ),
        ).compile(
            "ai có kinh nghiệm React trên 2 năm và từng làm domain bất động sản",
            tenant_id=TENANT,
            actor_id=ACTOR,
        )
    assert not result.provider_failed
    assert not result.plan.needs_clarification
    assert result.intent.skills[0].minimum_years_exclusive
    assert result.intent.skills[0].minimum_years == 2.0
    assert result.intent.minimum_total_years is None
    assert result.intent.required_domains == ["real-estate"]


async def test_strict_total_years_remains_distinct_from_skill_years():
    data = intent_data(minimum_total_years=2.0, minimum_total_years_exclusive=True)
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, text=tool_stream(data)))
    ) as client:
        result = await compiler_for(client).compile(
            "Tổng kinh nghiệm trên 2 năm", tenant_id=TENANT, actor_id=ACTOR
        )
    assert not result.provider_failed
    assert result.intent.minimum_total_years_exclusive
    assert not result.intent.skills


@pytest.mark.parametrize(
    "query,data",
    [
        ("kinh nghiệm tối thiểu 3 năm", intent_data(minimum_total_years=4.0)),
        (
            "kinh nghiệm tối thiểu 3 năm",
            intent_data(minimum_total_years=3.0, minimum_total_years_exclusive=True),
        ),
        (
            "kỹ năng bắt buộc: React",
            intent_data(
                skills=[
                    {"name": "React", "required": True, "minimum_years": 4.0},
                ]
            ),
        ),
        (
            "kỹ năng bắt buộc: React",
            intent_data(
                skills=[
                    {"name": "React", "required": True},
                    {"name": "Python", "required": True},
                ]
            ),
        ),
        ("domain bắt buộc: y tế", intent_data(required_domains=["y tế", "bất động sản"])),
    ],
)
async def test_model_cannot_strengthen_explicit_structured_filters(query, data):
    from app.people_search.intent import CatalogSkill, StaticSkillCatalog

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, text=tool_stream(data)))
    ) as client:
        result = await compiler_for(
            client,
            catalog=StaticSkillCatalog(
                [
                    CatalogSkill(REACT, "React"),
                ]
            ),
        ).compile(query, tenant_id=TENANT, actor_id=ACTOR)
    assert result.plan.needs_clarification


async def test_domain_alias_resolves_before_ranking_and_unknown_domain_clarifies():
    from app.people_search.intent import CatalogDomain, StaticDomainCatalog

    domains = StaticDomainCatalog(
        [
            CatalogDomain("real-estate", "Real estate", ("bất động sản",)),
        ]
    )
    data = intent_data(required_domains=["bất động sản"])
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, text=tool_stream(data)))
    ) as client:
        resolved = await compiler_for(client, domain_catalog=domains).compile(
            "domain bắt buộc: real estate",
            tenant_id=TENANT,
            actor_id=ACTOR,
        )
        unknown = await compiler_for(client).compile(
            "domain bắt buộc: bất động sản",
            tenant_id=TENANT,
            actor_id=ACTOR,
        )
    assert not resolved.plan.needs_clarification
    assert resolved.intent.required_domains == ["real-estate"]
    assert unknown.plan.needs_clarification
    assert unknown.intent.required_domains == []
    assert unknown.intent.unresolved_required_domains == ["bất động sản"]


async def test_invalid_half_open_probe_does_not_permanently_wedge_service():
    clock = [0.0]
    calls = []

    def handler(request):
        calls.append(request)
        if len(calls) <= 2:
            return httpx.Response(503)
        if len(calls) == 3:
            return httpx.Response(200, text="invalid SSE")
        return httpx.Response(200, text=tool_stream(intent_data()))

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        compiler = compiler_for(
            client,
            circuit_breaker=CircuitBreaker(
                failure_threshold=2,
                clock=lambda: clock[0],
            ),
        )
        assert (await compiler.compile("Kỹ sư", tenant_id=TENANT, actor_id=ACTOR)).provider_failed
        clock[0] = 31.0
        assert (await compiler.compile("Kỹ sư", tenant_id=TENANT, actor_id=ACTOR)).provider_failed
        assert not (
            await compiler.compile("Kỹ sư", tenant_id=TENANT, actor_id=ACTOR)
        ).provider_failed
    assert len(calls) == 4
