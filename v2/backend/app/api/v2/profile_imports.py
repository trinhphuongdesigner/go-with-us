from __future__ import annotations

import os
import uuid
from typing import Annotated, cast

from fastapi import (
    APIRouter,
    Depends,
    File,
    Header,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
    status,
)
from fastapi.responses import JSONResponse
from sqlalchemy import select

from app.ai.gateway import AiGateway, AiStatus, SupportStatus
from app.ai.provider_runtime import unavailable_profile_import_ai_gateway
from app.api.v2.dependencies import CurrentUser, DbSession
from app.career_ai.models import AiConnection
from app.core.config import get_settings
from app.domain.profile_import_schemas import (
    ProfileApplyRead,
    ProfileApplyRequest,
    ProfileConflictRead,
    ProfileEvidenceRead,
    ProfileImportDetailRead,
    ProfileImportList,
    ProfileImportParseRead,
    ProfileImportRead,
    ProfileProposalItemRead,
    ProfileProposalRead,
)
from app.services.document_extractor import DocumentExtractor, TesseractOcrExtractor
from app.services.malware_scanner import (
    ClamAvTcpScanner,
    MalwareScanner,
    UnavailableMalwareScanner,
)
from app.services.profile_import_service import (
    ApplyFailureInjector,
    ProfileImportDetailView,
    ProfileImportError,
    ProfileImportService,
    ProfileImportView,
    redacted_context_excerpt,
)

router = APIRouter(prefix="/profile-imports", tags=["profile imports"])


def get_malware_scanner(request: Request) -> MalwareScanner:
    configured = getattr(request.app.state, "malware_scanner", None)
    if configured is not None:
        return cast(MalwareScanner, configured)
    settings = get_settings()
    if settings.malware_scanner == "clamav":
        return ClamAvTcpScanner(
            settings.clamav_host,
            settings.clamav_port,
            timeout_seconds=settings.clamav_timeout_seconds,
        )
    return UnavailableMalwareScanner()


Scanner = Annotated[MalwareScanner, Depends(get_malware_scanner)]


def get_document_extractor(request: Request) -> DocumentExtractor:
    configured = getattr(request.app.state, "document_extractor", None)
    if configured is not None:
        return cast(DocumentExtractor, configured)
    settings = get_settings()
    if settings.ocr_engine == "tesseract":
        return DocumentExtractor(
            TesseractOcrExtractor(settings.tesseract_executable, settings.ocr_timeout_seconds)
        )
    return DocumentExtractor()


Extractor = Annotated[DocumentExtractor, Depends(get_document_extractor)]


async def get_profile_import_ai_gateway(request: Request, db: DbSession) -> AiGateway:
    configured = getattr(request.app.state, "profile_import_ai_gateway", None)
    if configured is not None:
        return cast(AiGateway, configured)
    database_provider = await db.scalar(select(AiConnection.provider).limit(1))
    if database_provider is None and not os.getenv("CAREERMATE_AI_API_KEY"):
        return unavailable_profile_import_ai_gateway()
    from app.ai.shared_provider import SharedProfileProvider

    return AiGateway(
        {"v2": SharedProfileProvider(db)},
        default_provider="v2",
        prompt_version="profile-import-v2-shared",
        schema_version="profile-import-v1",
    )


ProfileImportAi = Annotated[AiGateway, Depends(get_profile_import_ai_gateway)]


def get_apply_failure_injector() -> ApplyFailureInjector:
    return ApplyFailureInjector()


ApplyInjector = Annotated[ApplyFailureInjector, Depends(get_apply_failure_injector)]


def _read(view: ProfileImportView) -> ProfileImportRead:
    item = view.profile_import
    return ProfileImportRead(
        id=item.id,
        status=item.status,
        file_name=view.document.original_filename,
        mime_type=view.document.mime_type,
        size_bytes=view.document.byte_size,
        sha256=view.document.sha256,
        version=item.version,
        proposal_version=item.proposal_version,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _proposal_read(view: ProfileImportDetailView) -> ProfileProposalRead | None:
    if view.proposal is None or view.proposed_value is None:
        return None
    return ProfileProposalRead(
        id=view.proposal.id,
        version=view.proposal.version,
        items=[
            ProfileProposalItemRead(
                proposal_item_id=view.proposed_value.id,
                field=view.proposed_value.field_name,
                value=view.proposed_value.value,
                support_status=SupportStatus(view.proposed_value.support_status),
                evidence_refs=[
                    ProfileEvidenceRead(
                        source_id=evidence.source_document_id,
                        source_version_id=evidence.source_version_id,
                        block_id=evidence.source_block_id,
                        char_start=evidence.char_start,
                        char_end=evidence.char_end,
                        quote=evidence.quote,
                        quote_sha256=evidence.quote_sha256,
                        page_number=evidence.page_number,
                        sheet_name=evidence.sheet_name,
                        context=redacted_context_excerpt(
                            view.evidence_contexts.get(evidence.source_block_id, ""),
                            evidence.char_start,
                            evidence.char_end,
                        ),
                    )
                    for evidence in view.evidence_refs
                ],
            )
        ],
    )


def _conflict_response(error: ProfileImportError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content=ProfileConflictRead(
            detail=error.detail,
            current_profile_version=error.current_profile_version,
            current_proposal_version=error.current_proposal_version,
        ).model_dump(mode="json", by_alias=True),
    )


@router.get("", response_model=ProfileImportList, response_model_by_alias=True)
async def list_profile_imports(
    current_user: CurrentUser,
    db: DbSession,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(alias="pageSize", ge=1, le=100)] = 20,
) -> ProfileImportList:
    try:
        views, total = await ProfileImportService(db, UnavailableMalwareScanner()).list_for_owner(
            current_user, page=page, page_size=page_size
        )
    except ProfileImportError as error:
        raise HTTPException(status_code=error.status_code, detail=error.detail) from error
    return ProfileImportList(
        items=[_read(view) for view in views], total=total, page=page, page_size=page_size
    )


@router.get("/{import_id}", response_model=ProfileImportDetailRead, response_model_by_alias=True)
async def get_profile_import(
    import_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> ProfileImportDetailRead:
    try:
        view = await ProfileImportService(db, UnavailableMalwareScanner()).get_detail(
            current_user, import_id
        )
    except ProfileImportError as error:
        raise HTTPException(status_code=error.status_code, detail=error.detail) from error
    base = _read(ProfileImportView(view.profile_import, view.document))
    return ProfileImportDetailRead(
        **base.model_dump(),
        profile_version=view.profile_version,
        ai_status=(
            AiStatus(view.profile_import.last_ai_status)
            if view.profile_import.last_ai_status is not None
            else None
        ),
        clarification_questions=list(view.profile_import.last_clarification_questions),
        warnings=list(view.profile_import.last_ai_warnings),
        trace_id=view.profile_import.last_ai_trace_id,
        prompt_version=view.profile_import.last_prompt_version,
        schema_version=view.profile_import.last_schema_version,
        model=view.profile_import.last_ai_model,
        proposal=_proposal_read(view),
    )


@router.delete(
    "/{import_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={status.HTTP_409_CONFLICT: {"model": ProfileConflictRead}},
)
async def delete_profile_import(
    import_id: uuid.UUID, request: Request, current_user: CurrentUser, db: DbSession
) -> Response:
    try:
        await ProfileImportService(db, UnavailableMalwareScanner()).delete_before_apply(
            current_user, import_id, getattr(request.state, "request_id", None)
        )
    except ProfileImportError as error:
        if error.status_code == status.HTTP_409_CONFLICT:
            return _conflict_response(error)
        raise HTTPException(status_code=error.status_code, detail=error.detail) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "",
    response_model=ProfileImportRead,
    response_model_by_alias=True,
    status_code=status.HTTP_201_CREATED,
)
async def create_profile_import(
    file: Annotated[UploadFile, File()],
    current_user: CurrentUser,
    db: DbSession,
    scanner: Scanner,
    extractor: Extractor,
    response: Response,
) -> ProfileImportRead:
    try:
        view, created = await ProfileImportService(db, scanner, extractor).intake_document(
            current_user, file
        )
    except ProfileImportError as error:
        raise HTTPException(status_code=error.status_code, detail=error.detail) from error
    if not created:
        response.status_code = status.HTTP_200_OK
    return _read(view)


@router.post(
    "/{import_id}/parse",
    response_model=ProfileImportParseRead,
    response_model_by_alias=True,
    status_code=status.HTTP_200_OK,
    responses={status.HTTP_409_CONFLICT: {"model": ProfileConflictRead}},
)
async def parse_profile_import(
    import_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
    scanner: Scanner,
    gateway: ProfileImportAi,
) -> ProfileImportParseRead | JSONResponse:
    try:
        view = await ProfileImportService(db, scanner).parse_job_title(
            current_user, import_id, gateway
        )
    except ProfileImportError as error:
        if error.status_code == status.HTTP_409_CONFLICT:
            return _conflict_response(error)
        raise HTTPException(status_code=error.status_code, detail=error.detail) from error
    return ProfileImportParseRead(
        id=view.profile_import.id,
        status=view.profile_import.status,
        proposal_version=view.profile_import.proposal_version,
        profile_version=view.profile_version,
        ai_status=view.ai_result.status,
        clarification_questions=list(view.ai_result.clarification_questions),
        warnings=list(view.ai_result.warnings),
        trace_id=view.ai_result.trace_id,
        prompt_version=view.ai_result.prompt_version,
        schema_version=view.ai_result.schema_version,
        model=view.ai_result.model,
        proposal=(
            ProfileProposalRead(
                id=view.proposal.id,
                version=view.proposal.version,
                items=[
                    ProfileProposalItemRead(
                        proposal_item_id=view.proposed_value.id,
                        field=view.proposed_value.field_name,
                        value=view.proposed_value.value,
                        support_status=SupportStatus(view.proposed_value.support_status),
                        evidence_refs=[
                            ProfileEvidenceRead(
                                source_id=evidence.source_document_id,
                                source_version_id=evidence.source_version_id,
                                block_id=evidence.source_block_id,
                                char_start=evidence.char_start,
                                char_end=evidence.char_end,
                                quote=evidence.quote,
                                quote_sha256=evidence.quote_sha256,
                                page_number=evidence.page_number,
                                sheet_name=evidence.sheet_name,
                                context=redacted_context_excerpt(
                                    view.evidence_contexts.get(evidence.source_block_id, ""),
                                    evidence.char_start,
                                    evidence.char_end,
                                ),
                            )
                            for evidence in view.evidence_refs
                        ],
                    )
                ],
            )
            if view.proposal is not None and view.proposed_value is not None
            else None
        ),
    )


@router.post(
    "/{import_id}/apply",
    response_model=ProfileApplyRead,
    response_model_by_alias=True,
    responses={status.HTTP_409_CONFLICT: {"model": ProfileConflictRead}},
)
async def apply_profile_import(
    import_id: uuid.UUID,
    payload: ProfileApplyRequest,
    request: Request,
    current_user: CurrentUser,
    db: DbSession,
    scanner: Scanner,
    failure_injector: ApplyInjector,
    idempotency_key: Annotated[str, Header(alias="Idempotency-Key")],
) -> ProfileApplyRead | JSONResponse:
    try:
        result = await ProfileImportService(db, scanner).apply_job_title(
            current_user,
            import_id,
            payload,
            idempotency_key,
            failure_injector,
            getattr(request.state, "request_id", None),
        )
    except ProfileImportError as error:
        if error.status_code == status.HTTP_409_CONFLICT:
            return _conflict_response(error)
        raise HTTPException(status_code=error.status_code, detail=error.detail) from error
    return ProfileApplyRead(
        command_id=result.command_id,
        status=result.status,
        created_entity_ids=[],
        skipped_item_ids=[],
        profile_version=result.profile_version,
    )
