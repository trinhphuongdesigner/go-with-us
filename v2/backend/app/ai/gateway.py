from __future__ import annotations

import hashlib
import hmac
import unicodedata
import uuid
from abc import ABC, abstractmethod
from collections.abc import Mapping
from enum import StrEnum
from typing import Annotated, Any, Literal, Protocol

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    ValidationError,
    model_validator,
)

from .resilience import CircuitBreaker, Jitter, RetryPolicy, Sleep, async_sleep, full_jitter

Sha256 = Annotated[str, StringConstraints(pattern=r"^[a-f0-9]{64}$")]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class AiTask(StrEnum):
    PROFILE_IMPORT = "profile_import"
    ROADMAP_PROPOSAL = "roadmap_proposal"
    ASSESSMENT_SUMMARY = "assessment_summary"
    OFFBOARDING_NARRATIVE = "offboarding_narrative"
    PEOPLE_SEARCH_EXPLANATION = "people_search_explanation"


EVIDENCE_REQUIRED_TASKS = frozenset(AiTask)


class AiStatus(StrEnum):
    OK = "ok"
    NEEDS_CLARIFICATION = "needs_clarification"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence"
    FAILED = "failed"


class SupportStatus(StrEnum):
    SUPPORTED = "SUPPORTED"
    AMBIGUOUS = "AMBIGUOUS"
    MISSING = "MISSING"
    SELF_ASSERTED = "SELF_ASSERTED"


class EvidenceRef(StrictModel):
    """Provider citation that must resolve to an allowed immutable source block."""

    subject_id: uuid.UUID
    source_id: uuid.UUID
    source_version_id: uuid.UUID
    block_id: uuid.UUID
    tenant_id: uuid.UUID
    char_start: int = Field(ge=0)
    char_end: int = Field(gt=0)
    quote: str = Field(min_length=1, max_length=800)
    quote_sha256: Sha256

    @model_validator(mode="after")
    def validate_span(self) -> EvidenceRef:
        if self.char_end <= self.char_start:
            raise ValueError("char_end must be greater than char_start")
        return self


class EvidenceBlock(StrictModel):
    """Trusted immutable block loaded by application code before provider invocation."""

    subject_id: uuid.UUID
    source_id: uuid.UUID
    source_version_id: uuid.UUID
    block_id: uuid.UUID
    tenant_id: uuid.UUID
    text: str = Field(min_length=1)


class EvidenceContext(StrictModel):
    tenant_id: uuid.UUID
    actor_id: uuid.UUID
    evidence_blocks: tuple[EvidenceBlock, ...] = ()
    allowed_entity_ids: frozenset[uuid.UUID] = frozenset()
    clarification_questions: tuple[str, ...] = Field(default=(), max_length=5)
    fixture_id: str | None = None


class ClaimEvidence(StrictModel):
    """Deterministic binding between one claim subject and its citations."""

    subject_id: uuid.UUID
    evidence_refs: tuple[EvidenceRef, ...] = Field(min_length=1, max_length=10)


class ProposedValue[ProposedT](StrictModel):
    value: ProposedT | None
    support_status: SupportStatus
    evidence_refs: tuple[EvidenceRef, ...] = Field(default=(), max_length=10)
    note: str | None = Field(default=None, max_length=300)

    @model_validator(mode="after")
    def validate_evidence_policy(self) -> ProposedValue[ProposedT]:
        if self.support_status == SupportStatus.SUPPORTED and not self.evidence_refs:
            raise ValueError("SUPPORTED values require evidence")
        if self.support_status == SupportStatus.MISSING and self.value is not None:
            raise ValueError("MISSING values must be null")
        if self.support_status == SupportStatus.SELF_ASSERTED:
            raise ValueError("provider output cannot be SELF_ASSERTED")
        return self


class AiOutputModel(StrictModel, ABC):
    """Protocol implemented by every provider output schema.

    Schema authors must explicitly expose all domain entity references and bind
    each person-specific claim to its own evidence references. This avoids
    guessing from field names such as ``candidate_ids`` or ``assessment_ids``.
    """

    @abstractmethod
    def referenced_entity_ids(self) -> frozenset[uuid.UUID]:
        """Return every existing domain entity ID referenced by this output."""

    @abstractmethod
    def claim_evidence(self) -> Mapping[str, ClaimEvidence]:
        """Map each person-specific claim path to its subject and supporting evidence."""


class ProviderResponse(StrictModel):
    data: dict[str, Any]
    warnings: tuple[str, ...] = ()
    model: str = Field(min_length=1, max_length=100)


class AiProvider(Protocol):
    async def generate(self, task: AiTask, context: EvidenceContext) -> ProviderResponse: ...


class DeterministicFallback(Protocol):
    fallback_id: str

    async def generate(self, task: AiTask, context: EvidenceContext) -> ProviderResponse: ...


class TransientProviderError(RuntimeError):
    """Adapter signal for retryable transport, rate-limit, or provider 5xx failures."""


class AiResult[T: AiOutputModel](StrictModel):
    status: AiStatus
    data: T | None = None
    evidence_refs: tuple[EvidenceRef, ...] = ()
    clarification_questions: tuple[str, ...] = Field(default=(), max_length=5)
    warnings: tuple[str, ...] = Field(default=(), max_length=20)
    trace_id: uuid.UUID
    prompt_version: str = Field(min_length=1, max_length=100)
    schema_version: str = Field(min_length=1, max_length=100)
    model: str = Field(min_length=1, max_length=100)
    persisted: Literal[False] = False

    @model_validator(mode="after")
    def validate_status_contract(self) -> AiResult[T]:
        if self.status == AiStatus.NEEDS_CLARIFICATION:
            if not self.clarification_questions or self.data is not None:
                raise ValueError("NEEDS_CLARIFICATION requires questions and no data")
        elif self.status in {AiStatus.INSUFFICIENT_EVIDENCE, AiStatus.FAILED}:
            if self.data is not None:
                raise ValueError(f"{self.status} must not expose usable data")
        elif self.status == AiStatus.OK and self.data is None:
            raise ValueError(f"{self.status} requires data")
        return self


EvidenceKey = tuple[uuid.UUID, uuid.UUID, uuid.UUID]


class AiGateway:
    """Provider-neutral validation boundary. It never writes domain data."""

    def __init__(
        self,
        providers: dict[str, AiProvider],
        *,
        default_provider: str,
        prompt_version: str,
        schema_version: str,
        retry_policy: RetryPolicy | None = None,
        sleep: Sleep = async_sleep,
        jitter: Jitter = full_jitter,
        circuit_breakers: Mapping[str, CircuitBreaker] | None = None,
        fallbacks: Mapping[AiTask, DeterministicFallback] | None = None,
    ) -> None:
        self._providers = dict(providers)
        self._default_provider = default_provider
        self._prompt_version = prompt_version
        self._schema_version = schema_version
        self._retry_policy = retry_policy or RetryPolicy()
        self._sleep = sleep
        self._jitter = jitter
        configured_breakers = circuit_breakers or {}
        self._circuit_breakers = {
            name: configured_breakers.get(name, CircuitBreaker()) for name in self._providers
        }
        self._fallbacks = dict(fallbacks or {})

    async def generate[T: AiOutputModel](
        self,
        task: AiTask,
        schema: type[T],
        context: EvidenceContext,
        provider: str | None = None,
    ) -> AiResult[T]:
        trace_id = uuid.uuid4()
        provider_name = provider or self._default_provider

        evidence_index, context_failure = _trusted_evidence_index(context)
        if context_failure is not None:
            return self._failure(trace_id, context_failure, "unavailable")
        if context.clarification_questions:
            return self._needs_clarification(trace_id, context.clarification_questions)
        if task in EVIDENCE_REQUIRED_TASKS and not evidence_index:
            return self._insufficient_evidence(trace_id, "unavailable")

        adapter = self._providers.get(provider_name)
        if adapter is None:
            return self._failure(trace_id, "unknown_provider", "unavailable")
        breaker = self._circuit_breakers[provider_name]
        if not breaker.allow_request():
            return await self._fallback_or_failure(
                task, schema, context, evidence_index, trace_id, "circuit_open"
            )

        response: ProviderResponse | None = None
        failure_warning = "provider_transient_failure"
        for attempt in range(1, self._retry_policy.max_attempts + 1):
            try:
                response = await adapter.generate(task, context)
                breaker.record_success()
                break
            except TimeoutError:
                failure_warning = "provider_timeout"
                breaker.record_failure()
            except (ConnectionError, TransientProviderError):
                failure_warning = "provider_transient_failure"
                breaker.record_failure()
            except ValidationError:
                return self._failure(trace_id, "schema_validation_error", "unavailable")
            except (ValueError, TypeError):
                return self._failure(trace_id, "provider_or_schema_failure", "unavailable")

            if attempt == self._retry_policy.max_attempts or not breaker.allow_request():
                return await self._fallback_or_failure(
                    task, schema, context, evidence_index, trace_id, failure_warning
                )
            base_delay = self._retry_policy.delay_before(attempt)
            delay = max(
                0.0, min(self._jitter(base_delay, attempt), self._retry_policy.max_delay_seconds)
            )
            await self._sleep(delay)

        assert response is not None
        return self._validate_response(
            task,
            schema,
            context,
            evidence_index,
            trace_id,
            response,
            status=AiStatus.OK,
        )

    def _validate_response[TResult: AiOutputModel](
        self,
        task: AiTask,
        schema: type[TResult],
        context: EvidenceContext,
        evidence_index: Mapping[EvidenceKey, EvidenceBlock],
        trace_id: uuid.UUID,
        response: ProviderResponse,
        *,
        status: Literal[AiStatus.OK],
        extra_warnings: tuple[str, ...] = (),
    ) -> AiResult[TResult]:
        try:
            data = schema.model_validate(response.data, strict=True)
        except ValidationError:
            return self._failure(trace_id, "schema_validation_error", response.model)

        try:
            claim_evidence = data.claim_evidence()
        except ValidationError:
            return self._insufficient_evidence(trace_id, response.model)
        if task in EVIDENCE_REQUIRED_TASKS and not claim_evidence:
            return self._insufficient_evidence(trace_id, response.model)

        referenced_ids = data.referenced_entity_ids()
        if not referenced_ids.issubset(context.allowed_entity_ids):
            return self._failure(trace_id, "invented_or_disallowed_id", response.model)
        for binding in claim_evidence.values():
            if (
                binding.subject_id not in referenced_ids
                or binding.subject_id not in context.allowed_entity_ids
            ):
                return self._failure(trace_id, "invented_or_disallowed_id", response.model)
            for evidence_ref in binding.evidence_refs:
                evidence_failure = _evidence_ref_failure(
                    evidence_ref,
                    claim_subject_id=binding.subject_id,
                    tenant_id=context.tenant_id,
                    evidence_index=evidence_index,
                )
                if evidence_failure is not None:
                    return self._failure(trace_id, evidence_failure, response.model)

        flattened_refs = _unique_evidence_refs(claim_evidence)

        return AiResult(
            status=status,
            data=data,
            evidence_refs=flattened_refs,
            warnings=extra_warnings + response.warnings,
            trace_id=trace_id,
            prompt_version=self._prompt_version,
            schema_version=self._schema_version,
            model=response.model,
        )

    async def _fallback_or_failure[TResult: AiOutputModel](
        self,
        task: AiTask,
        schema: type[TResult],
        context: EvidenceContext,
        evidence_index: Mapping[EvidenceKey, EvidenceBlock],
        trace_id: uuid.UUID,
        failure_warning: str,
    ) -> AiResult[TResult]:
        fallback = self._fallbacks.get(task)
        if fallback is None:
            return self._failure(trace_id, failure_warning, "unavailable")
        try:
            response = await fallback.generate(task, context)
        except (TimeoutError, ValidationError, ValueError, TypeError):
            return self._failure(trace_id, "fallback_failure", "unavailable")
        return self._validate_response(
            task,
            schema,
            context,
            evidence_index,
            trace_id,
            response,
            status=AiStatus.OK,
            extra_warnings=(f"FALLBACK_USED:{fallback.fallback_id}",),
        )

    def _needs_clarification[TResult: AiOutputModel](
        self, trace_id: uuid.UUID, questions: tuple[str, ...]
    ) -> AiResult[TResult]:
        return AiResult(
            status=AiStatus.NEEDS_CLARIFICATION,
            clarification_questions=questions,
            trace_id=trace_id,
            prompt_version=self._prompt_version,
            schema_version=self._schema_version,
            model="unavailable",
        )

    def _insufficient_evidence[TResult: AiOutputModel](
        self, trace_id: uuid.UUID, model: str
    ) -> AiResult[TResult]:
        return AiResult(
            status=AiStatus.INSUFFICIENT_EVIDENCE,
            warnings=("missing_evidence",),
            trace_id=trace_id,
            prompt_version=self._prompt_version,
            schema_version=self._schema_version,
            model=model,
        )

    def _failure[TResult: AiOutputModel](
        self, trace_id: uuid.UUID, warning: str, model: str
    ) -> AiResult[TResult]:
        return AiResult(
            status=AiStatus.FAILED,
            warnings=(warning,),
            trace_id=trace_id,
            prompt_version=self._prompt_version,
            schema_version=self._schema_version,
            model=model,
        )


def _trusted_evidence_index(
    context: EvidenceContext,
) -> tuple[dict[EvidenceKey, EvidenceBlock], str | None]:
    evidence_index: dict[EvidenceKey, EvidenceBlock] = {}
    for block in context.evidence_blocks:
        if block.tenant_id != context.tenant_id:
            return {}, "cross_tenant_evidence_context"
        if block.subject_id not in context.allowed_entity_ids:
            return {}, "disallowed_evidence_subject"
        key = (block.source_id, block.source_version_id, block.block_id)
        if key in evidence_index:
            return {}, "duplicate_evidence_block"
        evidence_index[key] = block
    return evidence_index, None


def _evidence_ref_failure(
    ref: EvidenceRef,
    claim_subject_id: uuid.UUID,
    tenant_id: uuid.UUID,
    evidence_index: Mapping[EvidenceKey, EvidenceBlock],
) -> str | None:
    if ref.tenant_id != tenant_id:
        return "invalid_evidence_reference"
    if ref.subject_id != claim_subject_id:
        return "cross_subject_evidence_reference"
    block = evidence_index.get((ref.source_id, ref.source_version_id, ref.block_id))
    if block is None:
        return "invalid_evidence_reference"
    if block.subject_id != claim_subject_id:
        return "cross_subject_evidence_reference"

    block_text = _canonical_text(block.text)
    quote = _canonical_text(ref.quote)
    if ref.char_end > len(block_text):
        return "invalid_evidence_reference"
    if block_text[ref.char_start : ref.char_end] != quote:
        return "invalid_evidence_reference"
    quote_hash = hashlib.sha256(quote.encode("utf-8")).hexdigest()
    if not hmac.compare_digest(quote_hash, ref.quote_sha256):
        return "invalid_evidence_reference"
    return None


def _canonical_text(value: str) -> str:
    normalized_newlines = value.replace("\r\n", "\n").replace("\r", "\n")
    return unicodedata.normalize("NFC", normalized_newlines)


def _unique_evidence_refs(
    claim_evidence: Mapping[str, ClaimEvidence],
) -> tuple[EvidenceRef, ...]:
    unique: dict[tuple[Any, ...], EvidenceRef] = {}
    for binding in claim_evidence.values():
        for ref in binding.evidence_refs:
            key = (
                ref.subject_id,
                ref.source_id,
                ref.source_version_id,
                ref.block_id,
                ref.tenant_id,
                ref.char_start,
                ref.char_end,
                ref.quote,
                ref.quote_sha256,
            )
            unique.setdefault(key, ref)
    return tuple(unique.values())


class FixtureAiProvider:
    """Exact synthetic fixtures for tests and demos; never echoes or writes content."""

    def __init__(self, fixtures: Mapping[tuple[AiTask, str], ProviderResponse]) -> None:
        self._fixtures = dict(fixtures)

    async def generate(self, task: AiTask, context: EvidenceContext) -> ProviderResponse:
        if context.fixture_id is None:
            raise ValueError("fixture_id is required")
        try:
            return self._fixtures[(task, context.fixture_id)]
        except KeyError as exc:
            raise ValueError("fixture is not registered") from exc
