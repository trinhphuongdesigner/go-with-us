from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import DeclarativeBase


class BaseRepository[T: DeclarativeBase]:
    def __init__(self, session: AsyncSession, model: type[T]) -> None:
        self.session = session
        self.model = model

    async def add(self, entity: T) -> T:
        self.session.add(entity)
        await self.session.flush()
        return entity
