"""Codex-owned additive policy tests; no provider network or real database."""

import uuid
from collections.abc import Mapping
from typing import Any

import pytest

from app.ai.gateway import (
    EVIDENCE_REQUIRED_TASKS,
    AiGateway,
    AiOutputModel,
    AiStatus,
    AiTask,
    ClaimEvidence,
    EvidenceContext,
    ProviderResponse,
    TransientProviderError,
)
from app.ai.resilience import CircuitBreaker, RetryPolicy


class IntentOutput(AiOutputModel):
    query: str

    def referenced_entity_ids(self) -> frozenset[uuid.UUID]:
        return frozenset()

    def claim_evidence(self) -> Mapping[str, ClaimEvidence]:
        return {}


class SyntheticProvider:
    def __init__(self, data: dict[str, Any], *, fail: bool = False) -> None:
        self.data = data
        self.fail = fail
        self.calls = 0

    async def generate(self, task: AiTask, context: EvidenceContext) -> ProviderResponse:
        self.calls += 1
        if self.fail:
            raise TransientProviderError("synthetic outage")
        return ProviderResponse(data=self.data, model="synthetic-policy-test")


def intent_task() -> AiTask:
    assert "PEOPLE_SEARCH_INTENT" in AiTask.__members__, "Missing reviewed intent task policy"
    return AiTask.__members__["PEOPLE_SEARCH_INTENT"]


def context() -> EvidenceContext:
    return EvidenceContext(tenant_id=uuid.UUID(int=1), actor_id=uuid.UUID(int=2))


async def no_sleep(delay: float) -> None:
    del delay


def gateway(provider: SyntheticProvider) -> AiGateway:
    return AiGateway(
        {"synthetic": provider},
        default_provider="synthetic",
        prompt_version="intent-policy-test-v1",
        schema_version="intent-policy-test-v1",
        retry_policy=RetryPolicy(max_attempts=2),
        sleep=no_sleep,
        circuit_breakers={"synthetic": CircuitBreaker(failure_threshold=2)},
    )


def test_only_intent_is_exempt_from_person_evidence_requirement() -> None:
    intent = intent_task()
    assert EVIDENCE_REQUIRED_TASKS == frozenset(task for task in AiTask if task != intent)
    assert {task.value for task in EVIDENCE_REQUIRED_TASKS} == {
        "profile_import", "roadmap_proposal", "assessment_summary",
        "offboarding_narrative", "people_search_explanation",
    }


async def test_intent_validates_structured_output_without_person_sources() -> None:
    provider = SyntheticProvider({"query": "React"})
    result = await gateway(provider).generate(intent_task(), IntentOutput, context())
    assert result.status == AiStatus.OK
    assert result.data is not None and result.data.query == "React"
    assert result.evidence_refs == () and result.persisted is False
    assert provider.calls == 1


@pytest.mark.parametrize("extra", [{"tenant_id": "foreign"}, {"candidate_ids": ["invented"]}])
async def test_intent_cannot_smuggle_scope_or_candidate_fields(extra: dict[str, Any]) -> None:
    provider = SyntheticProvider({"query": "React", **extra})
    result = await gateway(provider).generate(intent_task(), IntentOutput, context())
    assert result.status == AiStatus.FAILED and result.data is None
    assert "schema_validation_error" in result.warnings


async def test_intent_retry_and_circuit_are_bounded() -> None:
    provider = SyntheticProvider({}, fail=True)
    service = gateway(provider)
    first = await service.generate(intent_task(), IntentOutput, context())
    assert first.status == AiStatus.FAILED and provider.calls == 2
    second = await service.generate(intent_task(), IntentOutput, context())
    assert second.status == AiStatus.FAILED and provider.calls == 2
    assert "circuit_open" in second.warnings


@pytest.mark.parametrize("task", list(EVIDENCE_REQUIRED_TASKS))
async def test_person_tasks_still_require_sources_before_any_provider_call(task: AiTask) -> None:
    provider = SyntheticProvider({"query": "should never be called"})
    result = await gateway(provider).generate(task, IntentOutput, context())
    assert result.status == AiStatus.INSUFFICIENT_EVIDENCE
    assert provider.calls == 0
