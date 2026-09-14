import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    JSON,
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.domain.models import TimestampMixin


class AssessmentTemplate(TimestampMixin, Base):
    __tablename__ = "talent_assessment_templates"
    __table_args__ = (
        UniqueConstraint("id", "company_id", name="uq_talent_templates_company"),
        UniqueConstraint("family_id", "version", name="uq_talent_templates_family_version"),
        CheckConstraint(
            "status IN ('DRAFT','ACTIVE','ARCHIVED')", name="ck_talent_template_status"
        ),
        CheckConstraint("row_version >= 1", name="ck_talent_template_row_version_positive"),
    )
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id"), index=True)
    created_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    family_id: Mapped[uuid.UUID] = mapped_column(Uuid, default=uuid.uuid4)
    version: Mapped[int] = mapped_column(Integer, default=1)
    row_version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    name: Mapped[str] = mapped_column(String(180))
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(16), default="DRAFT")
    groups: Mapped[list[dict[str, Any]]] = mapped_column(JSON)


class AssessmentCycle(TimestampMixin, Base):
    __tablename__ = "talent_assessment_cycles"
    __table_args__ = (
        ForeignKeyConstraint(
            ["template_id", "company_id"],
            ["talent_assessment_templates.id", "talent_assessment_templates.company_id"],
            name="fk_talent_cycle_template_company",
        ),
        UniqueConstraint("id", "company_id", name="uq_talent_cycles_company"),
        UniqueConstraint("company_id", "period", name="uq_talent_cycles_period"),
        CheckConstraint("status IN ('OPEN','CLOSED')", name="ck_talent_cycle_status"),
    )
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    template_id: Mapped[uuid.UUID] = mapped_column(Uuid)
    name: Mapped[str] = mapped_column(String(180))
    period: Mapped[str] = mapped_column(String(7))
    due_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(16), default="OPEN")
    version: Mapped[int] = mapped_column(Integer, default=1)


class Assessment(TimestampMixin, Base):
    __tablename__ = "talent_assessments"
    __table_args__ = (
        ForeignKeyConstraint(
            ["reviewee_id", "company_id"],
            ["users.id", "users.company_id"],
            name="fk_talent_assessment_reviewee_company",
        ),
        ForeignKeyConstraint(
            ["cycle_id", "company_id"],
            ["talent_assessment_cycles.id", "talent_assessment_cycles.company_id"],
            name="fk_talent_assessment_cycle_company",
        ),
        ForeignKeyConstraint(
            ["employment_id", "reviewee_id", "company_id"],
            ["employments.id", "employments.user_id", "employments.company_id"],
            name="fk_talent_assessment_employment",
        ),
        CheckConstraint("type IN ('SELF','PEER','MANAGER')", name="ck_talent_assessment_type"),
        CheckConstraint(
            "status IN ('DRAFT','SUBMITTED','APPROVED','REJECTED')",
            name="ck_talent_assessment_status",
        ),
    )
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    cycle_id: Mapped[uuid.UUID] = mapped_column(Uuid)
    reviewee_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    reviewer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    employment_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    type: Mapped[str] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(String(16), default="DRAFT")
    version: Mapped[int] = mapped_column(Integer, default=1)
    template_snapshot: Mapped[dict[str, Any]] = mapped_column(JSON)
    answers: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    mood: Mapped[str] = mapped_column(String(80), default="")
    highlights: Mapped[str] = mapped_column(Text, default="")
    comment: Mapped[str] = mapped_column(Text, default="")
    review_comment: Mapped[str] = mapped_column(Text, default="")
    total_score: Mapped[float | None] = mapped_column(Float)
    contribution_score: Mapped[float | None] = mapped_column(Float)
    attitude_score: Mapped[float | None] = mapped_column(Float)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    approved_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))


class CareerSummary(TimestampMixin, Base):
    __tablename__ = "talent_career_summaries"
    __table_args__ = (
        ForeignKeyConstraint(
            ["owner_user_id", "company_id"],
            ["users.id", "users.company_id"],
            name="fk_talent_summary_owner_company",
        ),
        ForeignKeyConstraint(
            ["employment_id", "owner_user_id", "company_id"],
            ["employments.id", "employments.user_id", "employments.company_id"],
            name="fk_talent_summary_employment",
        ),
        UniqueConstraint("id", "owner_user_id", "company_id", name="uq_talent_summary_scope"),
        CheckConstraint("status IN ('DRAFT','APPROVED')", name="ck_talent_summary_status"),
        CheckConstraint(
            "source IN ('PERSONAL','ORGANIZATION_OFFBOARDING')", name="ck_talent_summary_source"
        ),
    )
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    owner_user_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    company_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    employment_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    source: Mapped[str] = mapped_column(String(32), default="PERSONAL")
    status: Mapped[str] = mapped_column(String(16), default="DRAFT")
    version: Mapped[int] = mapped_column(Integer, default=1)
    content: Mapped[str] = mapped_column(Text, default="")
    strengths: Mapped[list[str]] = mapped_column(JSON, default=list)
    growth_areas: Mapped[list[str]] = mapped_column(JSON, default=list)
    evaluation: Mapped[str] = mapped_column(Text, default="")
    dimension_scores: Mapped[dict[str, float]] = mapped_column(JSON, default=dict)
    generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    approved_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    snapshot: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)


class PassportShare(TimestampMixin, Base):
    __tablename__ = "talent_passport_shares"
    __table_args__ = (
        ForeignKeyConstraint(
            ["summary_id", "owner_user_id", "company_id"],
            [
                "talent_career_summaries.id",
                "talent_career_summaries.owner_user_id",
                "talent_career_summaries.company_id",
            ],
            name="fk_talent_share_summary_scope",
        ),
    )
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    owner_user_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    company_id: Mapped[uuid.UUID] = mapped_column(Uuid)
    summary_id: Mapped[uuid.UUID] = mapped_column(Uuid)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    label: Mapped[str] = mapped_column(String(180), default="")
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    snapshot: Mapped[dict[str, Any]] = mapped_column(JSON)


class JobRequirement(TimestampMixin, Base):
    __tablename__ = "talent_job_requirements"
    __table_args__ = (
        CheckConstraint("status IN ('open','closed')", name="ck_talent_requirement_status"),
    )
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id"), index=True)
    created_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String(180))
    description: Mapped[str] = mapped_column(Text)
    required_skills: Mapped[list[str]] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(16), default="open")
    version: Mapped[int] = mapped_column(Integer, default=1)
