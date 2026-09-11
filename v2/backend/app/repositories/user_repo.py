import uuid
from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domain.models import Company, Employment, User
from app.repositories.base import BaseRepository


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


class CompanyRepository(BaseRepository[Company]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Company)

    async def get_by_id(self, company_id: uuid.UUID) -> Company | None:
        return await self.session.get(Company, company_id)

    async def get_by_name(self, name: str) -> Company | None:
        result = await self.session.execute(select(Company).where(Company.name == name))
        return result.scalar_one_or_none()


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
