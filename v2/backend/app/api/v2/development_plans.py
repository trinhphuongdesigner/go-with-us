import uuid
from typing import Annotated

from fastapi import APIRouter, Depends

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
