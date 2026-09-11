from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    event,
    func,
    text,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.domain.enums import CompanyStatus, EmploymentStatus, Role


def utc_now() -> datetime:
    return datetime.now(UTC)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )


class Company(TimestampMixin, Base):
    __tablename__ = "companies"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[CompanyStatus] = mapped_column(
        SAEnum(CompanyStatus, native_enum=False, length=16), default=CompanyStatus.ACTIVE
    )
    version: Mapped[int] = mapped_column(default=1, nullable=False)

    users: Mapped[list[User]] = relationship(back_populates="company")


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    job_title: Mapped[str | None] = mapped_column(String(160))
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[Role] = mapped_column(SAEnum(Role, native_enum=False, length=24), nullable=False)
    company_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("companies.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    admin_permissions: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    version: Mapped[int] = mapped_column(default=1, nullable=False)

    company: Mapped[Company | None] = relationship(back_populates="users")
    employments: Mapped[list[Employment]] = relationship(
        back_populates="user", foreign_keys="Employment.user_id"
    )

    __table_args__ = (
        CheckConstraint(
            "(role = 'SUPER_ADMIN' AND company_id IS NULL) OR "
            "(role IN ('COMPANY_ADMIN', 'EMPLOYEE') AND company_id IS NOT NULL)",
            name="ck_users_role_company",
        ),
        CheckConstraint("email = lower(trim(email))", name="ck_users_email_canonical"),
        UniqueConstraint("id", "company_id", name="uq_users_id_company_id"),
        Index("uq_users_email_lower", func.lower(email), unique=True),
    )


class Employment(TimestampMixin, Base):
    __tablename__ = "employments"
    __table_args__ = (
        CheckConstraint(
            "(status = 'ACTIVE' AND end_date IS NULL) OR "
            "(status = 'ENDED' AND end_date IS NOT NULL)",
            name="ck_employment_status_dates",
        ),
        CheckConstraint("end_date IS NULL OR end_date >= start_date", name="ck_employment_dates"),
        ForeignKeyConstraint(
            ["user_id", "company_id"],
            ["users.id", "users.company_id"],
            name="fk_employments_user_company",
            ondelete="RESTRICT",
        ),
        Index("ix_employments_company_user", "company_id", "user_id"),
        Index(
            "uq_employments_one_active_per_user",
            "user_id",
            unique=True,
            postgresql_where=text("status = 'ACTIVE'"),
            sqlite_where=text("status = 'ACTIVE'"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    start_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[EmploymentStatus] = mapped_column(
        SAEnum(EmploymentStatus, native_enum=False, length=16), default=EmploymentStatus.ACTIVE
    )
    version: Mapped[int] = mapped_column(default=1, nullable=False)

    user: Mapped[User] = relationship(back_populates="employments", foreign_keys=[user_id])


class AuthSession(Base):
    __tablename__ = "auth_sessions"
    __table_args__ = (
        ForeignKeyConstraint(
            ["user_id", "company_id"],
            ["users.id", "users.company_id"],
            name="fk_auth_sessions_user_company",
            ondelete="RESTRICT",
        ),
        UniqueConstraint("jti_hash", name="uq_auth_sessions_jti_hash"),
        Index("ix_auth_sessions_user_revoked", "user_id", "revoked_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    company_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("companies.id", ondelete="RESTRICT"), nullable=True
    )
    jti_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class LoginRateLimit(Base):
    """Opaque, shared counters used before an account is authenticated."""

    __tablename__ = "login_rate_limits"
    __table_args__ = (
        CheckConstraint("attempts > 0", name="ck_login_rate_limits_attempts_positive"),
        Index("ix_login_rate_limits_window_started_at", "window_started_at"),
    )

    bucket_key: Mapped[str] = mapped_column(String(72), primary_key=True)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False)
    window_started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    actor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    company_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("companies.id", ondelete="RESTRICT"), index=True
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(80), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(64), nullable=False)
    request_id: Mapped[str | None] = mapped_column(String(64))
    changes: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    details: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


def validate_user_tenant_invariant(user: User) -> None:
    if user.role == Role.SUPER_ADMIN and user.company_id is not None:
        raise ValueError("SUPER_ADMIN company_id must be null")
    if user.role in {Role.COMPANY_ADMIN, Role.EMPLOYEE} and user.company_id is None:
        raise ValueError(f"{user.role.value} company_id is required")


@event.listens_for(User, "before_insert")
@event.listens_for(User, "before_update")
def _validate_user_before_write(_mapper: object, _connection: object, user: User) -> None:
    validate_user_tenant_invariant(user)
    canonical_email = user.email.strip().casefold()
    if user.email != canonical_email:
        raise ValueError("User email must be canonical lowercase without surrounding whitespace")
