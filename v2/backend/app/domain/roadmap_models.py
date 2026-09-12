"""Structured personal roadmaps; display preferences never mutate roadmap content."""

from __future__ import annotations

import uuid
from datetime import date
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Date,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.domain.models import TimestampMixin


class DevelopmentRoadmap(TimestampMixin, Base):
    __tablename__ = "development_roadmaps"
    __table_args__ = (
        ForeignKeyConstraint(
            ["owner_user_id", "company_id"],
            ["users.id", "users.company_id"],
            name="fk_roadmaps_owner_company",
            ondelete="RESTRICT",
        ),
        UniqueConstraint(
            "owner_user_id", "company_id", "client_request_id", name="uq_roadmaps_request"
        ),
        CheckConstraint("category IN ('WORK', 'PERSONAL')", name="ck_roadmaps_category"),
        CheckConstraint("version > 0", name="ck_roadmaps_version"),
        CheckConstraint("length(trim(title)) > 0", name="ck_roadmaps_title"),
        CheckConstraint(
            "duration_weeks IS NULL OR duration_weeks BETWEEN 1 AND 520",
            name="ck_roadmaps_duration",
        ),
        CheckConstraint(
            "hours_per_week IS NULL OR hours_per_week BETWEEN 1 AND 168", name="ck_roadmaps_hours"
        ),
        Index(
            "ix_roadmaps_owner_category", "owner_user_id", "company_id", "category", "created_at"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    owner_user_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    company_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    client_request_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    request_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    category: Mapped[str] = mapped_column(String(8), nullable=False)
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    duration_weeks: Mapped[int | None] = mapped_column(Integer)
    hours_per_week: Mapped[int | None] = mapped_column(Integer)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    milestones: Mapped[list[DevelopmentMilestone]] = relationship(
        cascade="all, delete-orphan",
        order_by="DevelopmentMilestone.order",
        lazy="raise",
    )


class DevelopmentMilestone(Base):
    __tablename__ = "development_milestones"
    __table_args__ = (
        UniqueConstraint("roadmap_id", "order", name="uq_milestones_order"),
        CheckConstraint('"order" >= 0', name="ck_milestones_order"),
        CheckConstraint("length(trim(title)) > 0", name="ck_milestones_title"),
    )
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    roadmap_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("development_roadmaps.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    description: Mapped[str | None] = mapped_column(String(2000))
    due_date: Mapped[date | None] = mapped_column(Date)
    order: Mapped[int] = mapped_column(Integer, nullable=False)
    tasks: Mapped[list[DevelopmentTask]] = relationship(
        cascade="all, delete-orphan",
        order_by="DevelopmentTask.order",
        lazy="raise",
    )


class DevelopmentTask(Base):
    __tablename__ = "development_tasks"
    __table_args__ = (
        UniqueConstraint("milestone_id", "order", name="uq_development_tasks_order"),
        CheckConstraint('"order" >= 0', name="ck_development_tasks_order"),
        CheckConstraint("length(trim(title)) > 0", name="ck_development_tasks_title"),
    )
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    milestone_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("development_milestones.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    metric: Mapped[str | None] = mapped_column(String(500))
    done: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    order: Mapped[int] = mapped_column(Integer, nullable=False)


class DevelopmentPlanSettings(TimestampMixin, Base):
    __tablename__ = "development_plan_settings"
    __table_args__ = (
        ForeignKeyConstraint(
            ["owner_user_id", "company_id"],
            ["users.id", "users.company_id"],
            name="fk_development_settings_owner_company",
            ondelete="RESTRICT",
        ),
        CheckConstraint("version > 0", name="ck_development_settings_version"),
    )
    owner_user_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    company_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    display_settings: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
