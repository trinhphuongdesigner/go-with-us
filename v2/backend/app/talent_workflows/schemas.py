import uuid
from datetime import date, datetime
from typing import Annotated, Any, Literal

from pydantic import Field, StringConstraints, model_validator

from app.domain.schemas import ApiModel

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=180)]


class VersionInput(ApiModel):
    expected_version: int = Field(ge=1)


class Question(ApiModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), min_length=1, max_length=80)
    text: Title
    guidance: str = Field(default="", max_length=2000)
    weight: float = Field(default=1, ge=0, le=10000, allow_inf_nan=False)
    max_score: int = Field(default=10, ge=1, le=100)


class Group(ApiModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), min_length=1, max_length=80)
    name: Title
    description: str = Field(default="", max_length=2000)
    weight: float = Field(default=1, ge=0, le=10000, allow_inf_nan=False)
    score_dimension: Literal["CONTRIBUTION", "ATTITUDE"] = "CONTRIBUTION"
    questions: list[Question] = Field(min_length=1, max_length=100)


class TemplateInput(ApiModel):
    company_id: uuid.UUID | None = None
    name: Title
    description: str = Field(default="", max_length=4000)
    groups: list[Group] = Field(min_length=1, max_length=30)

    @model_validator(mode="after")
    def valid_scale(self) -> "TemplateInput":
        identifiers = [q.id for g in self.groups for q in g.questions]
        if len(identifiers) != len(set(identifiers)) or len({g.id for g in self.groups}) != len(
            self.groups
        ):
            raise ValueError("Group and question identifiers must be unique")
        if not any(g.weight > 0 for g in self.groups) or any(
            not any(q.weight > 0 for q in g.questions) for g in self.groups
        ):
            raise ValueError("Groups and questions need positive scoring weights")
        return self


class TemplateEdit(TemplateInput, VersionInput):
    pass


class TemplateRead(TemplateInput):
    id: uuid.UUID
    family_id: uuid.UUID
    version: int
    status: Literal["DRAFT", "ACTIVE", "ARCHIVED"]
    created_at: datetime


class CycleInput(ApiModel):
    company_id: uuid.UUID | None = None
    template_id: uuid.UUID
    name: Title
    period: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    due_date: date | None = None


class CyclePatch(VersionInput):
    status: Literal["OPEN", "CLOSED"]


class CycleRead(CycleInput):
    id: uuid.UUID
    status: str
    version: int
    template: TemplateRead


class Answer(ApiModel):
    question_id: str = Field(min_length=1, max_length=80)
    score: int = Field(ge=1, le=100, strict=True)
    comment: str = Field(default="", max_length=2000)


class AssessmentInput(ApiModel):
    cycle_id: uuid.UUID
    type: Literal["SELF", "PEER", "MANAGER"]
    reviewee_id: uuid.UUID | None = None


class AssessmentEdit(VersionInput):
    answers: list[Answer] = Field(default_factory=list, max_length=3000)
    mood: str = Field(default="", max_length=80)
    highlights: str = Field(default="", max_length=4000)
    comment: str = Field(default="", max_length=4000)


class ReviewInput(VersionInput):
    comment: str = Field(default="", max_length=4000)


class AssessmentRead(ApiModel):
    id: uuid.UUID
    company_id: uuid.UUID
    cycle_id: uuid.UUID
    reviewee_id: uuid.UUID
    reviewer_id: uuid.UUID
    reviewee_name: str
    reviewer_name: str
    type: str
    status: str
    version: int
    template_snapshot: dict[str, Any]
    answers: list[Answer]
    mood: str
    highlights: str
    comment: str
    review_comment: str
    total_score: float | None
    contribution_score: float | None
    attitude_score: float | None
    submitted_at: datetime | None
    approved_at: datetime | None
    created_at: datetime


class SummaryInput(ApiModel):
    employment_id: uuid.UUID | None = None
    content: str = Field(min_length=1, max_length=20000)
    strengths: list[Title] = Field(default_factory=list, max_length=30)
    growth_areas: list[Title] = Field(default_factory=list, max_length=30)


class SummaryGenerate(ApiModel):
    employment_id: uuid.UUID | None = None
    user_id: uuid.UUID | None = None


class SummaryRequest(ApiModel):
    employment_id: uuid.UUID


class SummaryEdit(VersionInput):
    content: str = Field(min_length=1, max_length=20000)


class SummaryRead(ApiModel):
    id: uuid.UUID
    owner_user_id: uuid.UUID
    company_id: uuid.UUID
    employment_id: uuid.UUID | None
    owner_name: str
    source: str
    status: str
    version: int
    content: str
    strengths: list[str]
    growth_areas: list[str]
    evaluation: str
    dimension_scores: dict[str, float]
    generated_at: datetime | None
    approved_at: datetime | None
    snapshot: dict[str, Any]


class ShareInput(ApiModel):
    summary_id: uuid.UUID
    label: str = Field(default="", max_length=180)
    expires_in_days: int = Field(default=30, ge=1, le=365)


class RequirementInput(ApiModel):
    company_id: uuid.UUID | None = None
    title: Title
    description: str = Field(min_length=1, max_length=12000)
    required_skills: list[Title] = Field(min_length=1, max_length=60)


class RequirementEdit(RequirementInput, VersionInput):
    status: Literal["open", "closed"] = "open"


class RequirementRead(RequirementInput):
    id: uuid.UUID
    status: str
    version: int
    created_at: datetime


class EmploymentInput(ApiModel):
    user_id: uuid.UUID | None = None
    title: Title
    start_date: date
    end_date: date | None = None

    @model_validator(mode="after")
    def dates(self) -> "EmploymentInput":
        if self.end_date is not None and self.end_date < self.start_date:
            raise ValueError("End date must not precede start date")
        return self


class EmploymentEdit(EmploymentInput, VersionInput):
    pass
