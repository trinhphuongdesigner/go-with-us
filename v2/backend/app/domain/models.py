from __future__ import annotations

import uuid
from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
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
    event,
    func,
    text,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.domain.enums import (
    AwardType,
    CertificationType,
    CompanyStatus,
    EmploymentStatus,
    ProfileImportStatus,
    ProfileSourceType,
    Role,
)


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
        CheckConstraint("version > 0", name="ck_users_version_positive"),
        UniqueConstraint("id", "company_id", name="uq_users_id_company_id"),
        Index("uq_users_email_lower", func.lower(email), unique=True),
        Index("ix_users_roster_scope", "company_id", "role", func.lower(name), "id"),
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
        UniqueConstraint("id", "user_id", "company_id", name="uq_employments_scope"),
        Index("ix_employments_company_user", "company_id", "user_id"),
        Index("ix_employments_user", "user_id"),
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


class Skill(TimestampMixin, Base):
    __tablename__ = "skills"
    __table_args__ = (
        UniqueConstraint("normalized_key", name="uq_skills_normalized_key"),
        CheckConstraint("length(normalized_key) > 0", name="ck_skills_normalized_key_nonempty"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    normalized_key: Mapped[str] = mapped_column(String(120), nullable=False)
    category: Mapped[str | None] = mapped_column(String(80))


class EmployeeSkill(TimestampMixin, Base):
    __tablename__ = "employee_skills"
    __table_args__ = (
        ForeignKeyConstraint(
            ["user_id", "company_id"],
            ["users.id", "users.company_id"],
            name="fk_employee_skills_user_company",
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["source_import_id", "user_id", "company_id"],
            ["profile_imports.id", "profile_imports.owner_user_id", "profile_imports.company_id"],
            name="fk_employee_skills_import_scope",
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["proposal_item_id", "source_import_id", "user_id", "company_id"],
            [
                "profile_proposed_values.id",
                "profile_proposed_values.profile_import_id",
                "profile_proposed_values.owner_user_id",
                "profile_proposed_values.company_id",
            ],
            name="fk_employee_skills_proposal_scope",
            ondelete="RESTRICT",
        ),
        UniqueConstraint("user_id", "skill_id", name="uq_employee_skills_user_skill"),
        UniqueConstraint(
            "source_import_id", "proposal_item_id", name="uq_employee_skills_import_item"
        ),
        CheckConstraint("rating >= 1 AND rating <= 5", name="ck_employee_skills_rating"),
        CheckConstraint("version > 0", name="ck_employee_skills_version_positive"),
        CheckConstraint(
            "(source_type = 'IMPORT' AND source_import_id IS NOT NULL AND proposal_item_id IS NOT NULL) OR "
            "(source_type IN ('SELF', 'ADMIN') AND source_import_id IS NULL AND proposal_item_id IS NULL)",
            name="ck_employee_skills_provenance",
        ),
        Index("ix_employee_skills_company_user", "company_id", "user_id"),
        Index("ix_employee_skills_user", "user_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    company_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    skill_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("skills.id", ondelete="RESTRICT"), nullable=False
    )
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    note: Mapped[str | None] = mapped_column(String(1000))
    self_assessed: Mapped[bool] = mapped_column(Boolean, nullable=False)
    source_type: Mapped[ProfileSourceType] = mapped_column(
        SAEnum(ProfileSourceType, native_enum=False, length=16), nullable=False
    )
    source_import_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    proposal_item_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    updated_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    skill: Mapped[Skill] = relationship()


class Experience(TimestampMixin, Base):
    __tablename__ = "experiences"
    __table_args__ = (
        ForeignKeyConstraint(
            ["user_id", "company_id"],
            ["users.id", "users.company_id"],
            name="fk_experiences_user_company",
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["source_import_id", "user_id", "company_id"],
            ["profile_imports.id", "profile_imports.owner_user_id", "profile_imports.company_id"],
            name="fk_experiences_import_scope",
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["proposal_item_id", "source_import_id", "user_id", "company_id"],
            [
                "profile_proposed_values.id",
                "profile_proposed_values.profile_import_id",
                "profile_proposed_values.owner_user_id",
                "profile_proposed_values.company_id",
            ],
            name="fk_experiences_proposal_scope",
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["employment_id", "user_id", "company_id"],
            ["employments.id", "employments.user_id", "employments.company_id"],
            name="fk_experiences_employment_scope",
            ondelete="RESTRICT",
        ),
        UniqueConstraint("source_import_id", "proposal_item_id", name="uq_experiences_import_item"),
        CheckConstraint(
            "end_date IS NULL OR start_date IS NULL OR end_date >= start_date",
            name="ck_experiences_dates",
        ),
        CheckConstraint("version > 0", name="ck_experiences_version_positive"),
        CheckConstraint(
            "(source_type = 'IMPORT' AND source_import_id IS NOT NULL AND proposal_item_id IS NOT NULL) OR "
            "(source_type IN ('SELF', 'ADMIN') AND source_import_id IS NULL AND proposal_item_id IS NULL)",
            name="ck_experiences_provenance",
        ),
        Index("ix_experiences_company_user", "company_id", "user_id"),
        Index("ix_experiences_user", "user_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    company_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    employment_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    organization: Mapped[str] = mapped_column(String(180), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    source_type: Mapped[ProfileSourceType] = mapped_column(
        SAEnum(ProfileSourceType, native_enum=False, length=16), nullable=False
    )
    source_import_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    proposal_item_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    updated_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class Project(TimestampMixin, Base):
    __tablename__ = "projects"
    __table_args__ = (
        ForeignKeyConstraint(
            ["user_id", "company_id"],
            ["users.id", "users.company_id"],
            name="fk_projects_user_company",
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["source_import_id", "user_id", "company_id"],
            ["profile_imports.id", "profile_imports.owner_user_id", "profile_imports.company_id"],
            name="fk_projects_import_scope",
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["proposal_item_id", "source_import_id", "user_id", "company_id"],
            [
                "profile_proposed_values.id",
                "profile_proposed_values.profile_import_id",
                "profile_proposed_values.owner_user_id",
                "profile_proposed_values.company_id",
            ],
            name="fk_projects_proposal_scope",
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["employment_id", "user_id", "company_id"],
            ["employments.id", "employments.user_id", "employments.company_id"],
            name="fk_projects_employment_scope",
            ondelete="RESTRICT",
        ),
        UniqueConstraint("source_import_id", "proposal_item_id", name="uq_projects_import_item"),
        CheckConstraint(
            "end_date IS NULL OR start_date IS NULL OR end_date >= start_date",
            name="ck_projects_dates",
        ),
        CheckConstraint("version > 0", name="ck_projects_version_positive"),
        CheckConstraint(
            "(source_type = 'IMPORT' AND source_import_id IS NOT NULL AND proposal_item_id IS NOT NULL) OR "
            "(source_type IN ('SELF', 'ADMIN') AND source_import_id IS NULL AND proposal_item_id IS NULL)",
            name="ck_projects_provenance",
        ),
        Index("ix_projects_company_user", "company_id", "user_id"),
        Index("ix_projects_user", "user_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    company_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    employment_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    name: Mapped[str] = mapped_column(String(180), nullable=False)
    role: Mapped[str] = mapped_column(String(180), nullable=False)
    domain: Mapped[str | None] = mapped_column(String(180))
    description: Mapped[str | None] = mapped_column(Text)
    tech_stack: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    contribution: Mapped[str | None] = mapped_column(Text)
    url: Mapped[str | None] = mapped_column(String(2048))
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    source_type: Mapped[ProfileSourceType] = mapped_column(
        SAEnum(ProfileSourceType, native_enum=False, length=16), nullable=False
    )
    source_import_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    proposal_item_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    updated_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class Certification(TimestampMixin, Base):
    __tablename__ = "certifications"
    __table_args__ = (
        ForeignKeyConstraint(
            ["user_id", "company_id"],
            ["users.id", "users.company_id"],
            name="fk_certifications_user_company",
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["source_import_id", "user_id", "company_id"],
            ["profile_imports.id", "profile_imports.owner_user_id", "profile_imports.company_id"],
            name="fk_certifications_import_scope",
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["proposal_item_id", "source_import_id", "user_id", "company_id"],
            [
                "profile_proposed_values.id",
                "profile_proposed_values.profile_import_id",
                "profile_proposed_values.owner_user_id",
                "profile_proposed_values.company_id",
            ],
            name="fk_certifications_proposal_scope",
            ondelete="RESTRICT",
        ),
        UniqueConstraint(
            "source_import_id", "proposal_item_id", name="uq_certifications_import_item"
        ),
        CheckConstraint(
            "expires_at IS NULL OR issued_at IS NULL OR expires_at >= issued_at",
            name="ck_certifications_dates",
        ),
        CheckConstraint("version > 0", name="ck_certifications_version_positive"),
        CheckConstraint(
            "(source_type = 'IMPORT' AND source_import_id IS NOT NULL AND proposal_item_id IS NOT NULL) OR "
            "(source_type IN ('SELF', 'ADMIN') AND source_import_id IS NULL AND proposal_item_id IS NULL)",
            name="ck_certifications_provenance",
        ),
        Index("ix_certifications_company_user", "company_id", "user_id"),
        Index("ix_certifications_user", "user_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    company_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    name: Mapped[str] = mapped_column(String(180), nullable=False)
    type: Mapped[CertificationType] = mapped_column(
        SAEnum(CertificationType, native_enum=False, length=20), nullable=False
    )
    issuer: Mapped[str] = mapped_column(String(180), nullable=False)
    score: Mapped[str | None] = mapped_column(String(120))
    credential_url: Mapped[str | None] = mapped_column(String(2048))
    issued_at: Mapped[date | None] = mapped_column(Date)
    expires_at: Mapped[date | None] = mapped_column(Date)
    source_type: Mapped[ProfileSourceType] = mapped_column(
        SAEnum(ProfileSourceType, native_enum=False, length=16), nullable=False
    )
    source_import_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    proposal_item_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    updated_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class Award(TimestampMixin, Base):
    __tablename__ = "awards"
    __table_args__ = (
        ForeignKeyConstraint(
            ["user_id", "company_id"],
            ["users.id", "users.company_id"],
            name="fk_awards_user_company",
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["source_import_id", "user_id", "company_id"],
            ["profile_imports.id", "profile_imports.owner_user_id", "profile_imports.company_id"],
            name="fk_awards_import_scope",
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["proposal_item_id", "source_import_id", "user_id", "company_id"],
            [
                "profile_proposed_values.id",
                "profile_proposed_values.profile_import_id",
                "profile_proposed_values.owner_user_id",
                "profile_proposed_values.company_id",
            ],
            name="fk_awards_proposal_scope",
            ondelete="RESTRICT",
        ),
        UniqueConstraint("source_import_id", "proposal_item_id", name="uq_awards_import_item"),
        CheckConstraint("version > 0", name="ck_awards_version_positive"),
        CheckConstraint(
            "(source_type = 'IMPORT' AND source_import_id IS NOT NULL AND proposal_item_id IS NOT NULL) OR "
            "(source_type IN ('SELF', 'ADMIN') AND source_import_id IS NULL AND proposal_item_id IS NULL)",
            name="ck_awards_provenance",
        ),
        Index("ix_awards_company_user", "company_id", "user_id"),
        Index("ix_awards_user", "user_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    company_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    name: Mapped[str] = mapped_column(String(180), nullable=False)
    type: Mapped[AwardType] = mapped_column(
        SAEnum(AwardType, native_enum=False, length=16), nullable=False
    )
    issuer: Mapped[str] = mapped_column(String(180), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    evidence_url: Mapped[str | None] = mapped_column(String(2048))
    awarded_at: Mapped[date | None] = mapped_column(Date)
    self_reported: Mapped[bool] = mapped_column(Boolean, nullable=False)
    source_type: Mapped[ProfileSourceType] = mapped_column(
        SAEnum(ProfileSourceType, native_enum=False, length=16), nullable=False
    )
    source_import_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    proposal_item_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    updated_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


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


class SourceDocument(TimestampMixin, Base):
    __tablename__ = "source_documents"
    __table_args__ = (
        ForeignKeyConstraint(
            ["owner_user_id", "company_id"],
            ["users.id", "users.company_id"],
            name="fk_source_documents_owner_company",
            ondelete="RESTRICT",
        ),
        UniqueConstraint(
            "owner_user_id", "company_id", "sha256", name="uq_source_documents_owner_sha256"
        ),
        UniqueConstraint("id", "owner_user_id", "company_id", name="uq_source_documents_scope"),
        CheckConstraint("byte_size > 0", name="ck_source_documents_byte_size_positive"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    owner_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    byte_size: Mapped[int] = mapped_column(Integer, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)


class SourceVersion(TimestampMixin, Base):
    __tablename__ = "source_versions"
    __table_args__ = (
        ForeignKeyConstraint(
            ["document_id", "owner_user_id", "company_id"],
            [
                "source_documents.id",
                "source_documents.owner_user_id",
                "source_documents.company_id",
            ],
            name="fk_source_versions_document_scope",
            ondelete="CASCADE",
        ),
        UniqueConstraint("document_id", "version", name="uq_source_versions_document_version"),
        UniqueConstraint(
            "id", "document_id", "owner_user_id", "company_id", name="uq_source_versions_scope"
        ),
        CheckConstraint("version > 0", name="ck_source_versions_version_positive"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("source_documents.id", ondelete="CASCADE"), nullable=False
    )
    owner_user_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    company_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    content_sha256: Mapped[str] = mapped_column(String(64), nullable=False)


class SourceBlock(TimestampMixin, Base):
    __tablename__ = "source_blocks"
    __table_args__ = (
        UniqueConstraint("source_version_id", "ordinal", name="uq_source_blocks_version_ordinal"),
        UniqueConstraint("id", "source_version_id", name="uq_source_blocks_id_version"),
        CheckConstraint("ordinal >= 0", name="ck_source_blocks_ordinal_nonnegative"),
        CheckConstraint("char_start >= 0", name="ck_source_blocks_char_start_nonnegative"),
        CheckConstraint("char_end > char_start", name="ck_source_blocks_char_span"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    source_version_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("source_versions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    ordinal: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    text_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    char_start: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    char_end: Mapped[int] = mapped_column(Integer, nullable=False)
    page_number: Mapped[int | None] = mapped_column(Integer)
    sheet_name: Mapped[str | None] = mapped_column(String(100))


class ProfileImport(TimestampMixin, Base):
    __tablename__ = "profile_imports"
    __table_args__ = (
        ForeignKeyConstraint(
            ["owner_user_id", "company_id"],
            ["users.id", "users.company_id"],
            name="fk_profile_imports_owner_company",
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["source_document_id", "owner_user_id", "company_id"],
            [
                "source_documents.id",
                "source_documents.owner_user_id",
                "source_documents.company_id",
            ],
            name="fk_profile_imports_document_scope",
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["source_version_id", "source_document_id", "owner_user_id", "company_id"],
            [
                "source_versions.id",
                "source_versions.document_id",
                "source_versions.owner_user_id",
                "source_versions.company_id",
            ],
            name="fk_profile_imports_version_scope",
            ondelete="RESTRICT",
        ),
        UniqueConstraint("source_version_id", name="uq_profile_imports_source_version"),
        UniqueConstraint("id", "owner_user_id", "company_id", name="uq_profile_imports_scope"),
        CheckConstraint("version > 0", name="ck_profile_imports_version_positive"),
        CheckConstraint(
            "status IN ('PENDING', 'PROCESSING', 'PARSED', 'APPLIED', 'FAILED')",
            name="ck_profile_imports_status",
        ),
        CheckConstraint(
            "proposal_version >= 0", name="ck_profile_imports_proposal_version_nonnegative"
        ),
        CheckConstraint(
            "(status = 'PROCESSING' AND processing_token IS NOT NULL "
            "AND processing_started_at IS NOT NULL) OR "
            "(status <> 'PROCESSING' AND processing_token IS NULL "
            "AND processing_started_at IS NULL)",
            name="ck_profile_imports_processing_lease",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    owner_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    source_document_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    source_version_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    status: Mapped[ProfileImportStatus] = mapped_column(
        SAEnum(ProfileImportStatus, native_enum=False, length=16),
        nullable=False,
        default=ProfileImportStatus.PENDING,
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    proposal_version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_code: Mapped[str | None] = mapped_column(String(80))
    last_ai_status: Mapped[str | None] = mapped_column(String(32))
    last_ai_warnings: Mapped[list[str]] = mapped_column(
        JSON, nullable=False, default=list, server_default=text("'[]'")
    )
    last_clarification_questions: Mapped[list[str]] = mapped_column(
        JSON, nullable=False, default=list, server_default=text("'[]'")
    )
    last_ai_trace_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    last_prompt_version: Mapped[str | None] = mapped_column(String(100))
    last_schema_version: Mapped[str | None] = mapped_column(String(100))
    last_ai_model: Mapped[str | None] = mapped_column(String(100))
    processing_token: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    processing_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ProfileProposal(TimestampMixin, Base):
    __tablename__ = "profile_proposals"
    __table_args__ = (
        ForeignKeyConstraint(
            ["profile_import_id", "owner_user_id", "company_id"],
            ["profile_imports.id", "profile_imports.owner_user_id", "profile_imports.company_id"],
            name="fk_profile_proposals_import_scope",
            ondelete="CASCADE",
        ),
        UniqueConstraint(
            "profile_import_id", "version", name="uq_profile_proposals_import_version"
        ),
        UniqueConstraint(
            "id",
            "profile_import_id",
            "owner_user_id",
            "company_id",
            name="uq_profile_proposals_scope",
        ),
        CheckConstraint("version > 0", name="ck_profile_proposals_version_positive"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    profile_import_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    owner_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    trace_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    prompt_version: Mapped[str] = mapped_column(String(100), nullable=False)
    schema_version: Mapped[str] = mapped_column(String(100), nullable=False)
    model: Mapped[str] = mapped_column(String(100), nullable=False)


class ProfileProposedValue(TimestampMixin, Base):
    __tablename__ = "profile_proposed_values"
    __table_args__ = (
        ForeignKeyConstraint(
            ["proposal_id", "profile_import_id", "owner_user_id", "company_id"],
            [
                "profile_proposals.id",
                "profile_proposals.profile_import_id",
                "profile_proposals.owner_user_id",
                "profile_proposals.company_id",
            ],
            name="fk_profile_proposed_values_proposal_scope",
            ondelete="CASCADE",
        ),
        UniqueConstraint("proposal_id", "field_name", name="uq_profile_proposed_values_field"),
        UniqueConstraint(
            "id",
            "profile_import_id",
            "owner_user_id",
            "company_id",
            name="uq_profile_proposed_values_scope",
        ),
        UniqueConstraint(
            "id", "owner_user_id", "company_id", name="uq_profile_proposed_values_owner_scope"
        ),
        CheckConstraint("field_name = 'jobTitle'", name="ck_profile_proposed_values_field"),
        CheckConstraint(
            "support_status IN ('SUPPORTED', 'AMBIGUOUS', 'MISSING')",
            name="ck_profile_proposed_values_support_status",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    proposal_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    profile_import_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    owner_user_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    company_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    field_name: Mapped[str] = mapped_column(String(40), nullable=False)
    value: Mapped[str | None] = mapped_column(String(160))
    support_status: Mapped[str] = mapped_column(String(20), nullable=False)


class ProfileEvidenceRef(TimestampMixin, Base):
    __tablename__ = "profile_evidence_refs"
    __table_args__ = (
        UniqueConstraint(
            "proposed_value_id",
            "source_block_id",
            "char_start",
            "char_end",
            name="uq_profile_evidence_refs_span",
        ),
        CheckConstraint("char_start >= 0", name="ck_profile_evidence_refs_char_start"),
        CheckConstraint("char_end > char_start", name="ck_profile_evidence_refs_char_span"),
        ForeignKeyConstraint(
            ["proposed_value_id", "subject_id", "company_id"],
            [
                "profile_proposed_values.id",
                "profile_proposed_values.owner_user_id",
                "profile_proposed_values.company_id",
            ],
            name="fk_profile_evidence_refs_proposed_value_scope",
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["source_block_id", "source_version_id"],
            ["source_blocks.id", "source_blocks.source_version_id"],
            name="fk_profile_evidence_refs_block_version",
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["source_version_id", "source_document_id", "subject_id", "company_id"],
            [
                "source_versions.id",
                "source_versions.document_id",
                "source_versions.owner_user_id",
                "source_versions.company_id",
            ],
            name="fk_profile_evidence_refs_source_scope",
            ondelete="RESTRICT",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    proposed_value_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    subject_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    source_document_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("source_documents.id", ondelete="RESTRICT"), nullable=False
    )
    source_version_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("source_versions.id", ondelete="RESTRICT"), nullable=False
    )
    source_block_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("source_blocks.id", ondelete="RESTRICT"), nullable=False
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False
    )
    char_start: Mapped[int] = mapped_column(Integer, nullable=False)
    char_end: Mapped[int] = mapped_column(Integer, nullable=False)
    quote: Mapped[str] = mapped_column(String(800), nullable=False)
    quote_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    page_number: Mapped[int | None] = mapped_column(Integer)
    sheet_name: Mapped[str | None] = mapped_column(String(100))


class ProfileFieldProvenance(Base):
    __tablename__ = "profile_field_provenance"
    __table_args__ = (
        ForeignKeyConstraint(
            ["profile_import_id", "user_id", "company_id"],
            ["profile_imports.id", "profile_imports.owner_user_id", "profile_imports.company_id"],
            name="fk_profile_field_provenance_import_scope",
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["proposed_value_id", "profile_import_id", "user_id", "company_id"],
            [
                "profile_proposed_values.id",
                "profile_proposed_values.profile_import_id",
                "profile_proposed_values.owner_user_id",
                "profile_proposed_values.company_id",
            ],
            name="fk_profile_field_provenance_value_scope",
            ondelete="RESTRICT",
        ),
        ForeignKeyConstraint(
            ["actor_id", "company_id"],
            ["users.id", "users.company_id"],
            name="fk_profile_field_provenance_actor_company",
            ondelete="RESTRICT",
        ),
        UniqueConstraint(
            "profile_import_id", "proposed_value_id", name="uq_profile_field_provenance_import_item"
        ),
        CheckConstraint("field_name = 'jobTitle'", name="ck_profile_field_provenance_field"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False
    )
    profile_import_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    proposed_value_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    actor_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    field_name: Mapped[str] = mapped_column(String(40), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class ProfileApplyReceipt(Base):
    __tablename__ = "profile_apply_receipts"
    __table_args__ = (
        ForeignKeyConstraint(
            ["profile_import_id", "owner_user_id", "company_id"],
            ["profile_imports.id", "profile_imports.owner_user_id", "profile_imports.company_id"],
            name="fk_profile_apply_receipts_import_scope",
            ondelete="RESTRICT",
        ),
        UniqueConstraint(
            "owner_user_id",
            "company_id",
            "idempotency_key_hash",
            name="uq_profile_apply_receipts_owner_key",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    command_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, unique=True)
    profile_import_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    owner_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False
    )
    idempotency_key_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    request_digest: Mapped[str] = mapped_column(String(64), nullable=False)
    result: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
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
