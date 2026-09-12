"""Public canonical results; immutable citations stay distinct from legacy rows.

These validators enforce response consistency, not factual truth. The repository
and ranker must validate source lineage and visibility before serialization.
"""

from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import AwareDatetime, Field, model_validator

from app.ai.gateway import EvidenceRef, StrictModel


class CanonicalScoreFactor(StrictModel):
    code: Literal[
        "REQUIRED_SKILL",
        "PREFERRED_SKILL",
        "EXPERIENCE",
        "DOMAIN",
        "AVAILABILITY",
        "DATA_FRESHNESS",
    ]
    points: float = Field(ge=0, le=100, allow_inf_nan=False)
    maximum_points: float = Field(gt=0, le=100, allow_inf_nan=False)
    evidence_refs: list[EvidenceRef] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_contribution(self) -> CanonicalScoreFactor:
        if self.points > self.maximum_points:
            raise ValueError("factor exceeds maximum points")
        if self.points > 0 and not self.evidence_refs:
            raise ValueError("positive factors require evidence")
        return self


class CanonicalCandidateMatch(StrictModel):
    candidate_id: UUID
    company_id: UUID
    name: str = Field(min_length=1, max_length=200)
    title: str | None = Field(default=None, max_length=200)
    score: float = Field(ge=0, le=100, allow_inf_nan=False)
    score_version: Literal["people-search-canonical-v1"] = "people-search-canonical-v1"
    score_factors: list[CanonicalScoreFactor] = Field(min_length=1, max_length=6)
    evidence_refs: list[EvidenceRef] = Field(min_length=1)
    data_freshness_at: AwareDatetime
    explanation: str | None = None

    @model_validator(mode="after")
    def validate_score_and_binding(self) -> CanonicalCandidateMatch:
        if sum(factor.points for factor in self.score_factors) != self.score:
            raise ValueError("score must equal factor sum")
        if len({factor.code for factor in self.score_factors}) != len(self.score_factors):
            raise ValueError("duplicate score factor")
        indexed = {ref.model_dump_json() for ref in self.evidence_refs}
        factor_refs = [ref for factor in self.score_factors for ref in factor.evidence_refs]
        if indexed != {ref.model_dump_json() for ref in factor_refs}:
            raise ValueError("candidate evidence must match factor evidence")
        if any(
            ref.subject_id != self.candidate_id or ref.tenant_id != self.company_id
            for ref in [*self.evidence_refs, *factor_refs]
        ):
            raise ValueError("evidence belongs to another candidate or tenant")
        return self
