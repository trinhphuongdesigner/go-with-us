import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.domain.models import TimestampMixin


class PersonalDetails(TimestampMixin, Base):
    __tablename__ = "personal_details"
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), primary_key=True)
    details: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    avatar_asset_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    version: Mapped[int] = mapped_column(Integer, default=1)


class StoredAsset(TimestampMixin, Base):
    __tablename__ = "stored_assets"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    owner_user_id: Mapped[uuid.UUID] = mapped_column(Uuid)
    company_id: Mapped[uuid.UUID] = mapped_column(Uuid)
    filename: Mapped[str] = mapped_column(String(255))
    mime_type: Mapped[str] = mapped_column(String(160))
    size: Mapped[int] = mapped_column(Integer)
    purpose: Mapped[str] = mapped_column(String(16))
    deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    __table_args__ = (
        ForeignKeyConstraint(
            ["owner_user_id", "company_id"],
            ["users.id", "users.company_id"],
            name="fk_assets_owner_company",
        ),
    )


class ProfileActivityLog(TimestampMixin, Base):
    __tablename__ = "profile_activity_logs"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    owner_user_id: Mapped[uuid.UUID] = mapped_column(Uuid)
    company_id: Mapped[uuid.UUID] = mapped_column(Uuid)
    title: Mapped[str] = mapped_column(String(180))
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(String(80))
    date: Mapped[date] = mapped_column(Date)
    evidence_url: Mapped[str | None] = mapped_column(String(2048))
    evidence_asset_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("stored_assets.id"))
    version: Mapped[int] = mapped_column(Integer, default=1)
    __table_args__ = (
        Index("ix_activities_owner_date", "owner_user_id", "date"),
        ForeignKeyConstraint(
            ["owner_user_id", "company_id"],
            ["users.id", "users.company_id"],
            name="fk_activities_owner_company",
        ),
    )


class CompetencyRequest(TimestampMixin, Base):
    __tablename__ = "competency_requests"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    sender_id: Mapped[uuid.UUID] = mapped_column(Uuid)
    recipient_id: Mapped[uuid.UUID] = mapped_column(Uuid)
    company_id: Mapped[uuid.UUID] = mapped_column(Uuid)
    employment_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("employments.id"))
    source_type: Mapped[str] = mapped_column(String(20))
    source_id: Mapped[uuid.UUID] = mapped_column(Uuid)
    source_snapshot: Mapped[dict[str, Any]] = mapped_column(JSON)
    client_request_id: Mapped[uuid.UUID] = mapped_column(Uuid)
    request_hash: Mapped[str] = mapped_column(String(64))
    message: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16), default="PENDING")
    points_awarded: Mapped[int] = mapped_column(Integer, default=0)
    review_note: Mapped[str | None] = mapped_column(Text)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    __table_args__ = (
        Index("ix_requests_recipient_status", "recipient_id", "status", "created_at"),
        ForeignKeyConstraint(
            ["sender_id", "company_id"],
            ["users.id", "users.company_id"],
            name="fk_requests_sender_company",
        ),
        ForeignKeyConstraint(
            ["recipient_id", "company_id"],
            ["users.id", "users.company_id"],
            name="fk_requests_recipient_company",
        ),
        UniqueConstraint("sender_id", "client_request_id", name="uq_competency_request_retry"),
    )
