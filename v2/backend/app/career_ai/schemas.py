import uuid
from datetime import date, datetime
from typing import Literal
from pydantic import Field, SecretStr
from app.domain.schemas import ApiModel
from app.domain.roadmap_schemas import RoadmapCategory, RoadmapMilestoneDraft, Title

Provider = Literal["ANTHROPIC", "OPENAI", "GEMINI"]


class ConnectionWrite(ApiModel):
    api_key: SecretStr | None = None
    base_url: str | None = Field(default=None, max_length=500)
    model: str | None = Field(default=None, max_length=150)


class ConnectionRead(ApiModel):
    provider: Provider
    has_key: bool
    base_url: str | None
    model: str | None
    source: Literal["database", "environment", "none"]


class GoalWrite(ApiModel):
    title: Title
    category: RoadmapCategory = "WORK"
    description: str | None = Field(default=None, max_length=5000)
    metric: str | None = Field(default=None, max_length=500)
    target_value: float | None = Field(default=None, allow_inf_nan=False)
    current_value: float | None = Field(default=None, allow_inf_nan=False)
    progress: int = Field(default=0, ge=0, le=100)
    due_date: date | None = None
    status: Literal["NOT_STARTED", "IN_PROGRESS", "ACHIEVED"] = "NOT_STARTED"
    ai_suggested: bool = False


class GoalRead(GoalWrite):
    id: uuid.UUID
    roadmap_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class PlanWrite(ApiModel):
    category: RoadmapCategory = "WORK"
    expected_version: int = Field(ge=0)
    content: str = Field(min_length=1, max_length=60000)
    summary: str | None = Field(default=None, max_length=2000)
    ai_generated: bool = False


class PlanRead(ApiModel):
    id: uuid.UUID
    category: RoadmapCategory
    version: int
    content: str
    summary: str | None
    ai_generated: bool
    created_at: datetime


class GeneratePlan(ApiModel):
    category: RoadmapCategory = "WORK"
    instruction: str = Field(
        default="Đề xuất kế hoạch phát triển dựa trên mục tiêu và năng lực hiện có.",
        min_length=2,
        max_length=6000,
    )


class PlanProposal(ApiModel):
    plan_md: str = Field(min_length=1, max_length=60000)
    summary: str = Field(max_length=2000)


class RoadmapProposal(ApiModel):
    title: Title
    category: RoadmapCategory
    duration_weeks: int | None = Field(default=None, ge=1, le=520)
    hours_per_week: int | None = Field(default=None, ge=1, le=168)
    milestones: list[RoadmapMilestoneDraft] = Field(min_length=1, max_length=30)


class AssistantQuery(ApiModel):
    question: str = Field(min_length=2, max_length=6000)
    conversation_id: uuid.UUID | None = None
    focus: Literal["GENERAL", "ROADMAP"] = "GENERAL"
    category: RoadmapCategory = "WORK"
    company_id: uuid.UUID | None = None


class ConversationPatch(ApiModel):
    pinned: bool


class ConversationRead(ApiModel):
    id: uuid.UUID
    title: str
    focus: str
    category: RoadmapCategory
    pinned: bool
    created_at: datetime
    updated_at: datetime


class MessageRead(ApiModel):
    id: uuid.UUID
    role: str
    content: str
    referenced_user_ids: list[str]
    proposal_data: RoadmapProposal | None
    created_at: datetime


class ConversationDetail(ConversationRead):
    messages: list[MessageRead]


class AssistantReply(ApiModel):
    conversation_id: uuid.UUID
    message: MessageRead
    referenced: list[dict[str, str | None]]
