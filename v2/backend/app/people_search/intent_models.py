"""Internal model proposal and deterministic resolved intent; not the public API."""

from __future__ import annotations

import uuid
from collections.abc import Mapping
from typing import Annotated, Literal

from pydantic import Field, StringConstraints

from app.ai.gateway import AiOutputModel, ClaimEvidence
from app.people_search.schemas import StrictModel

IntentTerm = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]


class ProposedSkill(StrictModel):
    name: IntentTerm
    required: bool
    minimum_level: int | None = Field(default=None, ge=1, le=5)
    minimum_years: float | None = Field(default=None, ge=0, le=60, allow_inf_nan=False)
    minimum_years_exclusive: bool = False


class CompiledIntent(AiOutputModel):
    """Provider may name constraints, never IDs, candidates, SQL or score arithmetic."""

    normalized_query: str = Field(min_length=1, max_length=2000)
    skills: list[ProposedSkill] = Field(max_length=20)
    required_domains: list[IntentTerm] = Field(max_length=20)
    availability: Literal["AVAILABLE", "AVAILABLE_SOON", "ANY"]
    title_keywords: list[IntentTerm] = Field(max_length=20)
    minimum_total_years: float | None = Field(ge=0, le=60, allow_inf_nan=False)
    minimum_total_years_exclusive: bool = False
    soft_preferences: list[IntentTerm] = Field(max_length=20)
    sensitive_constraints_detected: bool
    missing_fields: list[Literal["ROLE", "SKILLS", "AVAILABILITY", "TIMEFRAME"]] = Field(
        max_length=4
    )
    unsupported_constraints: list[IntentTerm] = Field(max_length=20)

    def referenced_entity_ids(self) -> frozenset[uuid.UUID]:
        return frozenset()

    def claim_evidence(self) -> Mapping[str, ClaimEvidence]:
        return {}


class ResolvedSkill(StrictModel):
    canonical_skill_id: uuid.UUID
    name: IntentTerm
    required: bool
    minimum_level: int | None = Field(default=None, ge=1, le=5)
    minimum_years: float | None = Field(default=None, ge=0, le=60, allow_inf_nan=False)
    minimum_years_exclusive: bool = False


class ResolvedSearchIntent(StrictModel):
    """Application-owned IDs from the injected catalog; W1 ranking consumes this."""

    skills: list[ResolvedSkill] = Field(default_factory=list, max_length=20)
    unresolved_required_skills: list[IntentTerm] = Field(default_factory=list, max_length=20)
    unresolved_preferred_skills: list[IntentTerm] = Field(default_factory=list, max_length=20)
    unresolved_required_domains: list[IntentTerm] = Field(default_factory=list, max_length=20)
    required_domains: list[IntentTerm] = Field(default_factory=list, max_length=20)
    availability: Literal["AVAILABLE", "AVAILABLE_SOON", "ANY"] = "ANY"
    title_keywords: list[IntentTerm] = Field(default_factory=list, max_length=20)
    minimum_total_years: float | None = Field(default=None, ge=0, le=60, allow_inf_nan=False)
    minimum_total_years_exclusive: bool = False
    soft_preferences: list[IntentTerm] = Field(default_factory=list, max_length=20)
    unsupported_constraints: list[IntentTerm] = Field(default_factory=list, max_length=20)
