import hashlib
import json
import uuid
from collections.abc import Mapping
from typing import Any, Literal

import pytest
from pydantic import ValidationError

from app.ai.gateway import (
    AiGateway,
    AiOutputModel,
    AiResult,
    AiStatus,
    AiTask,
    ClaimEvidence,
    EvidenceBlock,
    EvidenceContext,
    EvidenceRef,
    FixtureAiProvider,
    ProviderResponse,
)

NAMESPACE = uuid.UUID("3e4a6ba2-fd30-4c96-908f-f915a462e2ab")


def fixture_uuid(name: str) -> uuid.UUID:
    return uuid.uuid5(NAMESPACE, name)


async def no_sleep(delay: float) -> None:
    del delay


def no_jitter(delay: float, retry_number: int) -> float:
    del delay, retry_number
    return 0


class Proposal(AiOutputModel):
    employee_id: uuid.UUID
    title: str
    title_evidence: tuple[EvidenceRef, ...]

    def referenced_entity_ids(self) -> frozenset[uuid.UUID]:
        return frozenset({self.employee_id})

    def claim_evidence(self) -> Mapping[str, ClaimEvidence]:
        return {
            "title": ClaimEvidence(
                subject_id=self.employee_id,
                evidence_refs=self.title_evidence,
            )
        }


class ReferenceLists(AiOutputModel):
    summary_subject_id: uuid.UUID
    candidate_ids: tuple[uuid.UUID, ...] = ()
    assessment_ids: tuple[uuid.UUID, ...] = ()
    skill_ids: tuple[uuid.UUID, ...] = ()
    summary: str
    summary_evidence: tuple[EvidenceRef, ...]

    def referenced_entity_ids(self) -> frozenset[uuid.UUID]:
        return frozenset(
            (self.summary_subject_id,) + self.candidate_ids + self.assessment_ids + self.skill_ids
        )

    def claim_evidence(self) -> Mapping[str, ClaimEvidence]:
        return {
            "summary": ClaimEvidence(
                subject_id=self.summary_subject_id,
                evidence_refs=self.summary_evidence,
            )
        }


class SimpleOutput(AiOutputModel):
    value: str

    def referenced_entity_ids(self) -> frozenset[uuid.UUID]:
        return frozenset()

    def claim_evidence(self) -> Mapping[str, ClaimEvidence]:
        return {}


class SpyProvider:
    def __init__(self, response: ProviderResponse) -> None:
        self.response = response
        self.call_count = 0

    async def generate(self, task: AiTask, context: EvidenceContext) -> ProviderResponse:
        self.call_count += 1
        return self.response


class MalformedJsonProvider:
    async def generate(self, task: AiTask, context: EvidenceContext) -> ProviderResponse:
        return ProviderResponse.model_validate_json('{"data": {')


class TimeoutProvider:
    async def generate(self, task: AiTask, context: EvidenceContext) -> ProviderResponse:
        raise TimeoutError


class ToolAttemptProvider:
    def __init__(self) -> None:
        self.tool_executed = False

    async def generate(self, task: AiTask, context: EvidenceContext) -> ProviderResponse:
        payload = {
            "data": {},
            "model": "fixture-v1",
            "tool_call": {"name": "write_employee_skill", "arguments": {}},
        }
        return ProviderResponse.model_validate(json.loads(json.dumps(payload)), strict=True)


def evidence_fixture(
    *,
    tenant_id: uuid.UUID | None = None,
    subject_id: uuid.UUID | None = None,
    text: str = "Kỹ sư dữ liệu tại Acme",
) -> tuple[EvidenceBlock, EvidenceRef]:
    tenant_id = tenant_id or fixture_uuid("tenant_northstar")
    subject_id = subject_id or fixture_uuid("user_alex_northstar")
    block = EvidenceBlock(
        subject_id=subject_id,
        source_id=fixture_uuid("doc_cv_alex"),
        source_version_id=fixture_uuid("srcv_cv_alex_001"),
        block_id=fixture_uuid("block_cv_alex_p1_001"),
        tenant_id=tenant_id,
        text=text,
    )
    quote = text
    ref = EvidenceRef(
        subject_id=subject_id,
        source_id=block.source_id,
        source_version_id=block.source_version_id,
        block_id=block.block_id,
        tenant_id=tenant_id,
        char_start=0,
        char_end=len(quote),
        quote=quote,
        quote_sha256=hashlib.sha256(quote.encode()).hexdigest(),
    )
    return block, ref


def fixture_context(
    *,
    allowed_ids: frozenset[uuid.UUID],
    blocks: tuple[EvidenceBlock, ...],
    fixture_id: str | None = None,
    tenant_id: uuid.UUID | None = None,
) -> EvidenceContext:
    return EvidenceContext(
        tenant_id=tenant_id or blocks[0].tenant_id,
        actor_id=fixture_uuid("user_admin_northstar"),
        evidence_blocks=blocks,
        allowed_entity_ids=allowed_ids,
        fixture_id=fixture_id,
    )


def gateway(provider: Any) -> AiGateway:
    return AiGateway(
        {"fixture": provider},
        default_provider="fixture",
        prompt_version="v0.1.0",
        schema_version="v0.1.0",
        sleep=no_sleep,
        jitter=no_jitter,
    )


@pytest.mark.asyncio
async def test_valid_typed_result_keeps_evidence_and_never_persists() -> None:
    employee_id = fixture_uuid("user_alex_northstar")
    block, evidence = evidence_fixture()
    provider = FixtureAiProvider(
        {
            (AiTask.PROFILE_IMPORT, "valid"): ProviderResponse(
                data={
                    "employee_id": employee_id,
                    "title": "Kỹ sư dữ liệu",
                    "title_evidence": (evidence,),
                },
                model="fixture-v1",
            )
        }
    )

    result = await gateway(provider).generate(
        AiTask.PROFILE_IMPORT,
        Proposal,
        fixture_context(allowed_ids=frozenset({employee_id}), blocks=(block,), fixture_id="valid"),
    )

    assert result.status == AiStatus.OK
    assert result.data is not None
    assert result.data.title == "Kỹ sư dữ liệu"
    assert result.evidence_refs == (evidence,)
    assert result.persisted is False


@pytest.mark.asyncio
@pytest.mark.parametrize("task", list(AiTask))
async def test_mandatory_task_cannot_disable_or_omit_claim_evidence(task: AiTask) -> None:
    employee_id = fixture_uuid("user_alex_northstar")
    block, _ = evidence_fixture()
    provider = FixtureAiProvider(
        {
            (task, "missing"): ProviderResponse(
                data={
                    "employee_id": employee_id,
                    "title": "Kỹ sư",
                    "title_evidence": (),
                },
                model="fixture-v1",
            )
        }
    )
    context = fixture_context(
        allowed_ids=frozenset({employee_id}), blocks=(block,), fixture_id="missing"
    )

    with pytest.raises(ValidationError):
        EvidenceContext.model_validate({**context.model_dump(), "require_evidence": False})

    result = await gateway(provider).generate(task, Proposal, context)
    assert result.status == AiStatus.INSUFFICIENT_EVIDENCE
    assert result.data is None


@pytest.mark.asyncio
async def test_cross_tenant_evidence_is_rejected_before_provider_call() -> None:
    tenant_id = fixture_uuid("tenant_northstar")
    foreign_block, foreign_ref = evidence_fixture(tenant_id=fixture_uuid("tenant_harbor"))
    employee_id = fixture_uuid("user_alex_northstar")
    provider = SpyProvider(
        ProviderResponse(
            data={
                "employee_id": employee_id,
                "title": "Kỹ sư dữ liệu",
                "title_evidence": (foreign_ref,),
            },
            model="fixture-v1",
        )
    )

    result = await gateway(provider).generate(
        AiTask.PROFILE_IMPORT,
        Proposal,
        fixture_context(
            allowed_ids=frozenset({employee_id}),
            blocks=(foreign_block,),
            tenant_id=tenant_id,
        ),
    )

    assert result.status == AiStatus.FAILED
    assert result.warnings == ("cross_tenant_evidence_context",)
    assert provider.call_count == 0


@pytest.mark.asyncio
@pytest.mark.parametrize("forge_reference_subject", [False, True])
async def test_same_tenant_cross_subject_citation_is_rejected(
    forge_reference_subject: bool,
) -> None:
    """PoC: Bob's valid block cannot substantiate an otherwise allowed Alex claim."""

    alex_id = fixture_uuid("user_alex_northstar")
    bob_id = fixture_uuid("user_bob_northstar")
    bob_block, bob_evidence = evidence_fixture(
        subject_id=bob_id,
        text="Bob là chuyên gia Kubernetes",
    )
    supplied_evidence = (
        bob_evidence.model_copy(update={"subject_id": alex_id})
        if forge_reference_subject
        else bob_evidence
    )
    provider = SpyProvider(
        ProviderResponse(
            data={
                "employee_id": alex_id,
                "title": "Chuyên gia Kubernetes",
                "title_evidence": (supplied_evidence,),
            },
            model="fixture-v1",
        )
    )

    result = await gateway(provider).generate(
        AiTask.PROFILE_IMPORT,
        Proposal,
        fixture_context(
            allowed_ids=frozenset({alex_id, bob_id}),
            blocks=(bob_block,),
        ),
    )

    assert result.status == AiStatus.FAILED
    assert result.data is None
    assert result.warnings == ("cross_subject_evidence_reference",)
    assert provider.call_count == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("corruption", ["hash", "offset", "quote"])
async def test_evidence_quote_offsets_and_hash_are_verified_against_trusted_block(
    corruption: str,
) -> None:
    employee_id = fixture_uuid("user_alex_northstar")
    block, evidence = evidence_fixture()
    corruptions: dict[str, dict[str, Any]] = {
        "hash": {"quote_sha256": "a" * 64},
        "offset": {"char_start": 1},
        "quote": {"quote": "Nội dung không có trong nguồn"},
    }
    bad_evidence = evidence.model_copy(update=corruptions[corruption])
    provider = FixtureAiProvider(
        {
            (AiTask.PROFILE_IMPORT, "bad-hash"): ProviderResponse(
                data={
                    "employee_id": employee_id,
                    "title": "Kỹ sư dữ liệu",
                    "title_evidence": (bad_evidence,),
                },
                model="fixture-v1",
            )
        }
    )

    result = await gateway(provider).generate(
        AiTask.PROFILE_IMPORT,
        Proposal,
        fixture_context(
            allowed_ids=frozenset({employee_id}), blocks=(block,), fixture_id="bad-hash"
        ),
    )

    assert result.status == AiStatus.FAILED
    assert result.warnings == ("invalid_evidence_reference",)


@pytest.mark.asyncio
@pytest.mark.parametrize("field_name", ["candidate_ids", "assessment_ids", "skill_ids"])
async def test_plural_entity_references_fail_closed(field_name: str) -> None:
    allowed_id = fixture_uuid("user_alex_northstar")
    invented_id = fixture_uuid(f"invented_{field_name}")
    block, evidence = evidence_fixture()
    data: dict[str, Any] = {
        "summary_subject_id": allowed_id,
        "candidate_ids": (),
        "assessment_ids": (),
        "skill_ids": (),
        "summary": "Tóm tắt",
        "summary_evidence": (evidence,),
    }
    data[field_name] = (invented_id,)
    provider = FixtureAiProvider(
        {
            (AiTask.PEOPLE_SEARCH_EXPLANATION, field_name): ProviderResponse(
                data=data,
                model="fixture-v1",
            )
        }
    )

    result = await gateway(provider).generate(
        AiTask.PEOPLE_SEARCH_EXPLANATION,
        ReferenceLists,
        fixture_context(
            allowed_ids=frozenset({allowed_id}), blocks=(block,), fixture_id=field_name
        ),
    )

    assert result.status == AiStatus.FAILED
    assert result.warnings == ("invented_or_disallowed_id",)


@pytest.mark.parametrize(
    ("status", "data", "questions"),
    [
        (AiStatus.OK, None, ()),
        (AiStatus.FAILED, "data", ()),
        (AiStatus.INSUFFICIENT_EVIDENCE, "data", ()),
        (AiStatus.NEEDS_CLARIFICATION, None, ()),
        (AiStatus.NEEDS_CLARIFICATION, "data", ("Question?",)),
    ],
)
def test_result_status_and_data_invariants(
    status: AiStatus, data: Literal["data"] | None, questions: tuple[str, ...]
) -> None:
    payload: dict[str, Any] = {
        "status": status,
        "data": None if data is None else {"value": data},
        "clarification_questions": questions,
        "trace_id": fixture_uuid("trace_001"),
        "prompt_version": "v0.1.0",
        "schema_version": "v0.1.0",
        "model": "fixture-v1",
    }

    with pytest.raises(ValidationError):
        AiResult[SimpleOutput].model_validate(payload)


def test_result_status_values_match_public_contract() -> None:
    assert {status.value for status in AiStatus} == {
        "ok",
        "needs_clarification",
        "insufficient_evidence",
        "failed",
    }


def test_persisted_true_is_rejected_by_envelope() -> None:
    with pytest.raises(ValidationError):
        AiResult[SimpleOutput](
            status=AiStatus.OK,
            data=SimpleOutput(value="data"),
            trace_id=fixture_uuid("trace_001"),
            prompt_version="v0.1.0",
            schema_version="v0.1.0",
            model="fixture-v1",
            persisted=True,  # type: ignore[arg-type]
        )


@pytest.mark.asyncio
async def test_malformed_provider_json_fails_closed() -> None:
    block, _ = evidence_fixture()
    result = await gateway(MalformedJsonProvider()).generate(
        AiTask.PROFILE_IMPORT,
        Proposal,
        fixture_context(allowed_ids=frozenset({block.subject_id}), blocks=(block,)),
    )
    assert result.status == AiStatus.FAILED
    assert result.data is None
    assert result.warnings == ("schema_validation_error",)


@pytest.mark.asyncio
async def test_provider_timeout_fails_closed() -> None:
    block, _ = evidence_fixture()
    result = await gateway(TimeoutProvider()).generate(
        AiTask.PROFILE_IMPORT,
        Proposal,
        fixture_context(allowed_ids=frozenset({block.subject_id}), blocks=(block,)),
    )
    assert result.status == AiStatus.FAILED
    assert result.data is None
    assert result.warnings == ("provider_timeout",)


@pytest.mark.asyncio
async def test_provider_tool_attempt_is_rejected_without_execution() -> None:
    block, _ = evidence_fixture()
    provider = ToolAttemptProvider()
    result = await gateway(provider).generate(
        AiTask.PROFILE_IMPORT,
        Proposal,
        fixture_context(allowed_ids=frozenset({block.subject_id}), blocks=(block,)),
    )
    assert result.status == AiStatus.FAILED
    assert result.data is None
    assert result.warnings == ("schema_validation_error",)
    assert provider.tool_executed is False
