from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import timedelta
from typing import Any, cast

from sqlalchemy import and_, delete, func, or_, select, update
from sqlalchemy.engine import CursorResult
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.enums import ProfileImportStatus
from app.domain.models import (
    ProfileEvidenceRef,
    ProfileImport,
    ProfileProposal,
    ProfileProposedValue,
    SourceBlock,
    SourceDocument,
    SourceVersion,
    utc_now,
)
from app.repositories.base import BaseRepository


class SourceDocumentRepository(BaseRepository[SourceDocument]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, SourceDocument)

    async def get_duplicate(
        self, owner_user_id: uuid.UUID, company_id: uuid.UUID, sha256: str
    ) -> SourceDocument | None:
        result = await self.session.execute(
            select(SourceDocument).where(
                SourceDocument.owner_user_id == owner_user_id,
                SourceDocument.company_id == company_id,
                SourceDocument.sha256 == sha256,
            )
        )
        return result.scalar_one_or_none()

    async def get_duplicate_import(
        self, owner_user_id: uuid.UUID, company_id: uuid.UUID, sha256: str
    ) -> tuple[SourceDocument, ProfileImport] | None:
        result = await self.session.execute(
            select(SourceDocument, ProfileImport)
            .join(ProfileImport, ProfileImport.source_document_id == SourceDocument.id)
            .where(
                SourceDocument.owner_user_id == owner_user_id,
                SourceDocument.company_id == company_id,
                SourceDocument.sha256 == sha256,
                ProfileImport.owner_user_id == owner_user_id,
                ProfileImport.company_id == company_id,
            )
            .with_for_update(of=ProfileImport)
        )
        return result.tuples().one_or_none()


class SourceVersionRepository(BaseRepository[SourceVersion]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, SourceVersion)


class SourceBlockRepository(BaseRepository[SourceBlock]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, SourceBlock)

    async def list_for_version(self, version_id: uuid.UUID) -> Sequence[SourceBlock]:
        result = await self.session.execute(
            select(SourceBlock)
            .where(SourceBlock.source_version_id == version_id)
            .order_by(SourceBlock.ordinal, SourceBlock.id)
        )
        return result.scalars().all()


class ProfileImportRepository(BaseRepository[ProfileImport]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, ProfileImport)

    async def get_for_document(self, document_id: uuid.UUID) -> ProfileImport | None:
        result = await self.session.execute(
            select(ProfileImport).where(ProfileImport.source_document_id == document_id)
        )
        return result.scalar_one_or_none()

    async def get_scoped(
        self, import_id: uuid.UUID, owner_user_id: uuid.UUID, company_id: uuid.UUID
    ) -> ProfileImport | None:
        result = await self.session.execute(
            select(ProfileImport)
            .where(
                ProfileImport.id == import_id,
                ProfileImport.owner_user_id == owner_user_id,
                ProfileImport.company_id == company_id,
            )
            .execution_options(populate_existing=True)
        )
        return result.scalar_one_or_none()

    async def get_scoped_for_update(
        self, import_id: uuid.UUID, owner_user_id: uuid.UUID, company_id: uuid.UUID
    ) -> ProfileImport | None:
        result = await self.session.execute(
            select(ProfileImport)
            .where(
                ProfileImport.id == import_id,
                ProfileImport.owner_user_id == owner_user_id,
                ProfileImport.company_id == company_id,
            )
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        return result.scalar_one_or_none()

    async def claim_for_parse(
        self,
        import_id: uuid.UUID,
        owner_user_id: uuid.UUID,
        company_id: uuid.UUID,
        *,
        lease_seconds: int = 300,
    ) -> uuid.UUID | None:
        now = utc_now()
        token = uuid.uuid4()
        stale_before = now - timedelta(seconds=lease_seconds)
        result = await self.session.execute(
            update(ProfileImport)
            .where(
                ProfileImport.id == import_id,
                ProfileImport.owner_user_id == owner_user_id,
                ProfileImport.company_id == company_id,
                or_(
                    ProfileImport.status.in_(
                        [ProfileImportStatus.PENDING, ProfileImportStatus.FAILED]
                    ),
                    and_(
                        ProfileImport.status == ProfileImportStatus.PROCESSING,
                        ProfileImport.processing_started_at < stale_before,
                    ),
                ),
            )
            .values(
                status=ProfileImportStatus.PROCESSING,
                error_code=None,
                last_ai_status=None,
                last_ai_warnings=[],
                last_clarification_questions=[],
                last_ai_trace_id=None,
                last_prompt_version=None,
                last_schema_version=None,
                last_ai_model=None,
                processing_token=token,
                processing_started_at=now,
                version=ProfileImport.version + 1,
                updated_at=now,
            )
            .execution_options(synchronize_session=False)
        )
        return token if cast(CursorResult[Any], result).rowcount == 1 else None

    async def finalize_parse_claim(
        self,
        import_id: uuid.UUID,
        owner_user_id: uuid.UUID,
        company_id: uuid.UUID,
        processing_token: uuid.UUID,
        *,
        ai_status: str,
        ai_warnings: list[str],
        clarification_questions: list[str],
        trace_id: uuid.UUID,
        prompt_version: str,
        schema_version: str,
        model: str,
    ) -> int | None:
        """Consume a parse lease atomically and return the committed proposal version.

        The token predicate is the write fence. A worker whose lease was reclaimed
        cannot publish an older provider result, even if its ORM identity map still
        contains the token it originally acquired.
        """
        result = await self.session.execute(
            update(ProfileImport)
            .where(
                ProfileImport.id == import_id,
                ProfileImport.owner_user_id == owner_user_id,
                ProfileImport.company_id == company_id,
                ProfileImport.status == ProfileImportStatus.PROCESSING,
                ProfileImport.processing_token == processing_token,
            )
            .values(
                status=ProfileImportStatus.PARSED,
                proposal_version=ProfileImport.proposal_version + 1,
                error_code=None,
                last_ai_status=ai_status,
                last_ai_warnings=ai_warnings,
                last_clarification_questions=clarification_questions,
                last_ai_trace_id=trace_id,
                last_prompt_version=prompt_version,
                last_schema_version=schema_version,
                last_ai_model=model,
                processing_token=None,
                processing_started_at=None,
                version=ProfileImport.version + 1,
                updated_at=utc_now(),
            )
            .returning(ProfileImport.proposal_version)
            .execution_options(synchronize_session=False)
        )
        return result.scalar_one_or_none()

    async def delete_before_applied(
        self,
        import_id: uuid.UUID,
        owner_user_id: uuid.UUID,
        company_id: uuid.UUID,
    ) -> uuid.UUID | None:
        result = await self.session.execute(
            delete(ProfileImport)
            .where(
                ProfileImport.id == import_id,
                ProfileImport.owner_user_id == owner_user_id,
                ProfileImport.company_id == company_id,
                ProfileImport.status != ProfileImportStatus.APPLIED,
            )
            .returning(ProfileImport.source_document_id)
            .execution_options(synchronize_session=False)
        )
        return result.scalar_one_or_none()

    async def list_for_owner(
        self,
        owner_user_id: uuid.UUID,
        company_id: uuid.UUID,
        *,
        limit: int,
        offset: int,
    ) -> tuple[Sequence[tuple[ProfileImport, SourceDocument]], int]:
        scope = (
            ProfileImport.owner_user_id == owner_user_id,
            ProfileImport.company_id == company_id,
        )
        total = await self.session.scalar(
            select(func.count()).select_from(ProfileImport).where(*scope)
        )
        result = await self.session.execute(
            select(ProfileImport, SourceDocument)
            .join(SourceDocument, SourceDocument.id == ProfileImport.source_document_id)
            .where(*scope)
            .order_by(ProfileImport.created_at.desc(), ProfileImport.id)
            .limit(limit)
            .offset(offset)
        )
        return result.tuples().all(), int(total or 0)


class ProfileProposalRepository(BaseRepository[ProfileProposal]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, ProfileProposal)


class ProfileProposedValueRepository(BaseRepository[ProfileProposedValue]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, ProfileProposedValue)


class ProfileEvidenceRefRepository(BaseRepository[ProfileEvidenceRef]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, ProfileEvidenceRef)
