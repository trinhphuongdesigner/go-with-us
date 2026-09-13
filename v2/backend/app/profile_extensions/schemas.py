import uuid
from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


class StrictPayload(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class DetailsPatch(StrictPayload):
    expectedVersion: int = Field(ge=0)
    phone: str | None = Field(default=None, max_length=40)
    dateOfBirth: date | None = None
    idNumber: str | None = Field(default=None, max_length=80)
    gender: str | None = Field(default=None, max_length=80)
    emergencyContactName: str | None = Field(default=None, max_length=160)
    emergencyContactPhone: str | None = Field(default=None, max_length=40)
    avatarAssetId: uuid.UUID | None = None


class AdminDetailsPatch(DetailsPatch):
    onboardDate: date | None = None
    attitudeScore: float | None = Field(default=None, ge=0, le=100)
    contributionAdjustment: int | None = Field(default=None, ge=0, le=1000000)


class PersonalDetailsRead(StrictPayload):
    version: int = Field(ge=0)
    avatarAssetId: uuid.UUID | None = None
    contributionScore: int = Field(ge=0)
    phone: str | None = None
    dateOfBirth: date | None = None
    idNumber: str | None = None
    gender: str | None = None
    emergencyContactName: str | None = None
    emergencyContactPhone: str | None = None
    onboardDate: date | None = None
    attitudeScore: float | None = None
    contributionAdjustment: int | None = None


class ManagedInsightProfile(StrictPayload):
    id: uuid.UUID
    name: str
    jobTitle: str | None
    contributionScore: int
    attitudeScore: float | None
    assessmentContributionScore: float | None
    assessmentAttitudeScore: float | None


class ManagedSkillRead(StrictPayload):
    id: uuid.UUID
    skillId: uuid.UUID
    name: str
    category: str | None
    level: int
    note: str | None
    sourceType: str


class ManagedSkillInsightRead(StrictPayload):
    profile: ManagedInsightProfile
    skills: list[ManagedSkillRead]
    goalStatusCounts: dict[str, int]
    activityCount: int
    assessmentsReceivedCount: int


class EmploymentWrite(StrictPayload):
    title: str = Field(min_length=1, max_length=255)
    startDate: date
    endDate: date | None = None


class EmploymentEnd(StrictPayload):
    expectedVersion: int = Field(ge=1)
    endDate: date


class ActivityWrite(StrictPayload):
    title: str = Field(min_length=1, max_length=180)
    description: str | None = Field(default=None, max_length=10000)
    category: str | None = Field(default=None, max_length=80)
    date: date
    evidenceUrl: HttpUrl | None = None
    evidenceAssetId: uuid.UUID | None = None


class ActivityPatch(ActivityWrite):
    expectedVersion: int = Field(ge=1)


class RequestCreate(StrictPayload):
    sourceType: Literal["CERTIFICATION", "AWARD"]
    sourceId: uuid.UUID
    employmentId: uuid.UUID
    recipientUserId: uuid.UUID
    clientRequestId: uuid.UUID
    message: str | None = Field(default=None, max_length=4000)


class RequestReview(StrictPayload):
    status: Literal["APPROVED", "REJECTED"]
    pointsAwarded: int = Field(default=0, ge=0, le=100)
    reviewNote: str | None = Field(default=None, max_length=4000)
