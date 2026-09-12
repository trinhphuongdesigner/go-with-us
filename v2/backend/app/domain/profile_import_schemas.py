from __future__ import annotations

import uuid
from collections.abc import Mapping
from datetime import datetime
from typing import Annotated, Literal

from pydantic import ConfigDict, Field, StrictBool, StrictInt

from app.ai.gateway import AiOutputModel, AiStatus, ClaimEvidence, ProposedValue, SupportStatus
from app.domain.enums import ProfileImportStatus
from app.domain.schemas import ApiModel


class JobTitleAiProposal(AiOutputModel):
    proposal_item_id: uuid.UUID
    import_id: uuid.UUID
    subject_id: uuid.UUID
    job_title: ProposedValue[str]

    def referenced_entity_ids(self) -> frozenset[uuid.UUID]:
        return frozenset({self.proposal_item_id, self.import_id, self.subject_id})

    def claim_evidence(self) -> Mapping[str, ClaimEvidence]:
        if not self.job_title.evidence_refs:
            return {}
        return {
            "$.jobTitle": ClaimEvidence(
                subject_id=self.subject_id,
                evidence_refs=self.job_title.evidence_refs,
            )
        }


class ProfileImportApiModel(ApiModel):
    model_config = ConfigDict(
        alias_generator=lambda value: (
            value.split("_")[0] + "".join(part.title() for part in value.split("_")[1:])
        ),
        populate_by_name=True,
        extra="forbid",
        from_attributes=True,
    )


class ProfileImportRead(ProfileImportApiModel):
    id: uuid.UUID
    status: ProfileImportStatus
    file_name: str
    mime_type: str
    size_bytes: int
    sha256: str
    version: int
    proposal_version: int
    created_at: datetime
    updated_at: datetime


class ProfileImportList(ProfileImportApiModel):
    items: list[ProfileImportRead]
    total: int
    page: int
    page_size: int


class ProfileEvidenceRead(ProfileImportApiModel):
    source_id: uuid.UUID
    source_version_id: uuid.UUID
    block_id: uuid.UUID
    char_start: int
    char_end: int
    quote: str
    quote_sha256: str
    page_number: int | None
    sheet_name: str | None
    context: str


class ProfileProposalItemRead(ProfileImportApiModel):
    proposal_item_id: uuid.UUID
    field: str
    value: str | None
    support_status: SupportStatus
    evidence_refs: list[ProfileEvidenceRead]


class ProfileProposalRead(ProfileImportApiModel):
    id: uuid.UUID
    version: int
    items: list[ProfileProposalItemRead]


class ProfileImportDetailRead(ProfileImportRead):
    profile_version: int
    ai_status: AiStatus | None
    clarification_questions: list[str]
    warnings: list[str]
    trace_id: uuid.UUID | None
    prompt_version: str | None
    schema_version: str | None
    model: str | None
    proposal: ProfileProposalRead | None


class ProfileImportParseRead(ProfileImportApiModel):
    id: uuid.UUID
    status: ProfileImportStatus
    proposal_version: int
    profile_version: int
    ai_status: AiStatus
    clarification_questions: list[str]
    warnings: list[str]
    trace_id: uuid.UUID
    prompt_version: str
    schema_version: str
    model: str
    proposal: ProfileProposalRead | None


class ProfileApplyItem(ProfileImportApiModel):
    proposal_item_id: uuid.UUID
    selected: StrictBool


class ProfileApplyRequest(ProfileImportApiModel):
    proposal_version: Annotated[StrictInt, Field(ge=1)]
    profile_version: Annotated[StrictInt, Field(ge=1)]
    items: list[ProfileApplyItem] = Field(min_length=1, max_length=20)


class ProfileApplyRead(ProfileImportApiModel):
    command_id: uuid.UUID
    status: Literal["APPLIED", "ALREADY_APPLIED"]
    created_entity_ids: list[uuid.UUID]
    skipped_item_ids: list[uuid.UUID]
    profile_version: int


class ProfileConflictRead(ProfileImportApiModel):
    detail: str
    current_profile_version: int | None = None
    current_proposal_version: int | None = None
