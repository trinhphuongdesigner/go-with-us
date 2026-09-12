from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.api.v2.dependencies import DbSession, require_permission
from app.domain.enums import Permission
from app.domain.models import User
from app.domain.profile_schemas import CompanyOptionListRead, CompanyOptionRead, ErrorDetailRead
from app.repositories.user_repo import CompanyRepository

router = APIRouter(prefix="/companies", tags=["companies"])
PlatformActor = Annotated[User, Depends(require_permission(Permission.PLATFORM_MANAGE))]


@router.get(
    "/options",
    response_model=CompanyOptionListRead,
    responses={
        status.HTTP_401_UNAUTHORIZED: {"model": ErrorDetailRead},
        status.HTTP_403_FORBIDDEN: {"model": ErrorDetailRead},
    },
)
async def list_company_options(db: DbSession, actor: PlatformActor) -> CompanyOptionListRead:
    del actor
    companies = await CompanyRepository(db).list_active_options()
    return CompanyOptionListRead(
        items=[CompanyOptionRead(id=company.id, name=company.name) for company in companies]
    )
