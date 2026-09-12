import uuid
from collections.abc import Sequence

from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.sql.elements import ColumnElement

from app.domain.enums import CompanyStatus, Role
from app.domain.models import Company, Employment, User
from app.repositories.base import BaseRepository
from app.security.roles import EMPLOYEE_ROLES


class UserRepository(BaseRepository[User]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, User)

    async def get_by_id(self, user_id: uuid.UUID) -> User | None:
        result = await self.session.execute(
            select(User).options(selectinload(User.company)).where(User.id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_by_email(self, normalized_email: str) -> User | None:
        result = await self.session.execute(
            select(User)
            .options(selectinload(User.company))
            .where(func.lower(User.email) == normalized_email)
        )
        return result.scalar_one_or_none()

    async def get_in_company(self, user_id: uuid.UUID, company_id: uuid.UUID) -> User | None:
        result = await self.session.execute(
            select(User).where(User.id == user_id, User.company_id == company_id)
        )
        return result.scalar_one_or_none()

    async def list_by_company(self, company_id: uuid.UUID) -> Sequence[User]:
        result = await self.session.execute(
            select(User).where(User.company_id == company_id).order_by(User.email)
        )
        return result.scalars().all()

    def _roster_filters(
        self,
        company_id: uuid.UUID,
        *,
        query: str | None,
        active: bool | None,
        roles: Sequence[Role] = EMPLOYEE_ROLES,
    ) -> list[ColumnElement[bool]]:
        filters = [User.company_id == company_id, User.role.in_(roles)]
        if active is not None:
            filters.append(User.is_active.is_(active))
        if query:
            escaped = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            pattern = f"%{escaped}%"
            filters.append(
                or_(
                    User.name.ilike(pattern, escape="\\"),
                    User.job_title.ilike(pattern, escape="\\"),
                )
            )
        return filters

    async def count_roster(
        self,
        company_id: uuid.UUID,
        *,
        query: str | None,
        active: bool | None,
        roles: Sequence[Role] = EMPLOYEE_ROLES,
    ) -> int:
        result = await self.session.scalar(
            select(func.count())
            .select_from(User)
            .where(*self._roster_filters(company_id, query=query, active=active, roles=roles))
        )
        return int(result or 0)

    async def list_roster(
        self,
        company_id: uuid.UUID,
        *,
        query: str | None,
        active: bool | None,
        offset: int,
        limit: int,
        roles: Sequence[Role] = EMPLOYEE_ROLES,
    ) -> Sequence[User]:
        result = await self.session.execute(
            select(User)
            .where(*self._roster_filters(company_id, query=query, active=active, roles=roles))
            .order_by(func.lower(User.name), User.id)
            .offset(offset)
            .limit(limit)
        )
        return result.scalars().all()

    async def get_roster_person(
        self, user_id: uuid.UUID, company_id: uuid.UUID, *, roles: Sequence[Role] = EMPLOYEE_ROLES
    ) -> User | None:
        result = await self.session.execute(
            select(User).where(
                User.id == user_id,
                User.company_id == company_id,
                User.role.in_(roles),
            )
        )
        return result.scalar_one_or_none()

    async def update_profile_if_version(
        self,
        user_id: uuid.UUID,
        expected_version: int,
        values: dict[str, object],
    ) -> User | None:
        result = await self.session.execute(
            update(User)
            .where(User.id == user_id, User.version == expected_version)
            .values(**values, version=User.version + 1, updated_at=func.now())
            .returning(User)
        )
        return result.scalar_one_or_none()


class CompanyRepository(BaseRepository[Company]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Company)

    async def get_by_id(self, company_id: uuid.UUID) -> Company | None:
        return await self.session.get(Company, company_id)

    async def get_by_name(self, name: str) -> Company | None:
        result = await self.session.execute(select(Company).where(Company.name == name))
        return result.scalar_one_or_none()

    async def list_active_options(self) -> Sequence[Company]:
        result = await self.session.execute(
            select(Company)
            .where(Company.status == CompanyStatus.ACTIVE)
            .order_by(func.lower(Company.name), Company.id)
        )
        return result.scalars().all()


class EmploymentRepository(BaseRepository[Employment]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Employment)

    async def list_for_user_in_company(
        self, user_id: uuid.UUID, company_id: uuid.UUID
    ) -> Sequence[Employment]:
        result = await self.session.execute(
            select(Employment).where(
                Employment.user_id == user_id, Employment.company_id == company_id
            )
        )
        return result.scalars().all()
