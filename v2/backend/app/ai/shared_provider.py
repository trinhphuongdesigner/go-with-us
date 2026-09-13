"""Adapt the configured v2 connection to existing evidence-validation gateways."""

import hashlib
import json
import unicodedata
import uuid
from typing import Any

from fastapi import HTTPException

from app.ai.gateway import AiTask, EvidenceContext, ProviderResponse
from app.ai.provider_runtime import _SYSTEM_INSTRUCTION, _profile_import_native_types
from app.career_ai.provider import json_reply, send_chat

_PROFILE_OUTPUT_INSTRUCTION = """
Return JSON only, using this exact shape:
{"proposal_item_id":"UUID","import_id":"UUID","subject_id":"UUID","job_title":{"value":"job title or null","support_status":"SUPPORTED|AMBIGUOUS|MISSING","evidence_refs":[{"subject_id":"UUID","source_id":"UUID","source_version_id":"UUID","block_id":"UUID","tenant_id":"UUID","char_start":0,"char_end":1,"quote":"exact source span","quote_sha256":null}],"note":null}}
Copy all UUIDs and source offsets exactly. The server derives quote_sha256 deterministically.
""".strip()


def _normalize_provider_error(error: HTTPException) -> None:
    """Keep transport-specific HTTP errors inside the gateway failure contract."""
    if error.status_code == 504:
        raise TimeoutError("configured AI provider timed out") from None
    raise ValueError("configured AI provider returned an invalid response") from None


def _profile_import_contract_ids(context: EvidenceContext) -> tuple[uuid.UUID, uuid.UUID]:
    candidates = context.allowed_entity_ids - {context.actor_id}
    matches = [
        (candidate, uuid.uuid5(candidate, "jobTitle:v1"))
        for candidate in candidates
        if uuid.uuid5(candidate, "jobTitle:v1") in candidates
    ]
    if len(matches) != 1:
        raise ValueError("profile import context has ambiguous contract identifiers")
    return matches[0]


def _supply_trusted_profile_metadata(
    data: dict[str, Any],
    context: EvidenceContext,
    import_id: uuid.UUID,
    proposal_item_id: uuid.UUID,
) -> dict[str, Any]:
    """Fill deterministic metadata that the model must not be asked to invent."""
    normalized = dict(data)
    for key, trusted_value in (
        ("proposal_item_id", proposal_item_id),
        ("import_id", import_id),
        ("subject_id", context.actor_id),
    ):
        if normalized.get(key) is None:
            normalized[key] = str(trusted_value)

    raw_job_title = normalized.get("job_title")
    if not isinstance(raw_job_title, dict):
        return normalized
    job_title = dict(raw_job_title)
    support_status = job_title.get("support_status")
    if isinstance(support_status, str):
        job_title["support_status"] = support_status.upper()
    raw_refs = job_title.get("evidence_refs")
    if isinstance(raw_refs, list):
        block_by_id = {str(block.block_id): block for block in context.evidence_blocks}
        refs: list[Any] = []
        for raw_ref in raw_refs:
            if not isinstance(raw_ref, dict):
                refs.append(raw_ref)
                continue
            evidence_ref = dict(raw_ref)
            quote = evidence_ref.get("quote")
            block = block_by_id.get(str(evidence_ref.get("block_id")))
            if block is not None and isinstance(quote, str):
                block_text = unicodedata.normalize(
                    "NFC", block.text.replace("\r\n", "\n").replace("\r", "\n")
                )
                canonical_quote = unicodedata.normalize(
                    "NFC", quote.replace("\r\n", "\n").replace("\r", "\n")
                )
                char_start = block_text.find(canonical_quote)
                if char_start >= 0 and block_text.find(canonical_quote, char_start + 1) < 0:
                    evidence_ref.update(
                        {
                            "subject_id": str(block.subject_id),
                            "source_id": str(block.source_id),
                            "source_version_id": str(block.source_version_id),
                            "block_id": str(block.block_id),
                            "tenant_id": str(block.tenant_id),
                            "char_start": char_start,
                            "char_end": char_start + len(canonical_quote),
                            "quote": canonical_quote,
                        }
                    )
                    quote = canonical_quote
            if isinstance(quote, str):
                evidence_ref["quote_sha256"] = hashlib.sha256(quote.encode("utf-8")).hexdigest()
            refs.append(evidence_ref)
        job_title["evidence_refs"] = refs
    normalized["job_title"] = job_title
    return normalized


class SharedProfileProvider:
    def __init__(self, db):
        self.db = db

    async def generate(self, task: AiTask, context: EvidenceContext) -> ProviderResponse:
        import_id, proposal_item_id = _profile_import_contract_ids(context)
        payload = {
            "task": task.value,
            "tenant_id": str(context.tenant_id),
            "actor_id": str(context.actor_id),
            "import_id": str(import_id),
            "proposal_item_id": str(proposal_item_id),
            "allowed_entity_ids": sorted(str(item) for item in context.allowed_entity_ids),
            "untrusted_source_blocks": [
                {
                    "block_id": str(block.block_id),
                    "source_id": str(block.source_id),
                    "source_version_id": str(block.source_version_id),
                    "subject_id": str(block.subject_id),
                    "tenant_id": str(block.tenant_id),
                    "text": block.text,
                }
                for block in context.evidence_blocks
            ],
        }
        prompt = (
            _SYSTEM_INSTRUCTION
            + "\nThe labeled actor_id, import_id, and proposal_item_id are authoritative. "
            "Copy them exactly. Do not call tools.\n" + _PROFILE_OUTPUT_INSTRUCTION
        )
        try:
            result = await send_chat(
                self.db,
                prompt,
                [{"role": "user", "content": json.dumps(payload, ensure_ascii=False)}],
            )
            raw_data = _supply_trusted_profile_metadata(
                json_reply(result["content"]), context, import_id, proposal_item_id
            )
            data = _profile_import_native_types(raw_data)
        except HTTPException as error:
            _normalize_provider_error(error)
        return ProviderResponse(
            data=data, model="configured-v2-connection", warnings=("provider_model_unverified",)
        )


class SharedIntentProvider:
    def __init__(self, db, query):
        self.db, self.query = db, query

    async def generate(self, task: AiTask, context: EvidenceContext) -> ProviderResponse:
        from app.people_search.intent_models import CompiledIntent
        from app.people_search.providers.madison import _INTENT_SYSTEM

        prompt = (
            _INTENT_SYSTEM
            + "\nReturn JSON only matching this schema (no tools):\n"
            + json.dumps(CompiledIntent.model_json_schema())
        )
        try:
            result = await send_chat(self.db, prompt, [{"role": "user", "content": self.query}])
            data = json_reply(result["content"])
        except HTTPException as error:
            _normalize_provider_error(error)
        return ProviderResponse(
            data=data, model="configured-v2-connection", warnings=("provider_model_unverified",)
        )
