from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import re
import unicodedata
import uuid
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from typing import Any, Literal, cast

from fastapi import UploadFile
from sqlalchemy import delete, select, update
from sqlalchemy.engine import CursorResult
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.gateway import (
    AiGateway,
    AiResult,
    AiStatus,
    AiTask,
    EvidenceBlock,
    EvidenceContext,
    SupportStatus,
)
from app.domain.enums import ProfileImportStatus
from app.domain.models import (
    ProfileApplyReceipt,
    ProfileEvidenceRef,
    ProfileFieldProvenance,
    ProfileImport,
    ProfileProposal,
    ProfileProposedValue,
    SourceBlock,
    SourceDocument,
    SourceVersion,
    User,
)
from app.domain.profile_import_schemas import JobTitleAiProposal, ProfileApplyRequest
from app.repositories.activity_repo import ActivityLogRepository
from app.repositories.profile_import_repo import (
    ProfileEvidenceRefRepository,
    ProfileImportRepository,
    ProfileProposalRepository,
    ProfileProposedValueRepository,
    SourceBlockRepository,
    SourceDocumentRepository,
    SourceVersionRepository,
)
from app.services.document_extractor import DocumentExtractionError, DocumentExtractor
from app.services.malware_scanner import (
    MalwareScanner,
    MalwareScannerUnavailable,
    MalwareScanStatus,
)

MAX_IMPORT_BYTES = 10 * 1024 * 1024
MAX_AI_OPERATION_SECONDS = 30.0


class ProfileImportError(RuntimeError):
    def __init__(
        self,
        status_code: int,
        detail: str,
        *,
        current_profile_version: int | None = None,
        current_proposal_version: int | None = None,
    ) -> None:
        self.status_code = status_code
        self.detail = detail
        self.current_profile_version = current_profile_version
        self.current_proposal_version = current_proposal_version
        super().__init__(detail)


@dataclass(frozen=True)
class ProfileImportView:
    profile_import: ProfileImport
    document: SourceDocument


@dataclass(frozen=True)
class ParsedProfileImportView:
    profile_import: ProfileImport
    profile_version: int
    ai_result: AiResult[JobTitleAiProposal]
    proposal: ProfileProposal | None
    proposed_value: ProfileProposedValue | None
    evidence_refs: tuple[ProfileEvidenceRef, ...]
    evidence_contexts: Mapping[uuid.UUID, str]


@dataclass(frozen=True)
class ProfileImportDetailView:
    profile_import: ProfileImport
    document: SourceDocument
    profile_version: int
    proposal: ProfileProposal | None
    proposed_value: ProfileProposedValue | None
    evidence_refs: tuple[ProfileEvidenceRef, ...]
    evidence_contexts: Mapping[uuid.UUID, str]


@dataclass(frozen=True)
class ApplyProfileImportResult:
    command_id: uuid.UUID
    status: Literal["APPLIED", "ALREADY_APPLIED"]
    profile_version: int


class ApplyFailureInjector:
    async def after_profile_update(self) -> None:
        return None


class ProfileImportService:
    def __init__(
        self,
        session: AsyncSession,
        scanner: MalwareScanner,
        extractor: DocumentExtractor | None = None,
    ) -> None:
        self.session = session
        self.scanner = scanner
        self.extractor = extractor or DocumentExtractor()
        self.document_repo = SourceDocumentRepository(session)
        self.version_repo = SourceVersionRepository(session)
        self.block_repo = SourceBlockRepository(session)
        self.import_repo = ProfileImportRepository(session)
        self.proposal_repo = ProfileProposalRepository(session)
        self.proposed_value_repo = ProfileProposedValueRepository(session)
        self.evidence_repo = ProfileEvidenceRefRepository(session)

    async def intake_document(
        self, actor: User, upload: UploadFile
    ) -> tuple[ProfileImportView, bool]:
        if actor.company_id is None:
            raise ProfileImportError(403, "Tài khoản chưa thuộc doanh nghiệp")
        actor_id = actor.id
        company_id = actor.company_id
        filename = (upload.filename or "").strip()
        if (
            len(filename) > 255
            or any(unicodedata.category(char).startswith("C") for char in filename)
            or re.search(r"%(?:0[0-9a-f]|1[0-9a-f]|7f)", filename, re.IGNORECASE)
        ):
            raise ProfileImportError(422, "Tên tài liệu không hợp lệ")
        content = await self._read_limited(upload)
        try:
            self.extractor.validate(filename, upload.content_type or "", content)
        except DocumentExtractionError as error:
            raise ProfileImportError(415, str(error)) from error

        digest = hashlib.sha256(content).hexdigest()
        try:
            scan = await self.scanner.scan(content, sha256=digest)
        except MalwareScannerUnavailable as error:
            raise ProfileImportError(503, "Không thể xác minh an toàn tài liệu") from error
        if scan.status != MalwareScanStatus.CLEAN:
            raise ProfileImportError(422, "Tài liệu không vượt qua kiểm tra an toàn")

        try:
            _extension, extracted_blocks = await self.extractor.extract(
                filename, upload.content_type or "", content
            )
        except DocumentExtractionError as error:
            raise ProfileImportError(422, str(error)) from error

        existing = await self.document_repo.get_duplicate_import(actor_id, company_id, digest)
        if existing is not None:
            existing_document, existing_import = existing
            return ProfileImportView(existing_import, existing_document), False

        document = SourceDocument(
            owner_user_id=actor_id,
            company_id=company_id,
            original_filename=filename,
            mime_type=upload.content_type or "application/octet-stream",
            byte_size=len(content),
            sha256=digest,
        )
        try:
            await self.document_repo.add(document)
            version = await self.version_repo.add(
                SourceVersion(
                    document_id=document.id,
                    owner_user_id=actor_id,
                    company_id=company_id,
                    version=1,
                    content_sha256=digest,
                )
            )
            self.session.add_all(
                [
                    SourceBlock(
                        source_version_id=version.id,
                        ordinal=ordinal,
                        text=block.text,
                        text_sha256=hashlib.sha256(block.text.encode("utf-8")).hexdigest(),
                        char_start=0,
                        char_end=len(block.text),
                        page_number=block.page_number,
                        sheet_name=block.sheet_name,
                    )
                    for ordinal, block in enumerate(extracted_blocks)
                ]
            )
            await self.session.flush()
            profile_import = await self.import_repo.add(
                ProfileImport(
                    owner_user_id=actor_id,
                    company_id=company_id,
                    source_document_id=document.id,
                    source_version_id=version.id,
                    status=ProfileImportStatus.PENDING,
                )
            )
            await self.session.commit()
        except IntegrityError as error:
            await self.session.rollback()
            duplicate = await self.document_repo.get_duplicate_import(actor_id, company_id, digest)
            if duplicate is None:
                raise ProfileImportError(
                    409, "Tài liệu trùng vừa thay đổi; hãy thử tải lại"
                ) from error
            duplicate_document, duplicate_import = duplicate
            return ProfileImportView(duplicate_import, duplicate_document), False
        except Exception:
            await self.session.rollback()
            raise
        return ProfileImportView(profile_import, document), True

    async def list_for_owner(
        self, actor: User, *, page: int, page_size: int
    ) -> tuple[Sequence[ProfileImportView], int]:
        if actor.company_id is None:
            raise ProfileImportError(403, "Tài khoản chưa thuộc doanh nghiệp")
        rows, total = await self.import_repo.list_for_owner(
            actor.id, actor.company_id, limit=page_size, offset=(page - 1) * page_size
        )
        return (
            [ProfileImportView(profile_import=item, document=document) for item, document in rows],
            total,
        )

    async def get_detail(self, actor: User, import_id: uuid.UUID) -> ProfileImportDetailView:
        if actor.company_id is None:
            raise ProfileImportError(403, "Tài khoản chưa thuộc doanh nghiệp")
        profile_import = await self.import_repo.get_scoped(import_id, actor.id, actor.company_id)
        if profile_import is None:
            raise ProfileImportError(404, "Không tìm thấy bản nhập hồ sơ")
        document = await self.session.scalar(
            select(SourceDocument).where(
                SourceDocument.id == profile_import.source_document_id,
                SourceDocument.owner_user_id == actor.id,
                SourceDocument.company_id == actor.company_id,
            )
        )
        if document is None:
            raise RuntimeError("profile import source document disappeared")
        proposal = await self.session.scalar(
            select(ProfileProposal)
            .where(
                ProfileProposal.profile_import_id == import_id,
                ProfileProposal.owner_user_id == actor.id,
                ProfileProposal.company_id == actor.company_id,
            )
            .order_by(ProfileProposal.version.desc())
            .limit(1)
        )
        proposed_value: ProfileProposedValue | None = None
        evidence_refs: tuple[ProfileEvidenceRef, ...] = ()
        evidence_contexts: dict[uuid.UUID, str] = {}
        if proposal is not None:
            proposed_value = await self.session.scalar(
                select(ProfileProposedValue).where(ProfileProposedValue.proposal_id == proposal.id)
            )
            if proposed_value is not None:
                evidence_refs = tuple(
                    (
                        await self.session.scalars(
                            select(ProfileEvidenceRef)
                            .where(ProfileEvidenceRef.proposed_value_id == proposed_value.id)
                            .order_by(ProfileEvidenceRef.char_start, ProfileEvidenceRef.id)
                        )
                    ).all()
                )
                block_ids = {evidence.source_block_id for evidence in evidence_refs}
                if block_ids:
                    source_blocks = (
                        await self.session.scalars(
                            select(SourceBlock).where(
                                SourceBlock.id.in_(block_ids),
                                SourceBlock.source_version_id == profile_import.source_version_id,
                            )
                        )
                    ).all()
                    evidence_contexts = {block.id: block.text for block in source_blocks}
        return ProfileImportDetailView(
            profile_import=profile_import,
            document=document,
            profile_version=actor.version,
            proposal=proposal,
            proposed_value=proposed_value,
            evidence_refs=evidence_refs,
            evidence_contexts=evidence_contexts,
        )

    async def delete_before_apply(
        self, actor: User, import_id: uuid.UUID, request_id: str | None
    ) -> None:
        if actor.company_id is None:
            raise ProfileImportError(403, "Tài khoản chưa thuộc doanh nghiệp")
        actor_id = actor.id
        company_id = actor.company_id
        profile_import = await self.import_repo.get_scoped(import_id, actor_id, company_id)
        if profile_import is None:
            raise ProfileImportError(404, "Không tìm thấy bản nhập hồ sơ")
        try:
            document_id = await self.import_repo.delete_before_applied(
                import_id, actor_id, company_id
            )
            if document_id is None:
                raise ProfileImportError(409, "Không thể xóa bản nhập đã được áp dụng")
            await self.session.execute(
                delete(SourceDocument).where(
                    SourceDocument.id == document_id,
                    SourceDocument.owner_user_id == actor_id,
                    SourceDocument.company_id == company_id,
                )
            )
            await ActivityLogRepository(self.session).log(
                actor_id=actor_id,
                company_id=company_id,
                action="profile.import.delete",
                entity_type="profile_import",
                entity_id=str(import_id),
                changes={"deleted": True},
                request_id=request_id,
            )
            await self.session.commit()
        except ProfileImportError:
            await self.session.rollback()
            raise
        except IntegrityError as error:
            await self.session.rollback()
            raise ProfileImportError(409, "Bản nhập hồ sơ đã thay đổi trong khi xóa") from error
        except Exception:
            await self.session.rollback()
            raise

    async def parse_job_title(
        self, actor: User, import_id: uuid.UUID, gateway: AiGateway
    ) -> ParsedProfileImportView:
        if actor.company_id is None:
            raise ProfileImportError(403, "Tài khoản chưa thuộc doanh nghiệp")
        profile_import = await self.import_repo.get_scoped(import_id, actor.id, actor.company_id)
        if profile_import is None:
            raise ProfileImportError(404, "Không tìm thấy bản nhập hồ sơ")
        processing_token = await self.import_repo.claim_for_parse(
            import_id, actor.id, actor.company_id
        )
        if processing_token is None:
            await self.session.rollback()
            raise ProfileImportError(409, "Bản nhập hồ sơ đang được xử lý")
        try:
            await self.session.commit()
            await self.session.refresh(profile_import)
        except asyncio.CancelledError:
            await self.session.rollback()
            await asyncio.shield(
                self._best_effort_mark_failed(import_id, processing_token, "request_cancelled")
            )
            raise
        except Exception:
            await self.session.rollback()
            await self._best_effort_mark_failed(import_id, processing_token, "claim_refresh_failed")
            raise

        try:
            blocks = await self.block_repo.list_for_version(profile_import.source_version_id)
        except asyncio.CancelledError:
            await asyncio.shield(
                self._best_effort_mark_failed(import_id, processing_token, "request_cancelled")
            )
            raise
        except Exception:
            await self._best_effort_mark_failed(import_id, processing_token, "source_read_failed")
            raise
        if not blocks:
            await self._mark_failed(import_id, processing_token, "missing_source_block")
            raise ProfileImportError(422, "Tài liệu không có nguồn dẫn hợp lệ")
        if any(
            not hmac.compare_digest(
                hashlib.sha256(block.text.encode("utf-8")).hexdigest(), block.text_sha256
            )
            for block in blocks
        ):
            await self._mark_failed(import_id, processing_token, "source_checksum_mismatch")
            raise ProfileImportError(422, "Nội dung nguồn không vượt qua kiểm tra toàn vẹn")
        proposal_item_id = uuid.uuid5(import_id, "jobTitle:v1")
        clarification_questions: tuple[str, ...]
        if _document_contains_instruction(block.text for block in blocks):
            clarification_questions = (
                "Tài liệu có đoạn giống chỉ dẫn cho AI. Hãy xóa đoạn chỉ dẫn hoặc xác nhận lại dữ liệu nguồn.",
            )
        elif sum(len(block.text.strip()) for block in blocks) < 8:
            clarification_questions = ("Hãy bổ sung chức danh hiện tại trong tài liệu.",)
        else:
            clarification_questions = ()
        context = EvidenceContext(
            tenant_id=actor.company_id,
            actor_id=actor.id,
            evidence_blocks=tuple(
                EvidenceBlock(
                    subject_id=actor.id,
                    source_id=profile_import.source_document_id,
                    source_version_id=profile_import.source_version_id,
                    block_id=block.id,
                    tenant_id=actor.company_id,
                    text=block.text,
                )
                for block in blocks
            ),
            allowed_entity_ids=frozenset({actor.id, import_id, proposal_item_id}),
            clarification_questions=clarification_questions,
            fixture_id="profile-import-job-title-v1",
        )
        # End the source-read transaction before any provider call.
        try:
            await self.session.commit()
        except asyncio.CancelledError:
            await asyncio.shield(
                self._best_effort_mark_failed(import_id, processing_token, "request_cancelled")
            )
            raise
        except Exception:
            await self._best_effort_mark_failed(
                import_id, processing_token, "source_read_commit_failed"
            )
            raise
        try:
            async with asyncio.timeout(MAX_AI_OPERATION_SECONDS):
                result = await gateway.generate(AiTask.PROFILE_IMPORT, JobTitleAiProposal, context)
        except asyncio.CancelledError:
            await asyncio.shield(
                self._best_effort_mark_failed(import_id, processing_token, "request_cancelled")
            )
            raise
        except Exception as error:
            await self._mark_failed(import_id, processing_token, "ai_gateway_unavailable")
            raise ProfileImportError(503, "Dịch vụ trích xuất tạm thời không khả dụng") from error
        if result.status != AiStatus.OK or result.data is None:
            error_code = {
                AiStatus.NEEDS_CLARIFICATION: "needs_clarification",
                AiStatus.INSUFFICIENT_EVIDENCE: "insufficient_evidence",
                AiStatus.FAILED: "ai_failed",
            }[result.status]
            await self._mark_failed(import_id, processing_token, error_code, ai_result=result)
            failed_import = await self.import_repo.get_scoped(import_id, actor.id, actor.company_id)
            if failed_import is None:
                raise RuntimeError("failed import disappeared")
            return ParsedProfileImportView(
                profile_import=failed_import,
                profile_version=actor.version,
                ai_result=result,
                proposal=None,
                proposed_value=None,
                evidence_refs=(),
                evidence_contexts={},
            )

        proposal_data = result.data
        if (
            proposal_data.import_id != import_id
            or proposal_data.subject_id != actor.id
            or proposal_data.proposal_item_id != proposal_item_id
            or proposal_data.job_title.support_status
            not in {SupportStatus.SUPPORTED, SupportStatus.AMBIGUOUS}
            or proposal_data.job_title.value is None
            or not proposal_data.job_title.value.strip()
        ):
            await self._mark_failed(
                import_id, processing_token, "invalid_job_title_proposal", ai_result=result
            )
            raise ProfileImportError(422, "Đề xuất chức danh không hợp lệ")
        title = proposal_data.job_title.value.strip()
        if len(title) > 160:
            await self._mark_failed(
                import_id, processing_token, "invalid_job_title_proposal", ai_result=result
            )
            raise ProfileImportError(422, "Đề xuất chức danh vượt giới hạn")
        block_by_id = {block.id: block for block in blocks}
        if any(
            not _job_title_evidence_is_semantically_safe(
                title,
                evidence.quote,
                block_by_id[evidence.block_id].text,
                evidence.char_start,
                evidence.char_end,
            )
            for evidence in proposal_data.job_title.evidence_refs
        ):
            await self._mark_failed(
                import_id, processing_token, "unsafe_job_title_evidence", ai_result=result
            )
            raise ProfileImportError(422, "Nguồn dẫn không chứng minh chức danh an toàn")

        try:
            next_version = await self.import_repo.finalize_parse_claim(
                import_id,
                actor.id,
                actor.company_id,
                processing_token,
                ai_status=result.status.value,
                ai_warnings=list(result.warnings),
                clarification_questions=list(result.clarification_questions),
                trace_id=result.trace_id,
                prompt_version=result.prompt_version,
                schema_version=result.schema_version,
                model=result.model,
            )
            if next_version is None:
                raise ProfileImportError(409, "Bản nhập hồ sơ đã thay đổi")
            proposal = await self.proposal_repo.add(
                ProfileProposal(
                    id=uuid.uuid5(import_id, f"proposal:v{next_version}"),
                    profile_import_id=import_id,
                    owner_user_id=actor.id,
                    company_id=actor.company_id,
                    version=next_version,
                    trace_id=result.trace_id,
                    prompt_version=result.prompt_version,
                    schema_version=result.schema_version,
                    model=result.model,
                )
            )
            proposed_value = await self.proposed_value_repo.add(
                ProfileProposedValue(
                    id=proposal_item_id,
                    proposal_id=proposal.id,
                    profile_import_id=import_id,
                    owner_user_id=actor.id,
                    company_id=actor.company_id,
                    field_name="jobTitle",
                    value=title,
                    support_status=proposal_data.job_title.support_status.value,
                )
            )
            evidence_rows: list[ProfileEvidenceRef] = []
            for evidence in proposal_data.job_title.evidence_refs:
                source_block = block_by_id[evidence.block_id]
                evidence_rows.append(
                    await self.evidence_repo.add(
                        ProfileEvidenceRef(
                            proposed_value_id=proposed_value.id,
                            subject_id=evidence.subject_id,
                            source_document_id=evidence.source_id,
                            source_version_id=evidence.source_version_id,
                            source_block_id=evidence.block_id,
                            company_id=evidence.tenant_id,
                            char_start=evidence.char_start,
                            char_end=evidence.char_end,
                            quote=evidence.quote,
                            quote_sha256=evidence.quote_sha256,
                            page_number=source_block.page_number,
                            sheet_name=source_block.sheet_name,
                        )
                    )
                )
            await self.session.commit()
            refreshed_import = await self.import_repo.get_scoped(
                import_id, actor.id, actor.company_id
            )
            if refreshed_import is None:
                raise ProfileImportError(409, "Bản nhập hồ sơ đã bị xóa trong khi phân tích")
        except ProfileImportError:
            await self.session.rollback()
            raise
        except asyncio.CancelledError:
            await self.session.rollback()
            await asyncio.shield(
                self._best_effort_mark_failed(import_id, processing_token, "request_cancelled")
            )
            raise
        except Exception:
            await self.session.rollback()
            await self._best_effort_mark_failed(
                import_id, processing_token, "proposal_persistence_failed"
            )
            raise
        return ParsedProfileImportView(
            profile_import=refreshed_import,
            profile_version=actor.version,
            ai_result=result,
            proposal=proposal,
            proposed_value=proposed_value,
            evidence_refs=tuple(evidence_rows),
            evidence_contexts={block.id: block.text for block in blocks},
        )

    async def _mark_failed(
        self,
        import_id: uuid.UUID,
        processing_token: uuid.UUID,
        error_code: str,
        *,
        ai_result: AiResult[JobTitleAiProposal] | None = None,
    ) -> None:
        ai_status = (
            ai_result.status.value
            if ai_result is not None and ai_result.status != AiStatus.OK
            else AiStatus.FAILED.value
        )
        warnings = list(ai_result.warnings) if ai_result is not None else []
        if error_code not in warnings:
            warnings.append(error_code)
        result = await self.session.execute(
            update(ProfileImport)
            .where(
                ProfileImport.id == import_id,
                ProfileImport.status == ProfileImportStatus.PROCESSING,
                ProfileImport.processing_token == processing_token,
            )
            .values(
                status=ProfileImportStatus.FAILED,
                error_code=error_code,
                last_ai_status=ai_status,
                last_ai_warnings=warnings,
                last_clarification_questions=(
                    list(ai_result.clarification_questions) if ai_result is not None else []
                ),
                last_ai_trace_id=(ai_result.trace_id if ai_result is not None else None),
                last_prompt_version=(ai_result.prompt_version if ai_result is not None else None),
                last_schema_version=(ai_result.schema_version if ai_result is not None else None),
                last_ai_model=(ai_result.model if ai_result is not None else None),
                processing_token=None,
                processing_started_at=None,
                version=ProfileImport.version + 1,
            )
        )
        if cast(CursorResult[Any], result).rowcount != 1:
            await self.session.rollback()
            raise ProfileImportError(409, "Bản nhập hồ sơ đã được worker khác tiếp quản")
        await self.session.commit()

    async def _best_effort_mark_failed(
        self, import_id: uuid.UUID, processing_token: uuid.UUID, error_code: str
    ) -> None:
        try:
            await self.session.rollback()
            result = await self.session.execute(
                update(ProfileImport)
                .where(
                    ProfileImport.id == import_id,
                    ProfileImport.status == ProfileImportStatus.PROCESSING,
                    ProfileImport.processing_token == processing_token,
                )
                .values(
                    status=ProfileImportStatus.FAILED,
                    error_code=error_code,
                    last_ai_status=AiStatus.FAILED.value,
                    last_ai_warnings=[error_code],
                    last_clarification_questions=[],
                    last_ai_trace_id=None,
                    last_prompt_version=None,
                    last_schema_version=None,
                    last_ai_model=None,
                    processing_token=None,
                    processing_started_at=None,
                    version=ProfileImport.version + 1,
                )
            )
            if cast(CursorResult[Any], result).rowcount == 1:
                await self.session.commit()
            else:
                await self.session.rollback()
        except SQLAlchemyError:
            await self.session.rollback()

    async def apply_job_title(
        self,
        actor: User,
        import_id: uuid.UUID,
        command: ProfileApplyRequest,
        idempotency_key: str,
        failure_injector: ApplyFailureInjector,
        request_id: str | None,
    ) -> ApplyProfileImportResult:
        if actor.company_id is None:
            raise ProfileImportError(403, "Tài khoản chưa thuộc doanh nghiệp")
        if not 16 <= len(idempotency_key) <= 100:
            raise ProfileImportError(422, "Idempotency-Key phải có từ 16 đến 100 ký tự")
        canonical = json.dumps(
            {"importId": str(import_id), **command.model_dump(mode="json", by_alias=True)},
            sort_keys=True,
            separators=(",", ":"),
        )
        request_digest = hashlib.sha256(canonical.encode()).hexdigest()
        key_hash = hashlib.sha256(idempotency_key.encode()).hexdigest()
        receipt = await self.session.scalar(
            select(ProfileApplyReceipt).where(
                ProfileApplyReceipt.owner_user_id == actor.id,
                ProfileApplyReceipt.company_id == actor.company_id,
                ProfileApplyReceipt.idempotency_key_hash == key_hash,
            )
        )
        if receipt is not None:
            if receipt.request_digest != request_digest or receipt.profile_import_id != import_id:
                raise ProfileImportError(409, "Idempotency-Key đã được dùng cho request khác")
            return self._receipt_result(receipt)

        profile_import = await self.import_repo.get_scoped_for_update(
            import_id, actor.id, actor.company_id
        )
        if profile_import is None:
            raise ProfileImportError(404, "Không tìm thấy bản nhập hồ sơ")
        if profile_import.status != ProfileImportStatus.PARSED:
            return await self._replay_after_conflict(
                actor.id,
                actor.company_id,
                import_id,
                key_hash,
                request_digest,
                "Bản nhập hồ sơ chưa sẵn sàng để apply",
            )
        if profile_import.proposal_version != command.proposal_version:
            return await self._replay_after_conflict(
                actor.id,
                actor.company_id,
                import_id,
                key_hash,
                request_digest,
                "Proposal đã thay đổi",
            )
        if actor.version != command.profile_version:
            return await self._replay_after_conflict(
                actor.id, actor.company_id, import_id, key_hash, request_digest, "Hồ sơ đã thay đổi"
            )

        proposal = await self.session.scalar(
            select(ProfileProposal).where(
                ProfileProposal.profile_import_id == import_id,
                ProfileProposal.owner_user_id == actor.id,
                ProfileProposal.company_id == actor.company_id,
                ProfileProposal.version == command.proposal_version,
            )
        )
        if proposal is None:
            raise ProfileImportError(404, "Không tìm thấy proposal")
        requested_ids = [item.proposal_item_id for item in command.items]
        if len(requested_ids) != len(set(requested_ids)):
            raise ProfileImportError(422, "Proposal item bị trùng")
        proposed_values = (
            await self.session.scalars(
                select(ProfileProposedValue).where(
                    ProfileProposedValue.proposal_id == proposal.id,
                    ProfileProposedValue.id.in_(requested_ids),
                )
            )
        ).all()
        if len(proposed_values) != len(requested_ids):
            raise ProfileImportError(404, "Không tìm thấy proposal item")
        selected = [
            value
            for value in proposed_values
            if next(item for item in command.items if item.proposal_item_id == value.id).selected
        ]
        if len(selected) != 1:
            raise ProfileImportError(422, "Slice này yêu cầu chọn đúng trường jobTitle")
        proposed_value = selected[0]
        if (
            proposed_value.field_name != "jobTitle"
            or proposed_value.support_status != "SUPPORTED"
            or proposed_value.value is None
        ):
            raise ProfileImportError(422, "Proposal item không thể apply")
        evidence = await self.session.scalar(
            select(ProfileEvidenceRef).where(
                ProfileEvidenceRef.proposed_value_id == proposed_value.id,
                ProfileEvidenceRef.subject_id == actor.id,
                ProfileEvidenceRef.company_id == actor.company_id,
            )
        )
        if evidence is None:
            raise ProfileImportError(422, "Proposal item thiếu nguồn dẫn")
        block = await self.session.scalar(
            select(SourceBlock).where(
                SourceBlock.id == evidence.source_block_id,
                SourceBlock.source_version_id == profile_import.source_version_id,
            )
        )
        if (
            block is None
            or evidence.source_document_id != profile_import.source_document_id
            or evidence.source_version_id != profile_import.source_version_id
            or evidence.char_start < 0
            or evidence.char_end <= evidence.char_start
            or evidence.char_end > len(block.text)
            or evidence.page_number != block.page_number
            or evidence.sheet_name != block.sheet_name
        ):
            raise ProfileImportError(422, "Nguồn dẫn của proposal không hợp lệ")
        quote = unicodedata.normalize(
            "NFC", evidence.quote.replace("\r\n", "\n").replace("\r", "\n")
        )
        expected_quote = block.text[evidence.char_start : evidence.char_end]
        expected_hash = hashlib.sha256(quote.encode("utf-8")).hexdigest()
        if expected_quote != quote or not hmac.compare_digest(expected_hash, evidence.quote_sha256):
            raise ProfileImportError(422, "Nguồn dẫn của proposal không khớp tài liệu")
        if not _job_title_evidence_is_semantically_safe(
            proposed_value.value,
            quote,
            block.text,
            evidence.char_start,
            evidence.char_end,
        ):
            raise ProfileImportError(422, "Nguồn dẫn không chứng minh chức danh an toàn")

        command_id = uuid.uuid4()
        next_profile_version = command.profile_version + 1
        try:
            updated = await self.session.execute(
                update(User)
                .where(
                    User.id == actor.id,
                    User.company_id == actor.company_id,
                    User.version == command.profile_version,
                )
                .values(job_title=proposed_value.value, version=next_profile_version)
            )
            if cast(CursorResult[Any], updated).rowcount != 1:
                return await self._replay_after_conflict(
                    actor.id,
                    actor.company_id,
                    import_id,
                    key_hash,
                    request_digest,
                    "Hồ sơ đã thay đổi",
                )
            await failure_injector.after_profile_update()
            self.session.add(
                ProfileFieldProvenance(
                    user_id=actor.id,
                    company_id=actor.company_id,
                    profile_import_id=import_id,
                    proposed_value_id=proposed_value.id,
                    actor_id=actor.id,
                    field_name="jobTitle",
                )
            )
            profile_import.status = ProfileImportStatus.APPLIED
            profile_import.version += 1
            await ActivityLogRepository(self.session).log(
                actor_id=actor.id,
                company_id=actor.company_id,
                action="profile.import.apply",
                entity_type="profile_import",
                entity_id=str(import_id),
                changes={"fields": ["jobTitle"], "profileVersion": next_profile_version},
                request_id=request_id,
            )
            result_json = {"profileVersion": next_profile_version}
            self.session.add(
                ProfileApplyReceipt(
                    command_id=command_id,
                    profile_import_id=import_id,
                    owner_user_id=actor.id,
                    company_id=actor.company_id,
                    idempotency_key_hash=key_hash,
                    request_digest=request_digest,
                    result=result_json,
                )
            )
            await self.session.commit()
        except ProfileImportError:
            await self.session.rollback()
            raise
        except Exception:
            await self.session.rollback()
            raise
        return ApplyProfileImportResult(
            command_id=command_id,
            status="APPLIED",
            profile_version=next_profile_version,
        )

    @staticmethod
    def _receipt_result(receipt: ProfileApplyReceipt) -> ApplyProfileImportResult:
        return ApplyProfileImportResult(
            command_id=receipt.command_id,
            status="ALREADY_APPLIED",
            profile_version=int(receipt.result["profileVersion"]),
        )

    async def _replay_after_conflict(
        self,
        actor_id: uuid.UUID,
        company_id: uuid.UUID,
        import_id: uuid.UUID,
        key_hash: str,
        request_digest: str,
        conflict_detail: str,
    ) -> ApplyProfileImportResult:
        await self.session.rollback()
        receipt = await self.session.scalar(
            select(ProfileApplyReceipt).where(
                ProfileApplyReceipt.owner_user_id == actor_id,
                ProfileApplyReceipt.company_id == company_id,
                ProfileApplyReceipt.idempotency_key_hash == key_hash,
            )
        )
        if receipt is None:
            current_versions = (
                await self.session.execute(
                    select(User.version, ProfileImport.proposal_version)
                    .select_from(User)
                    .join(
                        ProfileImport,
                        (ProfileImport.owner_user_id == User.id)
                        & (ProfileImport.company_id == User.company_id),
                    )
                    .where(
                        User.id == actor_id,
                        User.company_id == company_id,
                        ProfileImport.id == import_id,
                    )
                )
            ).one_or_none()
            raise ProfileImportError(
                409,
                conflict_detail,
                current_profile_version=(current_versions[0] if current_versions else None),
                current_proposal_version=(current_versions[1] if current_versions else None),
            )
        if receipt.request_digest != request_digest or receipt.profile_import_id != import_id:
            raise ProfileImportError(409, "Idempotency-Key đã được dùng cho request khác")
        return self._receipt_result(receipt)

    @staticmethod
    async def _read_limited(upload: UploadFile) -> bytes:
        chunks: list[bytes] = []
        total = 0
        while chunk := await upload.read(64 * 1024):
            total += len(chunk)
            if total > MAX_IMPORT_BYTES:
                raise ProfileImportError(413, "Tài liệu vượt quá giới hạn 10 MiB")
            chunks.append(chunk)
        if total == 0:
            raise ProfileImportError(422, "Tài liệu rỗng")
        return b"".join(chunks)


DOCUMENT_INSTRUCTION_PATTERNS = (
    re.compile(
        r"\b(?:ignore|disregard|override|forget|bypass)\b.{0,100}"
        r"\b(?:previous|earlier|above|system|developer|instructions?|directions?|rules?|prompt)\b",
        re.IGNORECASE | re.DOTALL,
    ),
    re.compile(
        r"\b(?:set|assign|change|replace|output|return|respond|say)\b.{0,80}"
        r"\b(?:current\s+role|job\s+title|role|title|json|answer)\b",
        re.IGNORECASE | re.DOTALL,
    ),
    re.compile(
        r"(?:bỏ\s+qua|phớt\s+lờ|vượt\s+qua|không\s+làm\s+theo).{0,100}"
        r"(?:hướng\s+dẫn|chỉ\s+dẫn|yêu\s+cầu|lệnh|prompt)",
        re.IGNORECASE | re.DOTALL,
    ),
    re.compile(
        r"(?:hãy\s+)?(?:gán|đặt|đổi|thay\s+đổi|trả\s+về).{0,80}"
        r"(?:chức\s+danh|vai\s+trò|câu\s+trả\s+lời|json)",
        re.IGNORECASE | re.DOTALL,
    ),
    re.compile(r"(?:^|\n)\s*(?:system|developer|assistant|tool)\s*:", re.IGNORECASE),
)


def _document_contains_instruction(blocks: Iterable[str]) -> bool:
    combined = "\n".join(unicodedata.normalize("NFKC", block) for block in blocks)
    return any(pattern.search(combined) for pattern in DOCUMENT_INSTRUCTION_PATTERNS)


def redacted_context_excerpt(
    block_text: str, char_start: int, char_end: int, *, radius: int = 120
) -> str:
    start = max(0, char_start - radius)
    end = min(len(block_text), char_end + radius)
    excerpt = block_text[start:end]
    excerpt = re.sub(r"(?<![\w.+-])[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}(?![\w.-])", "[EMAIL]", excerpt)
    excerpt = re.sub(r"(?<!\d)(?:\+?\d[\d .()-]{7,}\d)(?!\d)", "[PHONE]", excerpt)
    return ("…" if start else "") + excerpt + ("…" if end < len(block_text) else "")


def _job_title_evidence_is_semantically_safe(
    title: str, quote: str, block_text: str, char_start: int, char_end: int
) -> bool:
    normalized_title = unicodedata.normalize("NFC", title).strip().casefold()
    normalized_quote = unicodedata.normalize("NFC", quote).strip().casefold()
    if not normalized_title or normalized_title not in normalized_quote:
        return False
    return not _document_contains_instruction((block_text,))
