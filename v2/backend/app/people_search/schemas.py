"""Strict API and typed candidate projection schemas for people search."""

from __future__ import annotations

import uuid
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.people_search.canonical_schema import CanonicalCandidateMatch
from app.people_search.search_interpretation import SearchInterpretation


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class SkillConstraint(StrictModel):
    phrase: str = Field(min_length=1, max_length=200)
    required: bool


class EmployeeSearchPlan(StrictModel):
    raw_query: str = Field(min_length=1, max_length=2000)
    required_skills: list[SkillConstraint] = Field(default_factory=list)
    preferred_skills: list[SkillConstraint] = Field(default_factory=list)
    min_experience_years: float | None = Field(default=None, ge=0, le=60)
    availability: Literal["AVAILABLE", "AVAILABLE_SOON"] | None = None
    needs_clarification: bool = False
    clarification_reason: str | None = None
    interpretation: SearchInterpretation | None = None


class ScoreFactor(StrictModel):
    code: Literal["EXPERIENCE", "TITLE_TEXT_SIGNAL", "DATA_FRESHNESS"]
    label: str
    weight: float = Field(gt=0)
    contribution: float = Field(ge=0)


class CandidateEvidence(StrictModel):
    type: Literal["user", "employment"]
    user_id: str | None = None
    employment_id: str | None = None
    job_title: str | None = None
    title: str | None = None
    status: str | None = None
    start_date: str | None = None
    end_date: str | None = None


class CandidateMatch(StrictModel):
    user_id: uuid.UUID
    name: str
    title: str | None
    company_id: uuid.UUID
    score: float = Field(ge=0, le=100)
    score_version: Literal["people-search-v1"] = "people-search-v1"
    factors: list[ScoreFactor]
    evidence: list[CandidateEvidence]

    @model_validator(mode="after")
    def factor_sum_matches_score(self) -> CandidateMatch:
        if abs(sum(f.contribution for f in self.factors) - self.score) > 1e-9:
            raise ValueError("score must equal factor contribution sum")
        return self


class SearchResponse(StrictModel):
    status: Literal[
        "ok", "empty", "needs_clarification", "insufficient_evidence", "provider_failure"
    ]
    plan: EmployeeSearchPlan
    candidates: list[
        Annotated[CandidateMatch | CanonicalCandidateMatch, Field(discriminator="score_version")]
    ] = Field(default_factory=list)
    unsupported_reasons: list[str] = Field(default_factory=list)
    explanation: str | None = None
    explanation_source: Literal["ai", "deterministic_fallback"] | None = None


class RagEvidenceRead(StrictModel):
    source_type: Literal["profile", "skill", "experience", "project"]
    source_id: uuid.UUID
    label: str = Field(min_length=1, max_length=200)
    excerpt: str = Field(min_length=1, max_length=1200)
    verified: bool


class RagCandidateRead(StrictModel):
    user_id: uuid.UUID
    name: str = Field(min_length=1, max_length=200)
    title: str | None = Field(default=None, max_length=200)
    company_id: uuid.UUID
    matched_terms: list[str] = Field(default_factory=list, max_length=30)
    reason: str = Field(min_length=1, max_length=1200)
    evidence: list[RagEvidenceRead] = Field(min_length=1, max_length=5)


class RagSearchResponse(StrictModel):
    status: Literal["ok", "empty"]
    answer: str = Field(min_length=1, max_length=4000)
    candidates: list[RagCandidateRead] = Field(default_factory=list, max_length=8)
    retrieval_mode: Literal["STRUCTURED_PROFILE_RAG"] = "STRUCTURED_PROFILE_RAG"
    answer_source: Literal["ai", "deterministic_fallback"]
    warnings: list[str] = Field(default_factory=list, max_length=10)
