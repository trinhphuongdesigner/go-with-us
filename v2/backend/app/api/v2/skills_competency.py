from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Query, Request
from starlette.responses import JSONResponse, Response

from app.api.v2.competency_profile import (
    _conflict,
    _raise_service_error,
    _request_id,
    employee_skill_read,
)
from app.api.v2.dependencies import CurrentUser, DbSession
from app.domain.competency_schemas import (
    EmployeeSkillListRead,
    EmployeeSkillReplace,
    ProfileResourceConflictRead,
    SkillCreate,
    SkillListRead,
    SkillRead,
)
from app.services.competency_profile_service import (
    CompetencyDenied,
    CompetencyInvalid,
    CompetencyNotFound,
    CompetencyProfileService,
    CompetencyVersionConflict,
)

router = APIRouter(prefix="/skills-competency", tags=["skills competency"])


@router.get("/skills", response_model=SkillListRead, description="Paginated skill catalog.")
async def list_skills(
    db: DbSession,
    actor: CurrentUser,
    page: Annotated[int, Query(ge=1, le=10_000)] = 1,
    page_size: Annotated[int, Query(alias="pageSize", ge=1, le=200)] = 50,
) -> SkillListRead:
    del actor
    items, total = await CompetencyProfileService(db).list_skills(page, page_size)
    return SkillListRead(
        items=[SkillRead(id=item.id, name=item.name, category=item.category) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/skills", response_model=SkillRead)
async def create_skill(
    payload: SkillCreate, request: Request, db: DbSession, actor: CurrentUser
) -> SkillRead:
    item = await CompetencyProfileService(db).create_skill(
        actor, payload.name, payload.category, _request_id(request)
    )
    return SkillRead(id=item.id, name=item.name, category=item.category)


@router.get(
    "/users/{user_id}",
    response_model=EmployeeSkillListRead,
    description="Capped at 200 items.",
)
async def get_employee_skills(
    user_id: uuid.UUID, db: DbSession, actor: CurrentUser
) -> EmployeeSkillListRead:
    try:
        target, items = await CompetencyProfileService(db).list_employee_skills(actor, user_id)
    except (CompetencyNotFound, CompetencyDenied, CompetencyInvalid) as error:
        _raise_service_error(error)
    return EmployeeSkillListRead(
        items=[employee_skill_read(item) for item in items], profile_version=target.version
    )


@router.put(
    "/users/{user_id}/skills",
    response_model=EmployeeSkillListRead,
    responses={409: {"model": ProfileResourceConflictRead}},
)
async def replace_employee_skills(
    user_id: uuid.UUID,
    payload: EmployeeSkillReplace,
    request: Request,
    db: DbSession,
    actor: CurrentUser,
) -> Response:
    try:
        profile_version, items = await CompetencyProfileService(db).replace_employee_skills(
            actor, user_id, payload, _request_id(request)
        )
    except CompetencyVersionConflict as error:
        return _conflict(error)
    except (CompetencyNotFound, CompetencyDenied, CompetencyInvalid) as error:
        _raise_service_error(error)
    body = EmployeeSkillListRead(
        items=[employee_skill_read(item) for item in items], profile_version=profile_version
    )
    return JSONResponse(content=body.model_dump(by_alias=True, mode="json"))
