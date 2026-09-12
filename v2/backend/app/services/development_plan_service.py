import hashlib
import uuid

from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.sql import Select

from app.domain.models import User, utc_now
from app.domain.roadmap_models import (
    DevelopmentMilestone,
    DevelopmentPlanSettings,
    DevelopmentRoadmap,
    DevelopmentTask,
)
from app.domain.roadmap_schemas import (
    RoadmapCategory,
    RoadmapMilestoneRead,
    RoadmapRead,
    RoadmapSave,
    RoadmapSettingsPatch,
    RoadmapSettingsRead,
    RoadmapTaskPatch,
    RoadmapTaskRead,
)


def roadmap_read(row: DevelopmentRoadmap) -> RoadmapRead:
    milestones = []
    for milestone in row.milestones:
        total = len(milestone.tasks)
        completed = sum(task.done for task in milestone.tasks)
        milestones.append(
            RoadmapMilestoneRead(
                id=milestone.id,
                title=milestone.title,
                description=milestone.description,
                due_date=milestone.due_date,
                order=milestone.order,
                status="DONE"
                if total and completed == total
                else "IN_PROGRESS"
                if completed
                else "NOT_STARTED",
                completed_tasks=completed,
                total_tasks=total,
                tasks=[RoadmapTaskRead.model_validate(task) for task in milestone.tasks],
            )
        )
    total = sum(item.total_tasks for item in milestones)
    completed = sum(item.completed_tasks for item in milestones)
    return RoadmapRead.model_validate(
        {
            "id": row.id,
            "category": row.category,
            "title": row.title,
            "duration_weeks": row.duration_weeks,
            "hours_per_week": row.hours_per_week,
            "version": row.version,
            "created_at": row.created_at,
            "updated_at": row.updated_at,
            "completed_tasks": completed,
            "total_tasks": total,
            "progress": round(100 * completed / total) if total else 0,
            "milestones": milestones,
        }
    )


class DevelopmentPlanService:
    def __init__(self, db: AsyncSession, actor: User):
        if actor.company_id is None:
            raise HTTPException(403, "Tài khoản chưa thuộc doanh nghiệp")
        self.db = db
        self.owner_id = actor.id
        self.company_id = actor.company_id

    def _roadmaps(self) -> Select[tuple[DevelopmentRoadmap]]:
        return (
            select(DevelopmentRoadmap)
            .where(
                DevelopmentRoadmap.owner_user_id == self.owner_id,
                DevelopmentRoadmap.company_id == self.company_id,
            )
            .options(
                selectinload(DevelopmentRoadmap.milestones).selectinload(DevelopmentMilestone.tasks)
            )
        )

    async def list_roadmaps(self, category: RoadmapCategory | None) -> list[RoadmapRead]:
        query = self._roadmaps()
        if category is not None:
            query = query.where(DevelopmentRoadmap.category == category)
        rows = (
            await self.db.scalars(
                query.order_by(
                    DevelopmentRoadmap.created_at.desc(),
                    DevelopmentRoadmap.id.desc(),
                )
            )
        ).all()
        return [roadmap_read(row) for row in rows]

    async def _saved_request(self, request_id: uuid.UUID, digest: str) -> RoadmapRead | None:
        row = await self.db.scalar(
            self._roadmaps().where(
                DevelopmentRoadmap.client_request_id == request_id,
            )
        )
        if row is None:
            return None
        if row.request_hash != digest:
            raise HTTPException(
                409,
                {
                    "code": "idempotency_conflict",
                    "message": "Request key was used for a different roadmap",
                },
            )
        return roadmap_read(row)

    async def save_roadmap(self, payload: RoadmapSave) -> RoadmapRead:
        digest = hashlib.sha256(
            payload.model_dump_json(exclude={"client_request_id"}).encode()
        ).hexdigest()
        existing = await self._saved_request(payload.client_request_id, digest)
        if existing is not None:
            return existing
        row = DevelopmentRoadmap(
            owner_user_id=self.owner_id,
            company_id=self.company_id,
            client_request_id=payload.client_request_id,
            request_hash=digest,
            category=payload.category,
            title=payload.title,
            duration_weeks=payload.duration_weeks,
            hours_per_week=payload.hours_per_week,
            milestones=[
                DevelopmentMilestone(
                    title=milestone.title,
                    description=milestone.description,
                    due_date=milestone.due_date,
                    order=index,
                    tasks=[
                        DevelopmentTask(title=task.title, metric=task.metric, order=task_index)
                        for task_index, task in enumerate(milestone.tasks)
                    ],
                )
                for index, milestone in enumerate(payload.milestones)
            ],
        )
        self.db.add(row)
        try:
            await self.db.flush()
            result = roadmap_read(row)
            await self.db.commit()
            return result
        except IntegrityError:
            await self.db.rollback()
            existing = await self._saved_request(payload.client_request_id, digest)
            if existing is not None:
                return existing
            raise

    async def patch_task(
        self, roadmap_id: uuid.UUID, task_id: uuid.UUID, payload: RoadmapTaskPatch
    ) -> RoadmapRead:
        row = await self.db.scalar(self._roadmaps().where(DevelopmentRoadmap.id == roadmap_id))
        task = (
            next(
                (
                    task
                    for milestone in row.milestones
                    for task in milestone.tasks
                    if task.id == task_id
                ),
                None,
            )
            if row
            else None
        )
        if row is None or task is None:
            raise HTTPException(404, "Roadmap or task not found")
        new_version = await self.db.scalar(
            update(DevelopmentRoadmap)
            .where(
                DevelopmentRoadmap.id == roadmap_id,
                DevelopmentRoadmap.owner_user_id == self.owner_id,
                DevelopmentRoadmap.company_id == self.company_id,
                DevelopmentRoadmap.version == payload.expected_version,
            )
            .values(version=DevelopmentRoadmap.version + 1, updated_at=utc_now())
            .returning(DevelopmentRoadmap.version)
        )
        if new_version is None:
            await self.db.rollback()
            current = await self.db.scalar(
                self._roadmaps().where(DevelopmentRoadmap.id == roadmap_id)
            )
            if current is None:
                raise HTTPException(404, "Roadmap or task not found")
            raise HTTPException(
                409, {"code": "version_conflict", "currentVersion": current.version}
            )
        task.done = payload.done
        await self.db.flush()
        result = roadmap_read(row)
        await self.db.commit()
        return result

    async def settings(self) -> RoadmapSettingsRead:
        row = await self.db.get(DevelopmentPlanSettings, (self.owner_id, self.company_id))
        return (
            RoadmapSettingsRead.model_validate({**row.display_settings, "version": row.version})
            if row
            else RoadmapSettingsRead()
        )

    async def patch_settings(self, payload: RoadmapSettingsPatch) -> RoadmapSettingsRead:
        current = await self.settings()
        if current.version != payload.expected_version:
            raise HTTPException(
                409, {"code": "version_conflict", "currentVersion": current.version}
            )
        values = current.model_dump(exclude={"version"})
        values.update(payload.model_dump(exclude_unset=True, exclude={"expected_version"}))
        if current.version == 0:
            self.db.add(
                DevelopmentPlanSettings(
                    owner_user_id=self.owner_id,
                    company_id=self.company_id,
                    display_settings=values,
                )
            )
            try:
                await self.db.commit()
            except IntegrityError:
                await self.db.rollback()
                latest = await self.settings()
                if latest.version == 0:
                    raise
                raise HTTPException(
                    409, {"code": "version_conflict", "currentVersion": latest.version}
                ) from None
        else:
            new_version = await self.db.scalar(
                update(DevelopmentPlanSettings)
                .where(
                    DevelopmentPlanSettings.owner_user_id == self.owner_id,
                    DevelopmentPlanSettings.company_id == self.company_id,
                    DevelopmentPlanSettings.version == payload.expected_version,
                )
                .values(
                    display_settings=values,
                    version=DevelopmentPlanSettings.version + 1,
                    updated_at=utc_now(),
                )
                .returning(DevelopmentPlanSettings.version)
            )
            if new_version is None:
                await self.db.rollback()
                latest = await self.settings()
                raise HTTPException(
                    409, {"code": "version_conflict", "currentVersion": latest.version}
                )
            await self.db.commit()
        return RoadmapSettingsRead.model_validate({**values, "version": current.version + 1})
