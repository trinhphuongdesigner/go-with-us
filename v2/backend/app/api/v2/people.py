import uuid
from typing import Annotated, NoReturn
from unicodedata import normalize

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.v2.dependencies import DbSession, require_permission
from app.domain.enums import Permission
from app.domain.models import User
from app.domain.profile_schemas import (
    RosterPageRead,
    RosterPersonDetailRead,
    RosterPersonRead,
)
from app.services.profile_service import (
    ProfileService,
    RosterCompanyNotFound,
    RosterPersonNotFound,
    RosterScopeRequired,
    RosterTenantDenied,
)

router = APIRouter(prefix="/people", tags=["people"])
PeopleActor = Annotated[User, Depends(require_permission(Permission.PEOPLE_READ))]
CompanyQuery = Annotated[uuid.UUID | None, Query(alias="companyId")]
SearchQuery = Annotated[str | None, Query(max_length=100)]
ActiveQuery = Annotated[bool | None, Query()]
PageQuery = Annotated[int, Query(ge=1)]
PageSizeQuery = Annotated[int, Query(alias="pageSize", ge=1, le=100)]


def roster_person(user: User) -> RosterPersonRead:
    return RosterPersonRead(
        id=user.id,
        name=user.name,
        job_title=user.job_title,
        is_active=user.is_active,
        profile_version=user.version,
        updated_at=user.updated_at,
    )


def raise_roster_error(error: Exception) -> NoReturn:
    if isinstance(error, RosterScopeRequired):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="companyId là bắt buộc với quản trị viên nền tảng",
        ) from error
    if isinstance(error, RosterTenantDenied):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Không thể truy cập doanh nghiệp này",
        ) from error
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy nhân sự"
    ) from error


@router.get("", response_model=RosterPageRead)
async def list_people(
    db: DbSession,
    actor: PeopleActor,
    company_id: CompanyQuery = None,
    q: SearchQuery = None,
    active: ActiveQuery = None,
    page: PageQuery = 1,
    page_size: PageSizeQuery = 20,
) -> RosterPageRead:
    query = normalize("NFC", q).strip() if q is not None else None
    query = query or None
    try:
        users, total = await ProfileService(db).list_roster(
            actor=actor,
            requested_company_id=company_id,
            query=query,
            active=active,
            page=page,
            page_size=page_size,
        )
    except (RosterScopeRequired, RosterTenantDenied, RosterCompanyNotFound) as error:
        raise_roster_error(error)
    return RosterPageRead(
        items=[roster_person(user) for user in users],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{employee_id}", response_model=RosterPersonDetailRead)
async def get_person(
    employee_id: uuid.UUID,
    db: DbSession,
    actor: PeopleActor,
    company_id: CompanyQuery = None,
) -> RosterPersonDetailRead:
    try:
        user = await ProfileService(db).get_roster_person(
            actor=actor,
            requested_company_id=company_id,
            user_id=employee_id,
        )
    except (
        RosterScopeRequired,
        RosterTenantDenied,
        RosterCompanyNotFound,
        RosterPersonNotFound,
    ) as error:
        raise_roster_error(error)
    if user.company_id is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy nhân sự")
    return RosterPersonDetailRead(
        **roster_person(user).model_dump(),
        company_id=user.company_id,
    )
