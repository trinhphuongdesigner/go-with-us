"""Adapt the configured v2 connection to existing evidence-validation gateways."""
import json

from app.ai.gateway import AiTask, EvidenceContext, ProviderResponse
from app.ai.provider_runtime import _SYSTEM_INSTRUCTION, _profile_import_native_types
from app.career_ai.provider import json_reply, send_chat


class SharedProfileProvider:
    def __init__(self, db):
        self.db = db

    async def generate(self, task: AiTask, context: EvidenceContext) -> ProviderResponse:
        payload = {"task": task.value, "tenant_id": str(context.tenant_id),
                   "actor_id": str(context.actor_id),
                   "allowed_entity_ids": sorted(str(item) for item in context.allowed_entity_ids),
                   "untrusted_source_blocks": [{"block_id": str(block.block_id),
                       "source_id": str(block.source_id), "source_version_id": str(block.source_version_id),
                       "subject_id": str(block.subject_id), "tenant_id": str(block.tenant_id),
                       "text": block.text} for block in context.evidence_blocks]}
        result = await send_chat(self.db, _SYSTEM_INSTRUCTION,
                                [{"role": "user", "content": json.dumps(payload, ensure_ascii=False)}])
        data = _profile_import_native_types(json_reply(result["content"]))
        return ProviderResponse(data=data, model="configured-v2-connection",
                                warnings=("provider_model_unverified",))


class SharedIntentProvider:
    def __init__(self, db, query):
        self.db, self.query = db, query

    async def generate(self, task: AiTask, context: EvidenceContext) -> ProviderResponse:
        from app.people_search.intent_models import CompiledIntent
        from app.people_search.providers.madison import _INTENT_SYSTEM
        prompt = _INTENT_SYSTEM + "\nReturn JSON only matching this schema (no tools):\n" + json.dumps(CompiledIntent.model_json_schema())
        result = await send_chat(self.db, prompt, [{"role": "user", "content": self.query}])
        return ProviderResponse(data=json_reply(result["content"]), model="configured-v2-connection",
                                warnings=("provider_model_unverified",))
