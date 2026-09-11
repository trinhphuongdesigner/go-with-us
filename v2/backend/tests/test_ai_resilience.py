import hashlib
import uuid
from collections.abc import Mapping
from typing import Any

import pytest

from app.ai.gateway import (
    AiGateway,
    AiOutputModel,
    AiStatus,
    AiTask,
    ClaimEvidence,
    EvidenceBlock,
    EvidenceContext,
    EvidenceRef,
    ProviderResponse,
)
from app.ai.resilience import CircuitBreaker, RetryPolicy

NAMESPACE = uuid.UUID("3e4a6ba2-fd30-4c96-908f-f915a462e2ab")


def fixture_uuid(name: str) -> uuid.UUID:
    return uuid.uuid5(NAMESPACE, name)


class Proposal(AiOutputModel):
    employee_id: uuid.UUID
    summary: str
    summary_evidence: tuple[EvidenceRef, ...]

    def referenced_entity_ids(self) -> frozenset[uuid.UUID]:
        return frozenset({self.employee_id})

    def claim_evidence(self) -> Mapping[str, ClaimEvidence]:
        return {
            "summary": ClaimEvidence(
                subject_id=self.employee_id,
                evidence_refs=self.summary_evidence,
            )
        }


class SequenceProvider:
    def __init__(self, outcomes: list[ProviderResponse | Exception]) -> None:
        self.outcomes = outcomes
        self.call_count = 0

    async def generate(self, task: AiTask, context: EvidenceContext) -> ProviderResponse:
        outcome = self.outcomes[min(self.call_count, len(self.outcomes) - 1)]
        self.call_count += 1
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


class RecordingSleep:
    def __init__(self) -> None:
        self.delays: list[float] = []

    async def __call__(self, delay: float) -> None:
        self.delays.append(delay)


class FixedJitter:
    def __init__(self, value: float) -> None:
        self.value = value
        self.inputs: list[tuple[float, int]] = []

    def __call__(self, delay: float, retry_number: int) -> float:
        self.inputs.append((delay, retry_number))
        return self.value


class ManualClock:
    def __init__(self) -> None:
        self.now = 0.0

    def __call__(self) -> float:
        return self.now


class FixtureFallback:
    fallback_id = "roadmap-template-v1"

    def __init__(self, response: ProviderResponse) -> None:
        self.response = response
        self.call_count = 0

    async def generate(self, task: AiTask, context: EvidenceContext) -> ProviderResponse:
        self.call_count += 1
        return self.response


def test_half_open_circuit_allows_only_one_probe() -> None:
    clock = ManualClock()
    breaker = CircuitBreaker(failure_threshold=1, recovery_timeout_seconds=30, clock=clock)
    breaker.record_failure()
    clock.now = 30

    assert breaker.allow_request() is True
    assert breaker.allow_request() is False

    breaker.record_success()
    assert breaker.allow_request() is True


def evidence_fixture() -> tuple[EvidenceBlock, EvidenceRef]:
    text = "Python reporting experience"
    tenant_id = fixture_uuid("tenant_northstar")
    subject_id = fixture_uuid("user_alex_northstar")
    block = EvidenceBlock(
        subject_id=subject_id,
        source_id=fixture_uuid("doc_cv_alex"),
        source_version_id=fixture_uuid("srcv_cv_alex_001"),
        block_id=fixture_uuid("block_cv_alex_p1_001"),
        tenant_id=tenant_id,
        text=text,
    )
    ref = EvidenceRef(
        subject_id=subject_id,
        source_id=block.source_id,
        source_version_id=block.source_version_id,
        block_id=block.block_id,
        tenant_id=tenant_id,
        char_start=0,
        char_end=len(text),
        quote=text,
        quote_sha256=hashlib.sha256(text.encode()).hexdigest(),
    )
    return block, ref


def context(*, questions: tuple[str, ...] = ()) -> EvidenceContext:
    block, _ = evidence_fixture()
    return EvidenceContext(
        tenant_id=block.tenant_id,
        actor_id=fixture_uuid("user_admin_northstar"),
        evidence_blocks=(block,),
        allowed_entity_ids=frozenset({fixture_uuid("user_alex_northstar")}),
        clarification_questions=questions,
    )


def response() -> ProviderResponse:
    _, ref = evidence_fixture()
    return ProviderResponse(
        data={
            "employee_id": fixture_uuid("user_alex_northstar"),
            "summary": "Có kinh nghiệm Python",
            "summary_evidence": (ref,),
        },
        model="fixture-v1",
    )


def gateway(
    provider: Any,
    *,
    retry_policy: RetryPolicy | None = None,
    sleep: Any = None,
    jitter: Any = None,
    breaker: CircuitBreaker | None = None,
    fallback: FixtureFallback | None = None,
) -> AiGateway:
    kwargs: dict[str, Any] = {}
    if retry_policy is not None:
        kwargs["retry_policy"] = retry_policy
    if sleep is not None:
        kwargs["sleep"] = sleep
    if jitter is not None:
        kwargs["jitter"] = jitter
    if breaker is not None:
        kwargs["circuit_breakers"] = {"fixture": breaker}
    if fallback is not None:
        kwargs["fallbacks"] = {AiTask.ROADMAP_PROPOSAL: fallback}
    return AiGateway(
        {"fixture": provider},
        default_provider="fixture",
        prompt_version="v0.1.0",
        schema_version="v0.1.0",
        **kwargs,
    )


@pytest.mark.asyncio
async def test_transient_failure_retries_with_injected_jitter_and_sleep() -> None:
    provider = SequenceProvider([TimeoutError(), response()])
    sleep = RecordingSleep()
    jitter = FixedJitter(0.125)
    result = await gateway(
        provider,
        retry_policy=RetryPolicy(max_attempts=2, base_delay_seconds=0.5, max_delay_seconds=1),
        sleep=sleep,
        jitter=jitter,
    ).generate(AiTask.PROFILE_IMPORT, Proposal, context())

    assert result.status == AiStatus.OK
    assert provider.call_count == 2
    assert jitter.inputs == [(0.5, 1)]
    assert sleep.delays == [0.125]


@pytest.mark.asyncio
async def test_circuit_breaker_opens_and_blocks_provider_without_sleeping() -> None:
    provider = SequenceProvider([TimeoutError()])
    clock = ManualClock()
    breaker = CircuitBreaker(failure_threshold=2, recovery_timeout_seconds=30, clock=clock)
    ai_gateway = gateway(
        provider,
        retry_policy=RetryPolicy(max_attempts=1),
        sleep=RecordingSleep(),
        breaker=breaker,
    )

    first = await ai_gateway.generate(AiTask.PROFILE_IMPORT, Proposal, context())
    second = await ai_gateway.generate(AiTask.PROFILE_IMPORT, Proposal, context())
    third = await ai_gateway.generate(AiTask.PROFILE_IMPORT, Proposal, context())

    assert first.status == AiStatus.FAILED
    assert second.status == AiStatus.FAILED
    assert third.status == AiStatus.FAILED
    assert third.warnings == ("circuit_open",)
    assert provider.call_count == 2


@pytest.mark.asyncio
async def test_circuit_breaker_allows_half_open_probe_and_closes_on_success() -> None:
    provider = SequenceProvider([TimeoutError(), TimeoutError(), response()])
    clock = ManualClock()
    breaker = CircuitBreaker(failure_threshold=2, recovery_timeout_seconds=30, clock=clock)
    ai_gateway = gateway(
        provider,
        retry_policy=RetryPolicy(max_attempts=1),
        sleep=RecordingSleep(),
        breaker=breaker,
    )

    await ai_gateway.generate(AiTask.PROFILE_IMPORT, Proposal, context())
    await ai_gateway.generate(AiTask.PROFILE_IMPORT, Proposal, context())
    blocked = await ai_gateway.generate(AiTask.PROFILE_IMPORT, Proposal, context())
    clock.now = 30
    recovered = await ai_gateway.generate(AiTask.PROFILE_IMPORT, Proposal, context())

    assert blocked.warnings == ("circuit_open",)
    assert recovered.status == AiStatus.OK
    assert breaker.state == "closed"
    assert provider.call_count == 3


@pytest.mark.asyncio
async def test_clarification_returns_before_provider_call() -> None:
    provider = SequenceProvider([response()])
    result = await gateway(provider).generate(
        AiTask.ROADMAP_PROPOSAL,
        Proposal,
        context(questions=("Bạn muốn hướng tới vai trò nào?",)),
    )

    assert result.status == AiStatus.NEEDS_CLARIFICATION
    assert result.data is None
    assert result.clarification_questions == ("Bạn muốn hướng tới vai trò nào?",)
    assert provider.call_count == 0


@pytest.mark.asyncio
async def test_timeout_uses_labeled_deterministic_fallback_after_bounded_attempts() -> None:
    provider = SequenceProvider([TimeoutError()])
    fallback = FixtureFallback(response())
    sleep = RecordingSleep()
    result = await gateway(
        provider,
        retry_policy=RetryPolicy(max_attempts=2, base_delay_seconds=0),
        sleep=sleep,
        jitter=FixedJitter(0),
        fallback=fallback,
    ).generate(AiTask.ROADMAP_PROPOSAL, Proposal, context())

    assert result.status == AiStatus.OK
    assert result.data is not None
    assert result.warnings == ("FALLBACK_USED:roadmap-template-v1",)
    assert result.model == "fixture-v1"
    assert provider.call_count == 2
    assert fallback.call_count == 1
    assert sleep.delays == [0]
