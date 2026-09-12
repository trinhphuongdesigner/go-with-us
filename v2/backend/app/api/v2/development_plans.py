import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from app.domain.roadmap_models import DevelopmentRoadmap, DevelopmentMilestone, DevelopmentTask
from app.services.development_plan_service import roadmap_read

from app.api.v2.dependencies import DbSession, require_permission
from app.domain.enums import Permission
from app.domain.models import User
from app.domain.roadmap_schemas import (
    DevelopmentPlanRead,
    RoadmapCategory,
    RoadmapRead,
    RoadmapSave,
    RoadmapSettingsPatch,
    RoadmapSettingsRead,
    RoadmapTaskPatch,
    RoadmapStructurePatch,
)
from app.services.development_plan_service import DevelopmentPlanService

router = APIRouter(prefix="/development-plans", tags=["development-plans"])
RoadmapActor = Annotated[User, Depends(require_permission(Permission.ROADMAP_SELF))]


@router.get("/me", response_model=DevelopmentPlanRead)
async def get_my_plan(db: DbSession, actor: RoadmapActor) -> DevelopmentPlanRead:
    return DevelopmentPlanRead(settings=await DevelopmentPlanService(db, actor).settings())


@router.get("/me/roadmaps", response_model=list[RoadmapRead])
async def list_my_roadmaps(
    db: DbSession, actor: RoadmapActor, category: RoadmapCategory | None = None
) -> list[RoadmapRead]:
    return await DevelopmentPlanService(db, actor).list_roadmaps(category)


@router.post("/me/roadmaps", response_model=RoadmapRead, status_code=201)
async def save_my_roadmap(payload: RoadmapSave, db: DbSession, actor: RoadmapActor) -> RoadmapRead:
    return await DevelopmentPlanService(db, actor).save_roadmap(payload)


@router.patch("/me/roadmaps/{roadmap_id}/tasks/{task_id}", response_model=RoadmapRead)
async def patch_my_task(
    roadmap_id: uuid.UUID,
    task_id: uuid.UUID,
    payload: RoadmapTaskPatch,
    db: DbSession,
    actor: RoadmapActor,
) -> RoadmapRead:
    return await DevelopmentPlanService(db, actor).patch_task(roadmap_id, task_id, payload)


@router.patch("/me/settings", response_model=RoadmapSettingsRead)
async def patch_my_settings(
    payload: RoadmapSettingsPatch, db: DbSession, actor: RoadmapActor
) -> RoadmapSettingsRead:
    return await DevelopmentPlanService(db, actor).patch_settings(payload)


@router.put("/me/roadmaps/{roadmap_id}", response_model=RoadmapRead)
async def replace_roadmap_structure(
    roadmap_id: uuid.UUID, payload: RoadmapStructurePatch, db: DbSession, actor: RoadmapActor
):
    service = DevelopmentPlanService(db, actor)
    row = await db.scalar(
        service._roadmaps().where(DevelopmentRoadmap.id == roadmap_id).with_for_update()
    )
    if row is None:
        raise HTTPException(404, "Không tìm thấy lộ trình")
    if row.version != payload.expected_version:
        raise HTTPException(409, {"code": "version_conflict", "currentVersion": row.version})
    row.milestones.clear()
    await db.flush()
    row.title, row.duration_weeks, row.hours_per_week = (
        payload.title,
        payload.duration_weeks,
        payload.hours_per_week,
    )
    row.version += 1
    row.milestones = [
        DevelopmentMilestone(
            title=item.title,
            description=item.description,
            due_date=item.due_date,
            order=index,
            tasks=[
                DevelopmentTask(
                    title=task.title, metric=task.metric, done=task.done, order=task_index
                )
                for task_index, task in enumerate(item.tasks)
            ],
        )
        for index, item in enumerate(payload.milestones)
    ]
    await db.flush()
    result = roadmap_read(row)
    await db.commit()
    return result


@router.delete("/me/roadmaps/{roadmap_id}", status_code=204)
async def delete_my_roadmap(
    roadmap_id: uuid.UUID, expected_version: int, db: DbSession, actor: RoadmapActor
):
    service = DevelopmentPlanService(db, actor)
    row = await db.scalar(
        service._roadmaps().where(DevelopmentRoadmap.id == roadmap_id).with_for_update()
    )
    if row is None:
        raise HTTPException(404, "Không tìm thấy lộ trình")
    if row.version != expected_version:
        raise HTTPException(409, {"code": "version_conflict", "currentVersion": row.version})
    await db.delete(row)
    await db.commit()
    return Response(status_code=204)
