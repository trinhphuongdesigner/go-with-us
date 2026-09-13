from __future__ import annotations

import asyncio
import hashlib
import json
import uuid
from collections.abc import AsyncIterator

import httpx
import pytest
from fastapi import FastAPI, HTTPException
from pydantic import SecretStr, ValidationError
from starlette.requests import Request

from app.ai.gateway import (
    AiGateway,
    AiStatus,
    AiTask,
    EvidenceBlock,
    EvidenceContext,
    TransientProviderError,
)
from app.ai.provider_runtime import (
    OpenAICompatibleProvider,
    build_profile_import_ai_gateway,
)
from app.ai.shared_provider import SharedIntentProvider, SharedProfileProvider
from app.api.v2.profile_imports import get_profile_import_ai_gateway
from app.core.config import Settings
from app.domain.profile_import_schemas import JobTitleAiProposal
from app.main import configure_profile_import_ai_runtime
from app.people_search.intent_models import CompiledIntent


class AsyncChunks(httpx.AsyncByteStream):
    def __init__(self, chunks: list[bytes], *, delay_seconds: float = 0) -> None:
        self.chunks = chunks
        self.delay_seconds = delay_seconds

    async def __aiter__(self) -> AsyncIterator[bytes]:
        for chunk in self.chunks:
            if self.delay_seconds:
                await asyncio.sleep(self.delay_seconds)
            yield chunk

    async def aclose(self) -> None:
        return None


def _context() -> EvidenceContext:
    tenant_id = uuid.UUID("10000000-0000-0000-0000-000000000001")
    subject_id = uuid.UUID("20000000-0000-0000-0000-000000000002")
    return EvidenceContext(
        tenant_id=tenant_id,
        actor_id=subject_id,
        evidence_blocks=(
            EvidenceBlock(
                subject_id=subject_id,
                source_id=uuid.UUID("30000000-0000-0000-0000-000000000003"),
                source_version_id=uuid.UUID("40000000-0000-0000-0000-000000000004"),
                block_id=uuid.UUID("50000000-0000-0000-0000-000000000005"),
                tenant_id=tenant_id,
                text="Current role: Product Analyst",
            ),
        ),
        allowed_entity_ids=frozenset(
            {
                subject_id,
                uuid.UUID("60000000-0000-0000-0000-000000000006"),
            }
        ),
    )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("provider", "task", "schema"),
    [
        (SharedProfileProvider(None), AiTask.PROFILE_IMPORT, JobTitleAiProposal),
        (SharedIntentProvider(None, "React"), AiTask.PEOPLE_SEARCH_INTENT, CompiledIntent),
    ],
)
async def test_shared_providers_normalize_http_failures_for_gateway(
    monkeypatch, provider, task, schema
) -> None:
    async def unavailable(*_args, **_kwargs):
        raise HTTPException(502, "synthetic provider failure")

    monkeypatch.setattr("app.ai.shared_provider.send_chat", unavailable)
    gateway = AiGateway(
        {"v2": provider},
        default_provider="v2",
        prompt_version="test-profile-import",
        schema_version="test-profile-import",
    )

    result = await gateway.generate(task, schema, _context())

    assert result.status == AiStatus.FAILED
    assert result.warnings == ("provider_or_schema_failure",)


@pytest.mark.asyncio
async def test_shared_profile_provider_supplies_trusted_contract_metadata(monkeypatch) -> None:
    context = _context()
    import_id = uuid.UUID("60000000-0000-0000-0000-000000000006")
    proposal_item_id = uuid.uuid5(import_id, "jobTitle:v1")
    context = context.model_copy(
        update={"allowed_entity_ids": frozenset({context.actor_id, import_id, proposal_item_id})}
    )
    block = context.evidence_blocks[0]
    quote = "Product Analyst"
    char_start = block.text.index(quote)
    captured: dict[str, object] = {}

    async def model_response(_db, system, messages):
        captured["system"] = system
        captured["payload"] = json.loads(messages[0]["content"])
        return {
            "content": json.dumps(
                {
                    "proposal_item_id": None,
                    "import_id": None,
                    "subject_id": str(context.actor_id),
                    "job_title": {
                        "value": quote,
                        "support_status": "supported",
                        "evidence_refs": [
                            {
                                "subject_id": str(block.subject_id),
                                "source_id": str(block.source_id),
                                "source_version_id": str(block.source_version_id),
                                "block_id": str(block.block_id),
                                "tenant_id": str(block.tenant_id),
                                "char_start": 0,
                                "char_end": 1,
                                "quote": quote,
                                "quote_sha256": None,
                            }
                        ],
                    },
                }
            )
        }

    monkeypatch.setattr("app.ai.shared_provider.send_chat", model_response)

    response = await SharedProfileProvider(None).generate(AiTask.PROFILE_IMPORT, context)

    payload = captured["payload"]
    assert isinstance(payload, dict)
    assert payload["import_id"] == str(import_id)
    assert payload["proposal_item_id"] == str(proposal_item_id)
    assert '"proposal_item_id"' in str(captured["system"])
    assert response.data["import_id"] == import_id
    assert response.data["proposal_item_id"] == proposal_item_id
    assert response.data["job_title"]["support_status"] == "SUPPORTED"
    evidence_ref = response.data["job_title"]["evidence_refs"][0]
    assert evidence_ref["char_start"] == char_start
    assert evidence_ref["char_end"] == char_start + len(quote)
    assert evidence_ref["quote_sha256"] == hashlib.sha256(quote.encode()).hexdigest()


@pytest.mark.parametrize("environment", ["staging", "production"])
def test_deployed_ai_provider_requires_https(environment: str) -> None:
    with pytest.raises(ValidationError, match="AI endpoints require HTTPS"):
        Settings(
            environment=environment,
            database_url="postgresql+asyncpg://user:pass@db.invalid/careermate_v2",
            jwt_secret=SecretStr("synthetic-secret-at-least-32-characters"),
            profile_import_ai_endpoint="http://provider.invalid/v1/chat/completions",
            profile_import_ai_model="provider-model",
            profile_import_ai_api_key=SecretStr("synthetic-key"),
        )


@pytest.mark.asyncio
async def test_openai_compatible_provider_separates_instructions_and_untrusted_sources() -> None:
    requests: list[httpx.Request] = []

    def respond(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(
            200,
            json={
                "model": "provider-reported-model",
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {"proposal_item_id": "60000000-0000-0000-0000-000000000006"}
                            )
                        }
                    }
                ],
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        provider = OpenAICompatibleProvider(
            endpoint="https://provider.invalid/v1/chat/completions",
            model="configured-model",
            api_key=SecretStr("synthetic-test-key"),
            client=client,
        )
        response = await provider.generate(AiTask.PROFILE_IMPORT, _context())

    assert response.data == {"proposal_item_id": uuid.UUID("60000000-0000-0000-0000-000000000006")}
    assert response.model == "configured-model"
    assert response.warnings == ("provider_model_unverified",)
    assert len(requests) == 1
    payload = json.loads(requests[0].content)
    assert payload["model"] == "configured-model"
    assert payload["messages"][0]["role"] == "system"
    assert payload["messages"][1]["role"] == "user"
    assert "Current role: Product Analyst" not in payload["messages"][0]["content"]
    source_payload = json.loads(payload["messages"][1]["content"])
    assert source_payload["untrusted_source_blocks"] == [
        {
            "block_id": "50000000-0000-0000-0000-000000000005",
            "source_id": "30000000-0000-0000-0000-000000000003",
            "source_version_id": "40000000-0000-0000-0000-000000000004",
            "subject_id": "20000000-0000-0000-0000-000000000002",
            "tenant_id": "10000000-0000-0000-0000-000000000001",
            "text": "Current role: Product Analyst",
        }
    ]
    assert payload["tools"] == []
    assert payload["tool_choice"] == "none"
    assert payload["response_format"] == {"type": "json_object"}
    assert requests[0].headers["Authorization"] == "Bearer synthetic-test-key"
    assert requests[0].extensions["timeout"] == {
        "connect": 15.0,
        "read": 15.0,
        "write": 15.0,
        "pool": 15.0,
    }
    assert "synthetic-test-key" not in repr(provider)


@pytest.mark.asyncio
async def test_provider_uses_configured_model_when_response_omits_model() -> None:
    def respond(_: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": '{"value":"ok"}'}}]},
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        response = await OpenAICompatibleProvider(
            endpoint="https://provider.invalid/v1/chat/completions",
            model="configured-model",
            api_key=SecretStr("synthetic-test-key"),
            client=client,
        ).generate(AiTask.PROFILE_IMPORT, _context())

    assert response.model == "configured-model"
    assert response.warnings == ("provider_model_unverified",)


@pytest.mark.asyncio
async def test_provider_stops_streaming_after_response_size_cap() -> None:
    def respond(_: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            stream=AsyncChunks([b"x" * 600_000, b"y" * 600_000]),
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        provider = OpenAICompatibleProvider(
            endpoint="https://provider.invalid/v1/chat/completions",
            model="configured-model",
            api_key=SecretStr("synthetic-test-key"),
            client=client,
        )
        with pytest.raises(ValueError, match="size limit"):
            await provider.generate(AiTask.PROFILE_IMPORT, _context())


@pytest.mark.asyncio
async def test_provider_enforces_total_stream_deadline() -> None:
    def respond(_: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            stream=AsyncChunks([b"{}", b"{}"], delay_seconds=0.03),
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        provider = OpenAICompatibleProvider(
            endpoint="https://provider.invalid/v1/chat/completions",
            model="configured-model",
            api_key=SecretStr("synthetic-test-key"),
            client=client,
            timeout_seconds=0.01,
        )
        with pytest.raises(TimeoutError, match="timed out"):
            await provider.generate(AiTask.PROFILE_IMPORT, _context())


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "content",
    [
        "```json\n{}\n```",
        "[]",
        '{"value":NaN}',
    ],
)
async def test_provider_rejects_non_strict_json_objects(content: str) -> None:
    def respond(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"choices": [{"message": {"content": content}}]})

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        provider = OpenAICompatibleProvider(
            endpoint="https://provider.invalid/v1/chat/completions",
            model="configured-model",
            api_key=SecretStr("synthetic-test-key"),
            client=client,
        )
        with pytest.raises(ValueError, match="JSON object"):
            await provider.generate(AiTask.PROFILE_IMPORT, _context())


@pytest.mark.asyncio
async def test_provider_rejects_tool_calls_without_executing_them() -> None:
    def respond(_: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {
                            "content": "{}",
                            "tool_calls": [{"function": {"name": "exfiltrate"}}],
                        }
                    }
                ]
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        provider = OpenAICompatibleProvider(
            endpoint="https://provider.invalid/v1/chat/completions",
            model="configured-model",
            api_key=SecretStr("synthetic-test-key"),
            client=client,
        )
        with pytest.raises(ValueError, match="tool calls"):
            await provider.generate(AiTask.PROFILE_IMPORT, _context())


@pytest.mark.asyncio
@pytest.mark.parametrize("status_code", [408, 429, 500, 503])
async def test_provider_maps_retryable_http_statuses(status_code: int) -> None:
    def respond(_: httpx.Request) -> httpx.Response:
        return httpx.Response(status_code, json={"error": "synthetic"})

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        provider = OpenAICompatibleProvider(
            endpoint="https://provider.invalid/v1/chat/completions",
            model="configured-model",
            api_key=SecretStr("synthetic-test-key"),
            client=client,
        )
        with pytest.raises(TransientProviderError):
            await provider.generate(AiTask.PROFILE_IMPORT, _context())


def _settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "_env_file": None,
        "environment": "test",
        "database_url": "sqlite+aiosqlite://",
        "jwt_secret": "test-only-secret-that-is-at-least-32-characters",
    }
    values.update(overrides)
    return Settings(**values)  # type: ignore[arg-type]


def test_profile_import_ai_config_requires_complete_explicit_credentials() -> None:
    assert _settings().profile_import_ai_configured is False
    with pytest.raises(ValidationError, match="configured together"):
        _settings(profile_import_ai_model="configured-model")
    with pytest.raises(ValidationError):
        _settings(
            profile_import_ai_endpoint="not-a-url",
            profile_import_ai_model="configured-model",
            profile_import_ai_api_key="synthetic-test-key",
        )
    with pytest.raises(ValidationError, match="must not be blank"):
        _settings(
            profile_import_ai_endpoint="https://provider.invalid/v1/chat/completions",
            profile_import_ai_model="   ",
            profile_import_ai_api_key="synthetic-test-key",
        )
    with pytest.raises(ValidationError, match="must not be blank"):
        _settings(
            profile_import_ai_endpoint="https://provider.invalid/v1/chat/completions",
            profile_import_ai_model="configured-model",
            profile_import_ai_api_key="   ",
        )


def test_profile_import_ai_api_key_is_secret() -> None:
    settings = _settings(
        profile_import_ai_endpoint="https://provider.invalid/v1/chat/completions",
        profile_import_ai_model="configured-model",
        profile_import_ai_api_key="synthetic-test-key",
    )

    assert settings.profile_import_ai_configured is True
    assert "synthetic-test-key" not in repr(settings)


@pytest.mark.asyncio
async def test_runtime_gateway_retries_with_injected_mock_client_and_validates_schema() -> None:
    attempts = 0
    context = _context()
    block = context.evidence_blocks[0]
    proposal_item_id = next(item for item in context.allowed_entity_ids if item != context.actor_id)
    quote = "Product Analyst"
    char_start = block.text.index(quote)

    def respond(_: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            return httpx.Response(429, json={"error": "synthetic rate limit"})
        return httpx.Response(
            200,
            json={
                "model": "provider-model",
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "proposal_item_id": str(proposal_item_id),
                                    "import_id": str(proposal_item_id),
                                    "subject_id": str(context.actor_id),
                                    "job_title": {
                                        "value": quote,
                                        "support_status": "SUPPORTED",
                                        "evidence_refs": [
                                            {
                                                "subject_id": str(block.subject_id),
                                                "source_id": str(block.source_id),
                                                "source_version_id": str(block.source_version_id),
                                                "block_id": str(block.block_id),
                                                "tenant_id": str(block.tenant_id),
                                                "char_start": char_start,
                                                "char_end": char_start + len(quote),
                                                "quote": quote,
                                                "quote_sha256": hashlib.sha256(
                                                    quote.encode()
                                                ).hexdigest(),
                                            }
                                        ],
                                    },
                                }
                            )
                        }
                    }
                ],
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        gateway = build_profile_import_ai_gateway(
            endpoint="https://provider.invalid/v1/chat/completions",
            model="configured-model",
            api_key=SecretStr("synthetic-test-key"),
            timeout_seconds=0.5,
            max_attempts=2,
            client=client,
        )
        result = await gateway.generate(AiTask.PROFILE_IMPORT, JobTitleAiProposal, context)

    assert attempts == 2
    assert result.status == AiStatus.OK, result
    assert result.model == "configured-model"
    assert result.warnings == ("provider_model_unverified",)


@pytest.mark.asyncio
async def test_app_state_runtime_wiring_uses_injected_http_client_without_dependency_override() -> (
    None
):
    requests: list[httpx.Request] = []

    def respond(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(
            200,
            json={
                "model": "provider-model",
                "choices": [{"message": {"content": "{}"}}],
            },
        )

    application = FastAPI()
    settings = _settings(
        profile_import_ai_endpoint="https://provider.invalid/v1/chat/completions",
        profile_import_ai_model="configured-model",
        profile_import_ai_api_key="synthetic-test-key",
        profile_import_ai_timeout_seconds=0.5,
        profile_import_ai_max_attempts=1,
    )
    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as http_client:
        configure_profile_import_ai_runtime(application, settings, client=http_client)
        request = Request(
            {
                "type": "http",
                "method": "POST",
                "path": "/api/v2/profile-imports/id/parse",
                "headers": [],
                "app": application,
            }
        )
        gateway = await get_profile_import_ai_gateway(request, None)  # type: ignore[arg-type]
        result = await gateway.generate(AiTask.PROFILE_IMPORT, JobTitleAiProposal, _context())

    assert len(requests) == 1
    assert result.status == AiStatus.FAILED
    assert result.warnings == ("schema_validation_error",)
    assert result.model == "configured-model"
