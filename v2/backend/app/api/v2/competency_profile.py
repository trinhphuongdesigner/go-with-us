from __future__ import annotations

import uuid
from datetime import UTC
from typing import Annotated, Any, cast

from fastapi import APIRouter, HTTPException, Query, Request
from starlette.responses import JSONResponse, Response

from app.api.v2.dependencies import CurrentUser, DbSession
from app.domain.competency_schemas import (
    AwardCreate,
    AwardPatch,
    AwardRead,
    CertificationCreate,
    CertificationPatch,
    CertificationRead,
    CompetencyProfileRead,
    CompetencyUserRead,
    EmployeeSkillRead,
    EmploymentRead,
    ExperienceCreate,
    ExperiencePatch,
    ExperienceRead,
    ProfileResourceConflictRead,
    ProjectCreate,
    ProjectPatch,
    ProjectRead,
    ResourceListRead,
    TimelineItemRead,
    VersionedCommand,
)
from app.domain.enums import ProfileTimelineKind
from app.domain.models import Certification, EmployeeSkill, Experience, Project
from app.services.competency_profile_service import (
    CompetencyDenied,
    CompetencyInvalid,
    CompetencyNotFound,
    CompetencyProfileService,
    CompetencyVersionConflict,
    Resource,
    ResourceKind,
)

router = APIRouter(prefix="/competency-profile", tags=["competency profile"])
ResourceRead = ExperienceRead | ProjectRead | CertificationRead | AwardRead


def _request_id(request: Request) -> str | None:
    return getattr(request.state, "request_id", None)


def _raise_service_error(error: Exception) -> None:
    if isinstance(error, CompetencyNotFound):
        raise HTTPException(status_code=404, detail="Không tìm thấy tài nguyên hồ sơ") from error
    if isinstance(error, CompetencyDenied):
        raise HTTPException(
            status_code=403, detail="Bạn không có quyền thực hiện thao tác này"
        ) from error
    if isinstance(error, CompetencyInvalid):
        raise HTTPException(status_code=422, detail=str(error)) from error
    raise error


def _conflict(error: CompetencyVersionConflict) -> JSONResponse:
    body = ProfileResourceConflictRead(
        detail="Phiên hồ sơ đã thay đổi", current_profile_version=error.current_version
    )
    return JSONResponse(status_code=409, content=body.model_dump(by_alias=True, mode="json"))


def employee_skill_read(item: EmployeeSkill) -> EmployeeSkillRead:
    return EmployeeSkillRead(
        id=item.id,
        skill_id=item.skill_id,
        name=item.skill.name,
        category=item.skill.category,
        rating=item.rating,
        note=item.note,
        self_assessed=item.self_assessed,
        source_type=item.source_type,
        source_import_id=item.source_import_id,
        proposal_item_id=item.proposal_item_id,
        created_by=item.created_by,
        updated_by=item.updated_by,
        version=item.version,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def resource_read(item: Resource) -> ResourceRead:
    if isinstance(item, Experience):
        return ExperienceRead.model_validate(item)
    if isinstance(item, Project):
        return ProjectRead.model_validate(item)
    if isinstance(item, Certification):
        return CertificationRead.model_validate(item)
    return AwardRead.model_validate(item)


async def _list(
    kind: ResourceKind, db: DbSession, actor: CurrentUser, user_id: uuid.UUID | None
) -> ResourceListRead:
    try:
        target, items = await CompetencyProfileService(db).list_resources(kind, actor, user_id)
    except (CompetencyNotFound, CompetencyDenied, CompetencyInvalid) as error:
        _raise_service_error(error)
    return ResourceListRead(
        items=[resource_read(item) for item in items], profile_version=target.version
    )


async def _create(
    kind: ResourceKind,
    payload: Any,
    request: Request,
    db: DbSession,
    actor: CurrentUser,
    user_id: uuid.UUID | None,
) -> Response:
    try:
        item = await CompetencyProfileService(db).create_resource(
            kind, actor, user_id, payload, _request_id(request)
        )
    except CompetencyVersionConflict as error:
        return _conflict(error)
    except (CompetencyNotFound, CompetencyDenied, CompetencyInvalid) as error:
        _raise_service_error(error)
    return JSONResponse(
        status_code=201, content=resource_read(item).model_dump(by_alias=True, mode="json")
    )


async def _get(
    kind: ResourceKind,
    resource_id: uuid.UUID,
    db: DbSession,
    actor: CurrentUser,
    user_id: uuid.UUID | None,
) -> ResourceRead:
    try:
        item = await CompetencyProfileService(db).get_resource(kind, resource_id, actor, user_id)
    except (CompetencyNotFound, CompetencyDenied, CompetencyInvalid) as error:
        _raise_service_error(error)
    return resource_read(item)


async def _update(
    kind: ResourceKind,
    resource_id: uuid.UUID,
    payload: Any,
    request: Request,
    db: DbSession,
    actor: CurrentUser,
    user_id: uuid.UUID | None,
) -> Response:
    try:
        item = await CompetencyProfileService(db).update_resource(
            kind, resource_id, actor, user_id, payload, _request_id(request)
        )
    except CompetencyVersionConflict as error:
        return _conflict(error)
    except (CompetencyNotFound, CompetencyDenied, CompetencyInvalid) as error:
        _raise_service_error(error)
    return JSONResponse(content=resource_read(item).model_dump(by_alias=True, mode="json"))


async def _delete(
    kind: ResourceKind,
    resource_id: uuid.UUID,
    payload: VersionedCommand,
    request: Request,
    db: DbSession,
    actor: CurrentUser,
    user_id: uuid.UUID | None,
) -> Response:
    try:
        await CompetencyProfileService(db).delete_resource(
            kind, resource_id, actor, user_id, payload.profile_version, _request_id(request)
        )
    except CompetencyVersionConflict as error:
        return _conflict(error)
    except (CompetencyNotFound, CompetencyDenied, CompetencyInvalid) as error:
        _raise_service_error(error)
    return Response(status_code=204)


@router.get(
    "",
    response_model=CompetencyProfileRead,
    description="Returns 422 when any profile collection exceeds the supported 200 items.",
)
async def get_competency_profile(
    db: DbSession,
    actor: CurrentUser,
    user_id: Annotated[uuid.UUID | None, Query(alias="userId")] = None,
) -> CompetencyProfileRead:
    try:
        view = await CompetencyProfileService(db).aggregate(actor, user_id)
    except (CompetencyNotFound, CompetencyDenied, CompetencyInvalid) as error:
        _raise_service_error(error)
    timeline: list[TimelineItemRead] = []
    for employment in view.employments:
        timeline.append(
            TimelineItemRead(
                id=employment.id,
                kind=ProfileTimelineKind.EMPLOYMENT,
                title=employment.title,
                subtitle="Kỳ làm việc",
                start_date=employment.start_date.astimezone(UTC).date(),
                end_date=employment.end_date.astimezone(UTC).date()
                if employment.end_date
                else None,
                source_type=None,
            )
        )
    for experience in view.experiences:
        if experience.start_date:
            timeline.append(
                TimelineItemRead(
                    id=experience.id,
                    kind=ProfileTimelineKind.EXPERIENCE,
                    title=experience.title,
                    subtitle=experience.organization,
                    start_date=experience.start_date,
                    end_date=experience.end_date,
                    source_type=experience.source_type,
                )
            )
    for project in view.projects:
        if project.start_date:
            timeline.append(
                TimelineItemRead(
                    id=project.id,
                    kind=ProfileTimelineKind.PROJECT,
                    title=project.name,
                    subtitle=project.role,
                    start_date=project.start_date,
                    end_date=project.end_date,
                    source_type=project.source_type,
                )
            )
    for certification in view.certifications:
        if certification.issued_at:
            timeline.append(
                TimelineItemRead(
                    id=certification.id,
                    kind=ProfileTimelineKind.CERTIFICATION,
                    title=certification.name,
                    subtitle=certification.issuer,
                    start_date=certification.issued_at,
                    end_date=certification.expires_at,
                    source_type=certification.source_type,
                )
            )
    for award in view.awards:
        if award.awarded_at:
            timeline.append(
                TimelineItemRead(
                    id=award.id,
                    kind=ProfileTimelineKind.AWARD,
                    title=award.name,
                    subtitle=award.issuer,
                    start_date=award.awarded_at,
                    end_date=None,
                    source_type=award.source_type,
                )
            )
    timeline.sort(key=lambda item: (-item.start_date.toordinal(), item.kind.value, str(item.id)))
    return CompetencyProfileRead(
        user=CompetencyUserRead(
            id=view.user.id, name=view.user.name, job_title=view.user.job_title
        ),
        skills=[employee_skill_read(item) for item in view.skills],
        experiences=[cast(ExperienceRead, resource_read(item)) for item in view.experiences],
        projects=[cast(ProjectRead, resource_read(item)) for item in view.projects],
        certifications=[
            cast(CertificationRead, resource_read(item)) for item in view.certifications
        ],
        awards=[cast(AwardRead, resource_read(item)) for item in view.awards],
        employments=[
            EmploymentRead(
                id=item.id, title=item.title, start_date=item.start_date, end_date=item.end_date
            )
            for item in view.employments
        ],
        timeline=timeline,
        version=view.user.version,
    )


@router.get("/experiences", response_model=ResourceListRead, description="Capped at 200 items.")
async def list_experiences(
    db: DbSession,
    actor: CurrentUser,
    user_id: Annotated[uuid.UUID | None, Query(alias="userId")] = None,
) -> ResourceListRead:
    return await _list("experience", db, actor, user_id)


@router.post(
    "/experiences",
    response_model=ExperienceRead,
    status_code=201,
    responses={409: {"model": ProfileResourceConflictRead}},
)
async def create_experience(
    payload: ExperienceCreate,
    request: Request,
    db: DbSession,
    actor: CurrentUser,
    user_id: Annotated[uuid.UUID | None, Query(alias="userId")] = None,
) -> Response:
    return await _create("experience", payload, request, db, actor, user_id)


@router.get("/experiences/{resource_id}", response_model=ExperienceRead)
async def get_experience(
    resource_id: uuid.UUID,
    db: DbSession,
    actor: CurrentUser,
    user_id: Annotated[uuid.UUID | None, Query(alias="userId")] = None,
) -> ResourceRead:
    return await _get("experience", resource_id, db, actor, user_id)


@router.patch(
    "/experiences/{resource_id}",
    response_model=ExperienceRead,
    responses={409: {"model": ProfileResourceConflictRead}},
)
async def update_experience(
    resource_id: uuid.UUID,
    payload: ExperiencePatch,
    request: Request,
    db: DbSession,
    actor: CurrentUser,
    user_id: Annotated[uuid.UUID | None, Query(alias="userId")] = None,
) -> Response:
    return await _update("experience", resource_id, payload, request, db, actor, user_id)


@router.delete(
    "/experiences/{resource_id}",
    status_code=204,
    response_model=None,
    responses={409: {"model": ProfileResourceConflictRead}},
)
async def delete_experience(
    resource_id: uuid.UUID,
    payload: VersionedCommand,
    request: Request,
    db: DbSession,
    actor: CurrentUser,
    user_id: Annotated[uuid.UUID | None, Query(alias="userId")] = None,
) -> Response:
    return await _delete("experience", resource_id, payload, request, db, actor, user_id)


@router.get("/projects", response_model=ResourceListRead, description="Capped at 200 items.")
async def list_projects(
    db: DbSession,
    actor: CurrentUser,
    user_id: Annotated[uuid.UUID | None, Query(alias="userId")] = None,
) -> ResourceListRead:
    return await _list("project", db, actor, user_id)


@router.post(
    "/projects",
    response_model=ProjectRead,
    status_code=201,
    responses={409: {"model": ProfileResourceConflictRead}},
)
async def create_project(
    payload: ProjectCreate,
    request: Request,
    db: DbSession,
    actor: CurrentUser,
    user_id: Annotated[uuid.UUID | None, Query(alias="userId")] = None,
) -> Response:
    return await _create("project", payload, request, db, actor, user_id)


@router.get("/projects/{resource_id}", response_model=ProjectRead)
async def get_project(
    resource_id: uuid.UUID,
    db: DbSession,
    actor: CurrentUser,
    user_id: Annotated[uuid.UUID | None, Query(alias="userId")] = None,
) -> ResourceRead:
    return await _get("project", resource_id, db, actor, user_id)


@router.patch(
    "/projects/{resource_id}",
    response_model=ProjectRead,
    responses={409: {"model": ProfileResourceConflictRead}},
)
async def update_project(
    resource_id: uuid.UUID,
    payload: ProjectPatch,
    request: Request,
    db: DbSession,
    actor: CurrentUser,
    user_id: Annotated[uuid.UUID | None, Query(alias="userId")] = None,
) -> Response:
    return await _update("project", resource_id, payload, request, db, actor, user_id)


@router.delete(
    "/projects/{resource_id}",
    status_code=204,
    response_model=None,
    responses={409: {"model": ProfileResourceConflictRead}},
)
async def delete_project(
    resource_id: uuid.UUID,
    payload: VersionedCommand,
    request: Request,
    db: DbSession,
    actor: CurrentUser,
    user_id: Annotated[uuid.UUID | None, Query(alias="userId")] = None,
) -> Response:
    return await _delete("project", resource_id, payload, request, db, actor, user_id)


@router.get("/certifications", response_model=ResourceListRead, description="Capped at 200 items.")
async def list_certifications(
    db: DbSession,
    actor: CurrentUser,
    user_id: Annotated[uuid.UUID | None, Query(alias="userId")] = None,
) -> ResourceListRead:
    return await _list("certification", db, actor, user_id)


@router.post(
    "/certifications",
    response_model=CertificationRead,
    status_code=201,
    responses={409: {"model": ProfileResourceConflictRead}},
)
async def create_certification(
    payload: CertificationCreate,
    request: Request,
    db: DbSession,
    actor: CurrentUser,
    user_id: Annotated[uuid.UUID | None, Query(alias="userId")] = None,
) -> Response:
    return await _create("certification", payload, request, db, actor, user_id)


@router.get("/certifications/{resource_id}", response_model=CertificationRead)
async def get_certification(
    resource_id: uuid.UUID,
    db: DbSession,
    actor: CurrentUser,
    user_id: Annotated[uuid.UUID | None, Query(alias="userId")] = None,
) -> ResourceRead:
    return await _get("certification", resource_id, db, actor, user_id)


@router.patch(
    "/certifications/{resource_id}",
    response_model=CertificationRead,
    responses={409: {"model": ProfileResourceConflictRead}},
)
async def update_certification(
    resource_id: uuid.UUID,
    payload: CertificationPatch,
    request: Request,
    db: DbSession,
    actor: CurrentUser,
    user_id: Annotated[uuid.UUID | None, Query(alias="userId")] = None,
) -> Response:
    return await _update("certification", resource_id, payload, request, db, actor, user_id)


@router.delete(
    "/certifications/{resource_id}",
    status_code=204,
    response_model=None,
    responses={409: {"model": ProfileResourceConflictRead}},
)
async def delete_certification(
    resource_id: uuid.UUID,
    payload: VersionedCommand,
    request: Request,
    db: DbSession,
    actor: CurrentUser,
    user_id: Annotated[uuid.UUID | None, Query(alias="userId")] = None,
) -> Response:
    return await _delete("certification", resource_id, payload, request, db, actor, user_id)


@router.get("/awards", response_model=ResourceListRead, description="Capped at 200 items.")
async def list_awards(
    db: DbSession,
    actor: CurrentUser,
    user_id: Annotated[uuid.UUID | None, Query(alias="userId")] = None,
) -> ResourceListRead:
    return await _list("award", db, actor, user_id)


@router.post(
    "/awards",
    response_model=AwardRead,
    status_code=201,
    responses={409: {"model": ProfileResourceConflictRead}},
)
async def create_award(
    payload: AwardCreate,
    request: Request,
    db: DbSession,
    actor: CurrentUser,
    user_id: Annotated[uuid.UUID | None, Query(alias="userId")] = None,
) -> Response:
    return await _create("award", payload, request, db, actor, user_id)


@router.get("/awards/{resource_id}", response_model=AwardRead)
async def get_award(
    resource_id: uuid.UUID,
    db: DbSession,
    actor: CurrentUser,
    user_id: Annotated[uuid.UUID | None, Query(alias="userId")] = None,
) -> ResourceRead:
    return await _get("award", resource_id, db, actor, user_id)


@router.patch(
    "/awards/{resource_id}",
    response_model=AwardRead,
    responses={409: {"model": ProfileResourceConflictRead}},
)
async def update_award(
    resource_id: uuid.UUID,
    payload: AwardPatch,
    request: Request,
    db: DbSession,
    actor: CurrentUser,
    user_id: Annotated[uuid.UUID | None, Query(alias="userId")] = None,
) -> Response:
    return await _update("award", resource_id, payload, request, db, actor, user_id)


@router.delete(
    "/awards/{resource_id}",
    status_code=204,
    response_model=None,
    responses={409: {"model": ProfileResourceConflictRead}},
)
async def delete_award(
    resource_id: uuid.UUID,
    payload: VersionedCommand,
    request: Request,
    db: DbSession,
    actor: CurrentUser,
    user_id: Annotated[uuid.UUID | None, Query(alias="userId")] = None,
) -> Response:
    return await _delete("award", resource_id, payload, request, db, actor, user_id)
