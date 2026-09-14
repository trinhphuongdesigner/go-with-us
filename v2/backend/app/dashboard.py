"""Database-backed home summaries, scoped to the authenticated viewer."""

from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Query
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.api.v2.dependencies import CurrentUser, DbSession
from app.domain.enums import Role
from app.domain.models import Company, EmployeeSkill, Project, Skill, User
from app.domain.roadmap_models import DevelopmentMilestone, DevelopmentRoadmap
from app.security.roles import is_employee_role

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

DashboardView = Literal["personal", "management"]


@router.get("")
async def summary(
    db: DbSession,
    actor: CurrentUser,
    view: Annotated[DashboardView | None, Query(description="Dashboard scope")] = None,
):
    personal_available = is_employee_role(actor.role)
    management_available = actor.role in {
        Role.SUPER_ADMIN,
        Role.COMPANY_ADMIN,
        Role.BOD,
        Role.HR,
    }
    can_switch_view = personal_available and management_available

    if view == "personal" and personal_available:
        current_view: DashboardView = "personal"
    elif view == "management" and management_available:
        current_view = "management"
    elif personal_available:
        current_view = "personal"
    else:
        current_view = "management"

    want_personal = current_view == "personal"

    if not want_personal:
        users = select(func.count(User.id)).where(User.is_active.is_(True))
        companies = select(func.count(Company.id))
        roadmaps_count = select(func.count(DevelopmentRoadmap.id))
        if actor.role != Role.SUPER_ADMIN:
            users = users.where(User.company_id == actor.company_id)
            companies = companies.where(Company.id == actor.company_id)
            roadmaps_count = roadmaps_count.where(DevelopmentRoadmap.company_id == actor.company_id)
        return {
            "personal": False,
            "canSwitchView": can_switch_view,
            "currentView": current_view,
            "people": await db.scalar(users) or 0,
            "companies": await db.scalar(companies) or 0,
            "activeRoadmaps": await db.scalar(roadmaps_count) or 0,
        }

    roadmaps = (
        await db.scalars(
            select(DevelopmentRoadmap)
            .where(
                DevelopmentRoadmap.owner_user_id == actor.id,
                DevelopmentRoadmap.company_id == actor.company_id,
            )
            .options(
                selectinload(DevelopmentRoadmap.milestones).selectinload(DevelopmentMilestone.tasks)
            )
            .order_by(DevelopmentRoadmap.updated_at.desc())
        )
    ).all()
    skills = (
        await db.execute(
            select(Skill.name, EmployeeSkill.rating)
            .join(EmployeeSkill, EmployeeSkill.skill_id == Skill.id)
            .where(EmployeeSkill.user_id == actor.id, EmployeeSkill.company_id == actor.company_id)
            .order_by(EmployeeSkill.rating.desc(), Skill.name)
        )
    ).all()
    milestones = [m for r in roadmaps for m in r.milestones]
    tasks = [t for m in milestones for t in m.tasks]
    completed = sum(bool(m.tasks) and all(t.done for t in m.tasks) for m in milestones)
    overdue = [
        m
        for m in milestones
        if m.due_date
        and m.due_date < datetime.now(UTC).date()
        and (not m.tasks or not all(t.done for t in m.tasks))
    ]
    return {
        "personal": True,
        "canSwitchView": can_switch_view,
        "currentView": current_view,
        "skillCount": len(skills),
        "projectCount": await db.scalar(
            select(func.count(Project.id)).where(
                Project.user_id == actor.id, Project.company_id == actor.company_id
            )
        )
        or 0,
        "roadmapCount": len(roadmaps),
        "milestoneCount": len(milestones),
        "completedMilestones": completed,
        "taskCount": len(tasks),
        "completedTasks": sum(t.done for t in tasks),
        "overdueMilestones": len(overdue),
        "skills": [{"name": s.name, "rating": s.rating} for s in skills[:8]],
        "upcoming": [
            {
                "id": str(m.id),
                "title": m.title,
                "dueDate": m.due_date,
                "roadmap": r.title,
                "roadmapId": str(r.id),
                "roadmapVersion": r.version,
                "category": r.category,
                "tasks": [{"id": str(t.id), "title": t.title, "done": t.done} for t in m.tasks],
            }
            for r in roadmaps
            for m in r.milestones
            if not m.tasks or not all(t.done for t in m.tasks)
        ][:6],
    }
