from typing import Annotated

from fastapi import APIRouter, Depends, Request, status
from starlette.responses import JSONResponse, Response

from app.api.v2.dependencies import DbSession, require_permission
from app.domain.enums import Permission
from app.domain.models import User
from app.domain.profile_schemas import CoreProfileConflictRead, ProfilePatch, ProfileRead
from app.services.profile_service import ProfileService, ProfileVersionConflict

router = APIRouter(prefix="/profile", tags=["profile"])
ProfileActor = Annotated[User, Depends(require_permission(Permission.PROFILE_SELF))]


def profile_read(user: User) -> ProfileRead:
    return ProfileRead(
        id=user.id,
        email=user.email,
        name=user.name,
        job_title=user.job_title,
        role=user.role,
        company_id=user.company_id,
        company_name=user.company.name if user.company else None,
        is_active=user.is_active,
        profile_version=user.version,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


@router.get("/me", response_model=ProfileRead)
async def get_self_profile(actor: ProfileActor) -> ProfileRead:
    return profile_read(actor)


@router.patch(
    "/me",
    response_model=ProfileRead,
    responses={status.HTTP_409_CONFLICT: {"model": CoreProfileConflictRead}},
)
async def patch_self_profile(
    payload: ProfilePatch,
    request: Request,
    db: DbSession,
    actor: ProfileActor,
) -> Response:
    try:
        updated = await ProfileService(db).update_self(
            actor=actor,
            payload=payload,
            request_id=getattr(request.state, "request_id", None),
        )
    except ProfileVersionConflict as error:
        conflict = CoreProfileConflictRead(
            detail="Hồ sơ đã được cập nhật bởi một thao tác khác",
            current_profile_version=error.current_version,
        )
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content=conflict.model_dump(by_alias=True, mode="json"),
        )
    return JSONResponse(content=profile_read(updated).model_dump(by_alias=True, mode="json"))
