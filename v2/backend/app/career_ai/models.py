import uuid
from datetime import date
from typing import Any
from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
from app.domain.models import TimestampMixin


class AiConnection(TimestampMixin, Base):
    __tablename__ = "career_ai_connections"
    provider: Mapped[str] = mapped_column(String(20), primary_key=True)
    encrypted_key: Mapped[str] = mapped_column(Text)
    base_url: Mapped[str | None] = mapped_column(String(500))
    model: Mapped[str | None] = mapped_column(String(150))


class CareerGoal(TimestampMixin, Base):
    __tablename__ = "career_goals"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    owner_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id"), index=True)
    roadmap_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("development_roadmaps.id", ondelete="SET NULL"), unique=True
    )
    category: Mapped[str] = mapped_column(String(8), default="WORK")
    title: Mapped[str] = mapped_column(String(180))
    description: Mapped[str | None] = mapped_column(Text)
    metric: Mapped[str | None] = mapped_column(String(500))
    target_value: Mapped[float | None] = mapped_column(Float)
    current_value: Mapped[float | None] = mapped_column(Float)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    due_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default="NOT_STARTED")
    ai_suggested: Mapped[bool] = mapped_column(Boolean, default=False)


class CareerPlanRevision(TimestampMixin, Base):
    __tablename__ = "career_plan_revisions"
    __table_args__ = (
        UniqueConstraint(
            "owner_user_id", "company_id", "category", "version", name="uq_career_plan_version"
        ),
    )
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    owner_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id"))
    category: Mapped[str] = mapped_column(String(8), default="WORK")
    version: Mapped[int] = mapped_column(Integer)
    content: Mapped[str] = mapped_column(Text)
    summary: Mapped[str | None] = mapped_column(String(2000))
    ai_generated: Mapped[bool] = mapped_column(Boolean, default=False)


class AssistantConversation(TimestampMixin, Base):
    __tablename__ = "career_assistant_conversations"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    owner_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    company_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("companies.id"))
    context_company_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("companies.id"))
    uses_roster: Mapped[bool] = mapped_column(Boolean, default=False)
    title: Mapped[str] = mapped_column(String(180))
    focus: Mapped[str] = mapped_column(String(10), default="GENERAL")
    category: Mapped[str] = mapped_column(String(8), default="WORK")
    pinned: Mapped[bool] = mapped_column(Boolean, default=False)


class AssistantMessage(TimestampMixin, Base):
    __tablename__ = "career_assistant_messages"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("career_assistant_conversations.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(10))
    content: Mapped[str] = mapped_column(Text)
    referenced_user_ids: Mapped[list[str]] = mapped_column(JSON, default=list)
    proposal_data: Mapped[dict[str, Any] | None] = mapped_column(JSON)
