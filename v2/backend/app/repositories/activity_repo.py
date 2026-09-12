import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models import ActivityLog
from app.repositories.base import BaseRepository


class ActivityLogRepository(BaseRepository[ActivityLog]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, ActivityLog)

    async def log(
        self,
        *,
        actor_id: uuid.UUID,
        company_id: uuid.UUID | None,
        action: str,
        entity_type: str,
        entity_id: str,
        changes: dict[str, Any] | None = None,
        request_id: str | None = None,
    ) -> ActivityLog:
        return await self.add(
            ActivityLog(
                actor_id=actor_id,
                company_id=company_id,
                action=action,
                entity_type=entity_type,
                entity_id=entity_id,
                request_id=request_id,
                changes=changes or {},
            )
        )
