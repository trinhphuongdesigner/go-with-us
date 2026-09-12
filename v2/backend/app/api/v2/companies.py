from fastapi import APIRouter, status
from sqlalchemy import select

from app.api.v2.dependencies import CurrentUser, DbSession
from app.domain.enums import CompanyStatus, Role
from app.domain.models import Company
from app.domain.profile_schemas import CompanyOptionListRead, CompanyOptionRead, ErrorDetailRead
from app.repositories.user_repo import CompanyRepository

router = APIRouter(prefix="/companies", tags=["companies"])


@router.get(
    "/options",
    response_model=CompanyOptionListRead,
    responses={
        status.HTTP_401_UNAUTHORIZED: {"model": ErrorDetailRead},
        status.HTTP_403_FORBIDDEN: {"model": ErrorDetailRead},
    },
)
async def list_company_options(db: DbSession, actor: CurrentUser) -> CompanyOptionListRead:
    if actor.role == Role.SUPER_ADMIN:
        companies = await CompanyRepository(db).list_active_options()
    else:
        from app.company_memberships import CompanyMembership

        companies = (
            await db.scalars(
                select(Company)
                .join(CompanyMembership, CompanyMembership.company_id == Company.id)
                .where(
                    CompanyMembership.user_id == actor.id, Company.status == CompanyStatus.ACTIVE
                )
                .order_by(Company.name, Company.id)
            )
        ).all()
    return CompanyOptionListRead(
        items=[CompanyOptionRead(id=company.id, name=company.name) for company in companies]
    )
