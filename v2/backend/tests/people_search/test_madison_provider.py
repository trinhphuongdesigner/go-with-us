"""Provider transport contract; all credentials/data are explicitly synthetic."""

import json

import httpx
import pytest
from pydantic import SecretStr

from app.ai.gateway import AiTask, EvidenceContext, TransientProviderError
from app.people_search.intent_models import CompiledIntent
from app.people_search.providers.madison import MadisonIntentProvider
from app.people_search.settings import PeopleSearchSettings
from tests.people_search.test_intent import ACTOR, TENANT, intent_data, tool_stream


def settings():
    return PeopleSearchSettings(_env_file=None, madison_api_key=SecretStr("synthetic-key"))


def test_settings_use_madison_defaults_and_hide_secret():
    config = settings()
    assert config.madison_base_url == "https://ai-center.madlab.tech"
    assert config.madison_model == "madison-ai-center"
    assert "synthetic-key" not in repr(config)


async def test_wire_schema_preserves_structure_but_moves_unsupported_bounds_to_descriptions():
    original = CompiledIntent.model_json_schema()
    bounds = {"minimum", "maximum", "minLength", "maxLength", "maxItems"}
    moved = []

    def compare(source, wire):
        if isinstance(source, list):
            assert len(source) == len(wire)
            for before, after in zip(source, wire, strict=True):
                compare(before, after)
        elif isinstance(source, dict):
            for key, value in source.items():
                if key in bounds:
                    assert key not in wire
                    assert f"{key}={value}" in wire["description"]
                    moved.append(key)
                elif key == "description":
                    assert wire[key].startswith(value)
                else:
                    compare(value, wire[key])
        else:
            assert source == wire

    def handler(request):
        payload = json.loads(request.content)
        tool = payload["tools"][0]
        assert tool["strict"] is True
        assert payload["tool_choice"]["disable_parallel_tool_use"] is True
        compare(original, tool["input_schema"])
        return httpx.Response(200, text=tool_stream(intent_data()))

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        await MadisonIntentProvider(settings(), query="Kỹ sư", client=client).generate(
            AiTask.PEOPLE_SEARCH_INTENT, EvidenceContext(tenant_id=TENANT, actor_id=ACTOR)
        )
    assert set(moved) == bounds
    assert CompiledIntent.model_json_schema() == original


@pytest.mark.parametrize("status", [429, 500, 503])
async def test_only_transient_statuses_emit_retryable_signal(status):
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda _: httpx.Response(status, text="synthetic private provider body")
        )
    ) as client:
        provider = MadisonIntentProvider(settings(), query="Kỹ sư", client=client)
        with pytest.raises(TransientProviderError) as error:
            await provider.generate(
                AiTask.PEOPLE_SEARCH_INTENT,
                EvidenceContext(
                    tenant_id=TENANT,
                    actor_id=ACTOR,
                ),
            )
    assert "private provider body" not in str(error.value)


@pytest.mark.parametrize("status", [400, 401, 403, 302])
async def test_rejected_requests_are_not_retryable_or_followed(status):
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(status, headers={"location": "https://foreign.invalid"})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        provider = MadisonIntentProvider(settings(), query="Kỹ sư", client=client)
        with pytest.raises(ValueError):
            await provider.generate(
                AiTask.PEOPLE_SEARCH_INTENT,
                EvidenceContext(
                    tenant_id=TENANT,
                    actor_id=ACTOR,
                ),
            )
    assert len(calls) == 1


async def test_person_explanation_cannot_use_intent_adapter():
    provider = MadisonIntentProvider(settings(), query="Kỹ sư")
    with pytest.raises(ValueError, match="invalid intent task context"):
        await provider.generate(
            AiTask.PEOPLE_SEARCH_EXPLANATION,
            EvidenceContext(
                tenant_id=TENANT,
                actor_id=ACTOR,
            ),
        )


async def test_complete_tool_stream_returns_provider_response():
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda _: httpx.Response(200, text=tool_stream(intent_data()))
        )
    ) as client:
        provider = MadisonIntentProvider(settings(), query="Kỹ sư", client=client)
        response = await provider.generate(
            AiTask.PEOPLE_SEARCH_INTENT,
            EvidenceContext(
                tenant_id=TENANT,
                actor_id=ACTOR,
            ),
        )
    assert response.data == intent_data()
    assert response.model == "madison-ai-center"


@pytest.mark.parametrize("name", ["compile_people_search", "compile_people_search_ide"])
async def test_accepts_only_declared_tool_or_observed_madison_ide_alias(name):
    body = tool_stream(intent_data()).replace('"compile_people_search"', json.dumps(name))
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, text=body))
    ) as client:
        result = await MadisonIntentProvider(settings(), query="Kỹ sư", client=client).generate(
            AiTask.PEOPLE_SEARCH_INTENT, EvidenceContext(tenant_id=TENANT, actor_id=ACTOR)
        )
    assert result.data == intent_data()


@pytest.mark.parametrize("name", ["foreign_tool", "compile_people_search_ide_extra", "", None])
async def test_alias_support_does_not_accept_arbitrary_tool_names(name):
    body = tool_stream(intent_data()).replace('"compile_people_search"', json.dumps(name))
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, text=body))
    ) as client:
        with pytest.raises(ValueError, match="invalid intent stream"):
            await MadisonIntentProvider(settings(), query="Kỹ sư", client=client).generate(
                AiTask.PEOPLE_SEARCH_INTENT, EvidenceContext(tenant_id=TENANT, actor_id=ACTOR)
            )
