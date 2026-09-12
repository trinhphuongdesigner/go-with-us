"""Public, validated interpretation; catalog identity is application-owned."""

from typing import Literal
from uuid import UUID

from pydantic import Field

from app.ai.gateway import StrictModel


class InterpretedSkill(StrictModel):
    name: str = Field(min_length=1, max_length=200)
    canonical_skill_id: UUID | None
    required: bool
    minimum_level: int | None = Field(ge=1, le=5)
    minimum_years: float | None = Field(ge=0, le=60, allow_inf_nan=False)
    minimum_years_exclusive: bool


class InterpretedDomain(StrictModel):
    name: str = Field(min_length=1, max_length=200)
    canonical_domain: str | None = Field(min_length=1, max_length=200)


class SearchInterpretation(StrictModel):
    normalized_query: str = Field(min_length=1, max_length=2000)
    skills: list[InterpretedSkill] = Field(max_length=20)
    required_domains: list[InterpretedDomain] = Field(max_length=20)
    availability: Literal["AVAILABLE", "AVAILABLE_SOON", "ANY"]
    minimum_total_years: float | None = Field(ge=0, le=60, allow_inf_nan=False)
    minimum_total_years_exclusive: bool
    title_keywords: list[str] = Field(max_length=20)
    soft_preferences: list[str] = Field(max_length=20)
    missing_fields: list[Literal["ROLE", "SKILLS", "AVAILABILITY", "TIMEFRAME"]] = Field(
        max_length=4
    )
    unsupported_constraints: list[str] = Field(max_length=20)
