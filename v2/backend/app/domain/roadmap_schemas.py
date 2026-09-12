import uuid
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import Field, StrictBool, StringConstraints, model_validator

from app.domain.schemas import ApiModel

RoadmapCategory = Literal["WORK", "PERSONAL"]
Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=180)]
Character = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
CostumeColor = Annotated[str, StringConstraints(pattern=r"^#[0-9a-fA-F]{6}$")]


class RoadmapTaskDraft(ApiModel):
    title: Title
    metric: str | None = Field(default=None, max_length=500)


class RoadmapMilestoneDraft(ApiModel):
    title: Title
    description: str | None = Field(default=None, max_length=2000)
    due_date: date | None = None
    tasks: list[RoadmapTaskDraft] = Field(min_length=1, max_length=50)


class RoadmapSave(ApiModel):
    client_request_id: uuid.UUID
    category: RoadmapCategory
    title: Title
    duration_weeks: int | None = Field(default=None, ge=1, le=520, strict=True)
    hours_per_week: int | None = Field(default=None, ge=1, le=168, strict=True)
    milestones: list[RoadmapMilestoneDraft] = Field(min_length=1, max_length=30)
    ai_suggested: bool = False


class RoadmapStructureTask(RoadmapTaskDraft):
    done: StrictBool = False


class RoadmapStructureMilestone(RoadmapMilestoneDraft):
    tasks: list[RoadmapStructureTask] = Field(min_length=1, max_length=50)


class RoadmapStructurePatch(ApiModel):
    expected_version: int = Field(ge=1)
    title: Title
    duration_weeks: int | None = Field(default=None, ge=1, le=520)
    hours_per_week: int | None = Field(default=None, ge=1, le=168)
    milestones: list[RoadmapStructureMilestone] = Field(min_length=1, max_length=30)


class RoadmapTaskRead(RoadmapTaskDraft):
    id: uuid.UUID
    done: bool
    order: int


class RoadmapMilestoneRead(ApiModel):
    id: uuid.UUID
    title: str
    description: str | None
    due_date: date | None
    order: int
    status: Literal["NOT_STARTED", "IN_PROGRESS", "DONE"]
    completed_tasks: int
    total_tasks: int
    tasks: list[RoadmapTaskRead]


class RoadmapRead(ApiModel):
    id: uuid.UUID
    category: RoadmapCategory
    title: str
    duration_weeks: int | None
    hours_per_week: int | None
    version: int
    created_at: datetime
    updated_at: datetime
    completed_tasks: int
    total_tasks: int
    progress: int
    milestones: list[RoadmapMilestoneRead]


class RoadmapTaskPatch(ApiModel):
    expected_version: int = Field(ge=1, strict=True)
    done: StrictBool


class RoadmapSettingsRead(ApiModel):
    character: Character = "milo"
    view_mode: Literal["stair", "diagram"] = "stair"
    costume_color: CostumeColor = "#6366f1"
    reduce_motion: bool = False
    font_size: Literal["sm", "md", "lg"] = "md"
    version: int = 0


class DevelopmentPlanRead(ApiModel):
    settings: RoadmapSettingsRead


class RoadmapSettingsPatch(ApiModel):
    expected_version: int = Field(ge=0, strict=True)
    character: Character | None = None
    view_mode: Literal["stair", "diagram"] | None = None
    costume_color: CostumeColor | None = None
    reduce_motion: StrictBool | None = None
    font_size: Literal["sm", "md", "lg"] | None = None

    @model_validator(mode="after")
    def validate_updates(self) -> "RoadmapSettingsPatch":
        fields = self.model_fields_set - {"expected_version"}
        if not fields or any(getattr(self, field) is None for field in fields):
            raise ValueError("Provide at least one non-null display setting")
        return self
