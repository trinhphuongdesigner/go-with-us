import uuid
import re
from datetime import date, datetime
from typing import Literal
from pydantic import Field, model_validator
from app.domain.schemas import ApiModel
from app.domain.roadmap_schemas import Title, RoadmapCategory
from app.career_ai.schemas import RoadmapProposal

DATE_KEYS = {
    "startDate",
    "endDate",
    "issuedAt",
    "awardedAt",
    "dueDate",
    "date",
    "start_date",
    "end_date",
    "issued_at",
    "awarded_at",
    "due_date",
}


def normalize_source_dates(value, notices=None):
    """Match upstream YYYY/YYYY-MM support while making precision loss visible."""
    if isinstance(value, list):
        return [normalize_source_dates(item, notices) for item in value]
    if not isinstance(value, dict):
        return value
    output = {}
    for key, raw in value.items():
        result = normalize_source_dates(raw, notices)
        if key in DATE_KEYS and isinstance(raw, str):
            stripped = raw.strip()
            if not stripped:
                result = None
            elif re.fullmatch(r"\d{4}", stripped):
                result = stripped + "-01-01"
                if notices is not None:
                    notices.add(
                        f"Nguồn {stripped} chỉ có năm: dùng 01/01 làm mốc quy ước, cần đối chiếu."
                    )
            elif re.fullmatch(r"\d{4}-\d{2}", stripped):
                result = stripped + "-01"
                if notices is not None:
                    notices.add(
                        f"Nguồn {stripped} chỉ có tháng: dùng ngày 01 làm mốc quy ước, cần đối chiếu."
                    )
            elif re.match(r"^\d{4}-\d{2}-\d{2}T", stripped):
                try:
                    result = (
                        datetime.fromisoformat(stripped.replace("Z", "+00:00")).date().isoformat()
                    )
                except ValueError:
                    result = stripped
        output[key] = result
    return output


class BasicInfo(ApiModel):
    name: str | None = Field(default=None, max_length=160)
    job_title: str | None = Field(default=None, max_length=160)
    phone: str | None = Field(default=None, max_length=40)
    summary: str | None = Field(default=None, max_length=4000)


class RichSkill(ApiModel):
    name: str = Field(min_length=1, max_length=120)
    level: int = Field(default=3, ge=1, le=5)
    note: str | None = Field(default=None, max_length=1000)


class RichProject(ApiModel):
    name: Title
    role: Title
    domain: str | None = Field(default=None, max_length=180)
    tech_stack: list[str] = Field(default_factory=list, max_length=60)
    contribution: str | None = Field(default=None, max_length=10000)
    start_date: date | None = None
    end_date: date | None = None

    @model_validator(mode="after")
    def dates(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("Ngày kết thúc phải sau ngày bắt đầu")
        return self


class RichCertification(ApiModel):
    name: Title
    issuer: str = Field(default="", max_length=180)
    type: Literal["DEGREE", "LANGUAGE", "PROFESSIONAL", "OTHER"] = "PROFESSIONAL"
    score: str | None = Field(default=None, max_length=120)
    issued_at: date | None = None


class RichAward(ApiModel):
    title: Title
    issuer: str = Field(default="", max_length=180)
    description: str | None = Field(default=None, max_length=10000)
    category: RoadmapCategory = "WORK"
    awarded_at: date | None = None


class RichActivity(ApiModel):
    title: Title
    description: str | None = Field(default=None, max_length=10000)
    category: str | None = Field(default=None, max_length=80)
    date: date


class RichGoal(ApiModel):
    title: Title
    description: str | None = Field(default=None, max_length=5000)
    category: RoadmapCategory = "WORK"
    due_date: date | None = None
    metric: str | None = Field(default=None, max_length=500)


class IdentityCheck(ApiModel):
    detected_source_name: str = Field(default="", max_length=160)
    matches: bool = True


class RichProposal(ApiModel):
    identity_check: IdentityCheck = Field(default_factory=IdentityCheck)
    basic_info: BasicInfo | None = None
    skills: list[RichSkill] = Field(default_factory=list, max_length=100)
    projects: list[RichProject] = Field(default_factory=list, max_length=50)
    certifications: list[RichCertification] = Field(default_factory=list, max_length=50)
    awards: list[RichAward] = Field(default_factory=list, max_length=50)
    activities: list[RichActivity] = Field(default_factory=list, max_length=50)
    goals: list[RichGoal] = Field(default_factory=list, max_length=50)
    roadmap: RoadmapProposal | None = None
    summary: str = Field(default="", max_length=4000)
    dedup_notes: str = Field(default="", max_length=4000)

    @model_validator(mode="before")
    @classmethod
    def dates_from_sources(cls, value):
        notices = set()
        result = normalize_source_dates(value, notices)
        if notices and isinstance(result, dict):
            note_key = "dedup_notes" if "dedup_notes" in result else "dedupNotes"
            result[note_key] = " ".join([result.get(note_key) or "", *sorted(notices)]).strip()[
                :4000
            ]
        return result


class RefineRequest(ApiModel):
    expected_version: int = Field(ge=1)
    instruction: str = Field(min_length=3, max_length=6000)
    proposal: RichProposal


class SelectedUpdates(ApiModel):
    basic_info: BasicInfo | None = None
    skills: list[RichSkill] = Field(default_factory=list, max_length=100)
    projects: list[RichProject] = Field(default_factory=list, max_length=50)
    certifications: list[RichCertification] = Field(default_factory=list, max_length=50)
    awards: list[RichAward] = Field(default_factory=list, max_length=50)
    activities: list[RichActivity] = Field(default_factory=list, max_length=50)
    goals: list[RichGoal] = Field(default_factory=list, max_length=50)
    roadmap: RoadmapProposal | None = None

    @model_validator(mode="before")
    @classmethod
    def normalize_dates(cls, value):
        return normalize_source_dates(value)


class ApplyRequest(ApiModel):
    expected_version: int = Field(ge=1)
    client_request_id: uuid.UUID
    confirm_identity: bool = False
    updates: SelectedUpdates


class RichImportRead(ApiModel):
    id: uuid.UUID
    source_labels: list[str]
    proposal: RichProposal
    version: int
    applied: bool
    identity_warning: bool
    applied_counts: dict[str, int] | None
    created_at: datetime
