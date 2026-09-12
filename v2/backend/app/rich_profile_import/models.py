import uuid
from typing import Any
from sqlalchemy import JSON, Boolean, ForeignKeyConstraint, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
from app.domain.models import TimestampMixin


class RichProfileImport(TimestampMixin, Base):
    __tablename__ = "rich_profile_imports"
    __table_args__ = (
        ForeignKeyConstraint(
            ["owner_user_id", "company_id"],
            ["users.id", "users.company_id"],
            name="fk_rich_import_owner_company",
        ),
    )
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    owner_user_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    company_id: Mapped[uuid.UUID] = mapped_column(Uuid)
    encrypted_sources: Mapped[str] = mapped_column(Text)
    source_labels: Mapped[list[str]] = mapped_column(JSON)
    proposal: Mapped[dict[str, Any]] = mapped_column(JSON)
    snapshot_hash: Mapped[str] = mapped_column(String(64))
    version: Mapped[int] = mapped_column(Integer, default=1)
    applied: Mapped[bool] = mapped_column(Boolean, default=False)
    identity_warning: Mapped[bool] = mapped_column(Boolean, default=False)
    applied_request_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    applied_hash: Mapped[str | None] = mapped_column(String(64))
    applied_counts: Mapped[dict[str, int] | None] = mapped_column(JSON)
