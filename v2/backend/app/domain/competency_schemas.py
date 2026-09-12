from __future__ import annotations

import uuid
from datetime import UTC, date, datetime
from typing import Self
from unicodedata import normalize

from pydantic import AnyHttpUrl, Field, field_serializer, field_validator, model_validator

from app.domain.enums import AwardType, CertificationType, ProfileSourceType, ProfileTimelineKind
from app.domain.schemas import ApiModel


def normalize_text(value: object) -> object:
    if not isinstance(value, str):
        return value
    return normalize("NFC", " ".join(value.split()))


class VersionedCommand(ApiModel):
    profile_version: int = Field(ge=1)


class ResourcePatch(VersionedCommand):
    @model_validator(mode="after")
    def require_change(self) -> Self:
        if self.model_fields_set == {"profile_version"}:
            raise ValueError("At least one resource field is required")
        return self


class ProvenanceRead(ApiModel):
    source_type: ProfileSourceType
    source_import_id: uuid.UUID | None
    proposal_item_id: uuid.UUID | None
    created_by: uuid.UUID
    updated_by: uuid.UUID
    version: int
    created_at: datetime
    updated_at: datetime

    @field_serializer("created_at", "updated_at")
    def serialize_timestamp(self, value: datetime) -> str:
        normalized = value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)
        return normalized.isoformat().replace("+00:00", "Z")


class SkillCreate(ApiModel):
    name: str = Field(min_length=1, max_length=120)
    category: str | None = Field(default=None, min_length=1, max_length=80)

    @field_validator("name", mode="before")
    @classmethod
    def normalize_name(cls, value: object) -> object:
        return normalize_text(value)

    @field_validator("category", mode="before")
    @classmethod
    def normalize_category(cls, value: object) -> object:
        return normalize_text(value)

    @model_validator(mode="after")
    def normalized_key_fits_storage(self) -> Self:
        if len(normalize("NFC", self.name.casefold())) > 120:
            raise ValueError("Normalized skill name must be at most 120 characters")
        return self


class SkillRead(ApiModel):
    id: uuid.UUID
    name: str
    category: str | None


class SkillListRead(ApiModel):
    items: list[SkillRead]
    total: int
    page: int
    page_size: int


class EmployeeSkillInput(ApiModel):
    skill_id: uuid.UUID
    rating: int = Field(ge=1, le=5)
    note: str | None = Field(default=None, max_length=1000)

    @field_validator("note", mode="before")
    @classmethod
    def normalize_note(cls, value: object) -> object:
        return normalize_text(value)


class EmployeeSkillReplace(VersionedCommand):
    skills: list[EmployeeSkillInput] = Field(max_length=200)

    @field_validator("skills")
    @classmethod
    def unique_skills(cls, value: list[EmployeeSkillInput]) -> list[EmployeeSkillInput]:
        ids = [item.skill_id for item in value]
        if len(ids) != len(set(ids)):
            raise ValueError("Skill IDs must be unique")
        return value


class EmployeeSkillRead(ProvenanceRead):
    id: uuid.UUID
    skill_id: uuid.UUID
    name: str
    category: str | None
    rating: int
    note: str | None
    self_assessed: bool


class EmployeeSkillListRead(ApiModel):
    items: list[EmployeeSkillRead]
    profile_version: int


class ExperienceCreate(VersionedCommand):
    title: str = Field(min_length=1, max_length=180)
    organization: str = Field(min_length=1, max_length=180)
    employment_id: uuid.UUID | None = None
    description: str | None = Field(default=None, max_length=4000)
    start_date: date | None = None
    end_date: date | None = None

    @field_validator("title", "organization", "description", mode="before")
    @classmethod
    def clean_text(cls, value: object) -> object:
        return normalize_text(value)

    @model_validator(mode="after")
    def dates_in_order(self) -> Self:
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("endDate must not be before startDate")
        return self


class ExperiencePatch(ResourcePatch):
    title: str | None = Field(default=None, min_length=1, max_length=180)
    organization: str | None = Field(default=None, min_length=1, max_length=180)
    employment_id: uuid.UUID | None = None
    description: str | None = Field(default=None, max_length=4000)
    start_date: date | None = None
    end_date: date | None = None

    @field_validator("title", "organization", "description", mode="before")
    @classmethod
    def clean_text(cls, value: object) -> object:
        return normalize_text(value)

    @model_validator(mode="after")
    def required_fields_cannot_be_cleared(self) -> Self:
        for field in ("title", "organization"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class ExperienceRead(ProvenanceRead):
    id: uuid.UUID
    title: str
    organization: str
    employment_id: uuid.UUID | None
    description: str | None
    start_date: date | None
    end_date: date | None


class ProjectCreate(VersionedCommand):
    name: str = Field(min_length=1, max_length=180)
    role: str = Field(min_length=1, max_length=180)
    employment_id: uuid.UUID | None = None
    domain: str | None = Field(default=None, max_length=180)
    description: str | None = Field(default=None, max_length=4000)
    tech_stack: list[str] = Field(default_factory=list, max_length=100)
    contribution: str | None = Field(default=None, max_length=4000)
    url: AnyHttpUrl | None = None
    start_date: date | None = None
    end_date: date | None = None

    @field_validator("name", "role", "domain", "description", "contribution", mode="before")
    @classmethod
    def clean_text(cls, value: object) -> object:
        return normalize_text(value)

    @model_validator(mode="after")
    def dates_in_order(self) -> Self:
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("endDate must not be before startDate")
        return self

    @field_validator("tech_stack")
    @classmethod
    def normalize_tech_stack(cls, value: list[str]) -> list[str]:
        cleaned = [str(normalize_text(item)) for item in value]
        if any(not item or len(item) > 80 for item in cleaned):
            raise ValueError("techStack values must be 1-80 characters")
        if len({item.casefold() for item in cleaned}) != len(cleaned):
            raise ValueError("techStack values must be unique")
        return cleaned

    @field_serializer("url")
    def serialize_url(self, value: AnyHttpUrl | None) -> str | None:
        return str(value) if value else None


class ProjectPatch(ResourcePatch):
    name: str | None = Field(default=None, min_length=1, max_length=180)
    role: str | None = Field(default=None, min_length=1, max_length=180)
    employment_id: uuid.UUID | None = None
    domain: str | None = Field(default=None, max_length=180)
    description: str | None = Field(default=None, max_length=4000)
    tech_stack: list[str] | None = Field(default=None, max_length=100)
    contribution: str | None = Field(default=None, max_length=4000)
    url: AnyHttpUrl | None = None
    start_date: date | None = None
    end_date: date | None = None

    @field_validator("name", "role", "domain", "description", "contribution", mode="before")
    @classmethod
    def clean_text(cls, value: object) -> object:
        return normalize_text(value)

    @field_serializer("url")
    def serialize_url(self, value: AnyHttpUrl | None) -> str | None:
        return str(value) if value else None

    @field_validator("tech_stack")
    @classmethod
    def normalize_tech_stack(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        return ProjectCreate.normalize_tech_stack(value)

    @model_validator(mode="after")
    def required_fields_cannot_be_cleared(self) -> Self:
        for field in ("name", "role"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class ProjectRead(ProvenanceRead):
    id: uuid.UUID
    name: str
    role: str
    employment_id: uuid.UUID | None
    domain: str | None
    description: str | None
    tech_stack: list[str]
    contribution: str | None
    url: str | None
    start_date: date | None
    end_date: date | None


class CertificationCreate(VersionedCommand):
    name: str = Field(min_length=1, max_length=180)
    type: CertificationType
    issuer: str = Field(min_length=1, max_length=180)
    score: str | None = Field(default=None, max_length=120)
    credential_url: AnyHttpUrl | None = None
    issued_at: date | None = None
    expires_at: date | None = None

    @field_validator("name", "issuer", "score", mode="before")
    @classmethod
    def clean_text(cls, value: object) -> object:
        return normalize_text(value)

    @model_validator(mode="after")
    def dates_in_order(self) -> Self:
        if self.issued_at and self.expires_at and self.expires_at < self.issued_at:
            raise ValueError("expiresAt must not be before issuedAt")
        return self

    @field_serializer("credential_url")
    def serialize_url(self, value: AnyHttpUrl | None) -> str | None:
        return str(value) if value else None


class CertificationPatch(ResourcePatch):
    name: str | None = Field(default=None, min_length=1, max_length=180)
    type: CertificationType | None = None
    issuer: str | None = Field(default=None, min_length=1, max_length=180)
    score: str | None = Field(default=None, max_length=120)
    credential_url: AnyHttpUrl | None = None
    issued_at: date | None = None
    expires_at: date | None = None

    @field_validator("name", "issuer", "score", mode="before")
    @classmethod
    def clean_text(cls, value: object) -> object:
        return normalize_text(value)

    @field_serializer("credential_url")
    def serialize_url(self, value: AnyHttpUrl | None) -> str | None:
        return str(value) if value else None

    @model_validator(mode="after")
    def required_fields_cannot_be_cleared(self) -> Self:
        for field in ("name", "type", "issuer"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class CertificationRead(ProvenanceRead):
    id: uuid.UUID
    name: str
    type: CertificationType
    issuer: str
    score: str | None
    credential_url: str | None
    issued_at: date | None
    expires_at: date | None


class AwardCreate(VersionedCommand):
    name: str = Field(min_length=1, max_length=180)
    type: AwardType
    issuer: str = Field(min_length=1, max_length=180)
    description: str | None = Field(default=None, max_length=4000)
    evidence_url: AnyHttpUrl | None = None
    awarded_at: date | None = None

    @field_validator("name", "issuer", "description", mode="before")
    @classmethod
    def clean_text(cls, value: object) -> object:
        return normalize_text(value)

    @field_serializer("evidence_url")
    def serialize_url(self, value: AnyHttpUrl | None) -> str | None:
        return str(value) if value else None


class AwardPatch(ResourcePatch):
    name: str | None = Field(default=None, min_length=1, max_length=180)
    type: AwardType | None = None
    issuer: str | None = Field(default=None, min_length=1, max_length=180)
    description: str | None = Field(default=None, max_length=4000)
    evidence_url: AnyHttpUrl | None = None
    awarded_at: date | None = None

    @field_validator("name", "issuer", "description", mode="before")
    @classmethod
    def clean_text(cls, value: object) -> object:
        return normalize_text(value)

    @field_serializer("evidence_url")
    def serialize_url(self, value: AnyHttpUrl | None) -> str | None:
        return str(value) if value else None

    @model_validator(mode="after")
    def required_fields_cannot_be_cleared(self) -> Self:
        for field in ("name", "type", "issuer"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class AwardRead(ProvenanceRead):
    id: uuid.UUID
    name: str
    type: AwardType
    issuer: str
    description: str | None
    evidence_url: str | None
    awarded_at: date | None
    self_reported: bool


class ResourceListRead(ApiModel):
    items: list[ExperienceRead | ProjectRead | CertificationRead | AwardRead]
    profile_version: int


class EmploymentRead(ApiModel):
    id: uuid.UUID
    title: str
    start_date: datetime
    end_date: datetime | None


class CompetencyUserRead(ApiModel):
    id: uuid.UUID
    name: str
    job_title: str | None


class TimelineItemRead(ApiModel):
    id: uuid.UUID
    kind: ProfileTimelineKind
    title: str
    subtitle: str
    start_date: date
    end_date: date | None
    source_type: ProfileSourceType | None


class CompetencyProfileRead(ApiModel):
    user: CompetencyUserRead
    skills: list[EmployeeSkillRead]
    experiences: list[ExperienceRead]
    projects: list[ProjectRead]
    certifications: list[CertificationRead]
    awards: list[AwardRead]
    employments: list[EmploymentRead]
    timeline: list[TimelineItemRead]
    version: int


class ProfileResourceConflictRead(ApiModel):
    detail: str
    current_profile_version: int
