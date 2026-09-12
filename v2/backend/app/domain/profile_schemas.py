import uuid
from datetime import datetime
from typing import Self
from unicodedata import normalize

from pydantic import EmailStr, Field, field_validator, model_validator

from app.domain.enums import Role
from app.domain.schemas import ApiModel


def _normalize_text(value: object) -> object:
    if not isinstance(value, str):
        return value
    return normalize("NFC", value).strip()


class ProfileRead(ApiModel):
    id: uuid.UUID
    email: EmailStr
    name: str
    job_title: str | None
    role: Role
    company_id: uuid.UUID | None
    company_name: str | None
    is_active: bool
    profile_version: int
    created_at: datetime
    updated_at: datetime


class ProfilePatch(ApiModel):
    profile_version: int = Field(ge=1)
    name: str = Field(default_factory=str, min_length=1, max_length=160)
    job_title: str | None = Field(default=None, min_length=1, max_length=160)

    @field_validator("name", mode="before")
    @classmethod
    def normalize_name(cls, value: object) -> object:
        if value is None:
            raise ValueError("name cannot be null")
        return _normalize_text(value)

    @field_validator("job_title", mode="before")
    @classmethod
    def normalize_job_title(cls, value: object) -> object:
        return _normalize_text(value)

    @model_validator(mode="after")
    def require_changed_field(self) -> Self:
        if not ({"name", "job_title"} & self.model_fields_set):
            raise ValueError("At least one profile field is required")
        return self


class CoreProfileConflictRead(ApiModel):
    detail: str
    current_profile_version: int


class RosterPersonRead(ApiModel):
    id: uuid.UUID
    name: str
    job_title: str | None
    is_active: bool
    profile_version: int
    updated_at: datetime


class RosterPersonDetailRead(RosterPersonRead):
    company_id: uuid.UUID


class RosterPageRead(ApiModel):
    items: list[RosterPersonRead]
    total: int
    page: int
    page_size: int


class CompanyOptionRead(ApiModel):
    id: uuid.UUID
    name: str


class CompanyOptionListRead(ApiModel):
    items: list[CompanyOptionRead]


class ErrorDetailRead(ApiModel):
    detail: str
