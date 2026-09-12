import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models import AuthSession
from app.repositories.base import BaseRepository


class AuthSessionRepository(BaseRepository[AuthSession]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, AuthSession)

    async def get_active(self, user_id: uuid.UUID, jti_hash: str) -> AuthSession | None:
        result = await self.session.execute(
            select(AuthSession).where(
                AuthSession.user_id == user_id,
                AuthSession.jti_hash == jti_hash,
                AuthSession.revoked_at.is_(None),
                AuthSession.expires_at > func.now(),
            )
        )
        return result.scalar_one_or_none()
