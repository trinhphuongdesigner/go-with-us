from __future__ import annotations

import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date
from typing import Any, Literal, TypeVar, cast
from unicodedata import normalize

from sqlalchemy import delete, func, select, text, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domain.competency_schemas import (
    AwardCreate,
    AwardPatch,
    CertificationCreate,
    CertificationPatch,
    EmployeeSkillReplace,
    ExperienceCreate,
    ExperiencePatch,
    ProjectCreate,
    ProjectPatch,
)
from app.domain.enums import Permission, ProfileSourceType, Role
from app.domain.models import (
    Award,
    Certification,
    EmployeeSkill,
    Employment,
    Experience,
    Project,
    Skill,
    User,
)
from app.repositories.activity_repo import ActivityLogRepository
from app.security.permissions import effective_permissions
from app.security.roles import can_manage_role, is_employee_role

Resource = Experience | Project | Certification | Award
ResourceType = TypeVar("ResourceType", Experience, Project, Certification, Award)
CollectionItem = TypeVar("CollectionItem")
ResourceKind = Literal["experience", "project", "certification", "award"]

RESOURCE_MODELS: dict[ResourceKind, type[Resource]] = {
    "experience": Experience,
    "project": Project,
    "certification": Certification,
    "award": Award,
}

PROFILE_COLLECTION_LIMIT = 200


class CompetencyNotFound(LookupError):
    pass


class CompetencyDenied(PermissionError):
    pass


class CompetencyInvalid(ValueError):
    pass


@dataclass(frozen=True)
class CompetencyVersionConflict(Exception):
    current_version: int


@dataclass(frozen=True)
class CompetencyAggregate:
    user: User
    skills: tuple[EmployeeSkill, ...]
    experiences: tuple[Experience, ...]
    projects: tuple[Project, ...]
    certifications: tuple[Certification, ...]
    awards: tuple[Award, ...]
    employments: tuple[Employment, ...]


def normalize_skill_name(value: str) -> tuple[str, str]:
    display = normalize("NFC", " ".join(value.split()))
    return display, normalize("NFC", display.casefold())


class CompetencyProfileService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.activity = ActivityLogRepository(session)

    async def _start_read_snapshot(self) -> None:
        # Authentication opens a request transaction before the service runs. Close it so
        # the target version and its collections are read from one fresh snapshot.
        await self.session.commit()
        if self.session.bind is not None and self.session.bind.dialect.name == "postgresql":
            await self.session.execute(text("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ"))

    async def resolve_target(
        self, actor: User, requested_user_id: uuid.UUID | None, *, write: bool
    ) -> User:
        target_id = requested_user_id or actor.id
        target = await self.session.scalar(
            select(User).where(User.id == target_id).execution_options(populate_existing=True)
        )
        if target is None:
            raise CompetencyNotFound
        if not is_employee_role(target.role):
            raise CompetencyDenied
        if target.id == actor.id:
            if Permission.PROFILE_SELF not in effective_permissions(actor):
                raise CompetencyDenied
            return target
        if actor.role == Role.EMPLOYEE:
            raise CompetencyNotFound
        permission = Permission.PEOPLE_WRITE if write else Permission.PEOPLE_READ
        if permission not in effective_permissions(actor):
            raise CompetencyDenied
        if actor.role != Role.SUPER_ADMIN and (
            actor.company_id is None
            or target.company_id != actor.company_id
            or not can_manage_role(actor.role, target.role)
        ):
            raise CompetencyNotFound
        return target

    def _company_filter(self, actor: User, target: User) -> uuid.UUID | None:
        if actor.id == target.id or actor.role == Role.SUPER_ADMIN:
            return None
        return actor.company_id

    async def _profile_cas(self, target: User, expected_version: int) -> int:
        target_id = target.id
        result = await self.session.execute(
            update(User)
            .where(User.id == target_id, User.version == expected_version)
            .values(version=User.version + 1, updated_at=func.now())
            .returning(User.version)
        )
        new_version = result.scalar_one_or_none()
        if new_version is None:
            await self.session.rollback()
            current = await self.session.scalar(
                select(User).where(User.id == target_id).execution_options(populate_existing=True)
            )
            if current is None:
                raise CompetencyNotFound
            raise CompetencyVersionConflict(current.version)
        return int(new_version)

    async def create_skill(
        self,
        actor: User,
        name: str,
        category: str | None,
        request_id: str | None,
    ) -> Skill:
        display, normalized_key = normalize_skill_name(name)
        dialect = self.session.bind.dialect.name if self.session.bind is not None else ""
        values = {
            "id": uuid.uuid4(),
            "name": display,
            "normalized_key": normalized_key,
            "category": category,
        }
        statement = (
            (pg_insert(Skill) if dialect == "postgresql" else sqlite_insert(Skill))
            .values(**values)
            .on_conflict_do_nothing(index_elements=[Skill.normalized_key])
            .returning(Skill.id)
        )
        try:
            result = await self.session.execute(statement)
            inserted_id = result.scalar_one_or_none()
            if inserted_id is not None:
                await self.activity.log(
                    actor_id=actor.id,
                    company_id=actor.company_id,
                    action="profile.skill.created",
                    entity_type="skill",
                    entity_id=str(inserted_id),
                    request_id=request_id,
                    changes={
                        "fields": ["name", *(["category"] if category is not None else [])],
                    },
                )
            await self.session.commit()
        except Exception:
            await self.session.rollback()
            raise
        skill = await self.session.scalar(
            select(Skill).where(Skill.normalized_key == normalized_key)
        )
        if skill is None:
            raise RuntimeError("Skill upsert did not return a catalog item")
        return skill

    async def list_skills(self, page: int, page_size: int) -> tuple[Sequence[Skill], int]:
        await self._start_read_snapshot()
        total = int(await self.session.scalar(select(func.count()).select_from(Skill)) or 0)
        rows = (
            await self.session.scalars(
                select(Skill)
                .order_by(func.lower(Skill.name), Skill.id)
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        ).all()
        return rows, total

    @staticmethod
    def _bounded(items: Sequence[CollectionItem]) -> Sequence[CollectionItem]:
        if len(items) > PROFILE_COLLECTION_LIMIT:
            raise CompetencyInvalid(
                f"Mỗi danh sách hồ sơ không được vượt quá {PROFILE_COLLECTION_LIMIT} mục"
            )
        return items

    async def list_employee_skills(
        self, actor: User, user_id: uuid.UUID | None
    ) -> tuple[User, Sequence[EmployeeSkill]]:
        await self._start_read_snapshot()
        target = await self.resolve_target(actor, user_id, write=False)
        filters = [EmployeeSkill.user_id == target.id]
        company_filter = self._company_filter(actor, target)
        if company_filter is not None:
            filters.append(EmployeeSkill.company_id == company_filter)
        rows = await self.session.scalars(
            select(EmployeeSkill)
            .options(selectinload(EmployeeSkill.skill))
            .join(EmployeeSkill.skill)
            .where(*filters)
            .order_by(func.lower(Skill.name), EmployeeSkill.id)
            .limit(PROFILE_COLLECTION_LIMIT + 1)
        )
        return target, self._bounded(rows.all())

    async def replace_employee_skills(
        self,
        actor: User,
        user_id: uuid.UUID,
        payload: EmployeeSkillReplace,
        request_id: str | None,
    ) -> tuple[int, Sequence[EmployeeSkill]]:
        target = await self.resolve_target(actor, user_id, write=True)
        if target.company_id is None:
            raise CompetencyNotFound
        skill_ids = [item.skill_id for item in payload.skills]
        known_ids = set(
            (await self.session.scalars(select(Skill.id).where(Skill.id.in_(skill_ids)))).all()
        )
        if known_ids != set(skill_ids):
            raise CompetencyInvalid("Một hoặc nhiều kỹ năng không tồn tại")
        existing = {
            row.skill_id: row
            for row in (
                await self.session.scalars(
                    select(EmployeeSkill).where(
                        EmployeeSkill.user_id == target.id,
                        EmployeeSkill.company_id == target.company_id,
                    )
                )
            ).all()
        }
        source = ProfileSourceType.SELF if actor.id == target.id else ProfileSourceType.ADMIN
        try:
            new_version = await self._profile_cas(target, payload.profile_version)
            wanted = set(skill_ids)
            await self.session.execute(
                delete(EmployeeSkill).where(
                    EmployeeSkill.user_id == target.id,
                    EmployeeSkill.company_id == target.company_id,
                    EmployeeSkill.skill_id.not_in(wanted),
                )
            )
            for item in payload.skills:
                current = existing.get(item.skill_id)
                if current is None:
                    self.session.add(
                        EmployeeSkill(
                            user_id=target.id,
                            company_id=target.company_id,
                            skill_id=item.skill_id,
                            rating=item.rating,
                            note=item.note,
                            self_assessed=actor.id == target.id,
                            source_type=source,
                            created_by=actor.id,
                            updated_by=actor.id,
                        )
                    )
                else:
                    current.rating = item.rating
                    current.note = item.note
                    current.self_assessed = actor.id == target.id
                    current.source_type = source
                    current.source_import_id = None
                    current.proposal_item_id = None
                    current.updated_by = actor.id
                    current.version += 1
            await self.session.flush()
            await self.activity.log(
                actor_id=actor.id,
                company_id=target.company_id,
                action="profile.skills.replaced",
                entity_type="employee_skill",
                entity_id=str(target.id),
                request_id=request_id,
                changes={
                    "itemCount": len(payload.skills),
                    "fromVersion": payload.profile_version,
                    "toVersion": new_version,
                },
            )
            rows = await self.session.scalars(
                select(EmployeeSkill)
                .options(selectinload(EmployeeSkill.skill))
                .join(EmployeeSkill.skill)
                .where(
                    EmployeeSkill.user_id == target.id,
                    EmployeeSkill.company_id == target.company_id,
                )
                .order_by(func.lower(Skill.name), EmployeeSkill.id)
            )
            materialized = tuple(rows.all())
            await self.session.commit()
            return new_version, materialized
        except CompetencyVersionConflict:
            raise
        except Exception:
            await self.session.rollback()
            raise

    async def _validate_employment(self, employment_id: uuid.UUID | None, target: User) -> None:
        if employment_id is None:
            return
        employment = await self.session.scalar(
            select(Employment).where(
                Employment.id == employment_id,
                Employment.user_id == target.id,
                Employment.company_id == target.company_id,
            )
        )
        if employment is None:
            raise CompetencyInvalid("Kỳ làm việc không thuộc hồ sơ này")

    async def list_resources(
        self, kind: ResourceKind, actor: User, user_id: uuid.UUID | None
    ) -> tuple[User, Sequence[Resource]]:
        await self._start_read_snapshot()
        target = await self.resolve_target(actor, user_id, write=False)
        model = RESOURCE_MODELS[kind]
        filters = [model.user_id == target.id]
        company_filter = self._company_filter(actor, target)
        if company_filter is not None:
            filters.append(model.company_id == company_filter)
        rows = await self.session.scalars(
            select(model)
            .where(*filters)
            .order_by(model.created_at, model.id)
            .limit(PROFILE_COLLECTION_LIMIT + 1)
        )
        return target, cast(Sequence[Resource], self._bounded(rows.all()))

    async def _scoped_resource(
        self,
        kind: ResourceKind,
        resource_id: uuid.UUID,
        actor: User,
        target: User,
    ) -> Resource:
        model = RESOURCE_MODELS[kind]
        filters = [model.id == resource_id, model.user_id == target.id]
        company_filter = self._company_filter(actor, target)
        if company_filter is not None:
            filters.append(model.company_id == company_filter)
        resource = await self.session.scalar(select(model).where(*filters))
        if resource is None:
            raise CompetencyNotFound
        return cast(Resource, resource)

    async def get_resource(
        self,
        kind: ResourceKind,
        resource_id: uuid.UUID,
        actor: User,
        user_id: uuid.UUID | None,
    ) -> Resource:
        target = await self.resolve_target(actor, user_id, write=False)
        return await self._scoped_resource(kind, resource_id, actor, target)

    @staticmethod
    def _payload_values(payload: object) -> dict[str, Any]:
        dumped = cast(
            dict[str, Any],
            payload.model_dump(  # type: ignore[attr-defined]
                exclude={"profile_version"}, exclude_unset=True, mode="python"
            ),
        )
        for field in ("url", "credential_url"):
            if dumped.get(field) is not None:
                dumped[field] = str(dumped[field])
        if dumped.get("evidence_url") is not None:
            dumped["evidence_url"] = str(dumped["evidence_url"])
        return dumped

    @staticmethod
    def _validate_combined_dates(
        kind: ResourceKind, resource: Resource, values: dict[str, Any]
    ) -> None:
        if kind in {"experience", "project"}:
            dated = cast(Experience | Project, resource)
            start = values.get("start_date", dated.start_date)
            end = values.get("end_date", dated.end_date)
            if start and end and date.fromisoformat(str(end)) < date.fromisoformat(str(start)):
                raise CompetencyInvalid("Ngày kết thúc không được trước ngày bắt đầu")
        if kind == "certification":
            certification = cast(Certification, resource)
            issued = values.get("issued_at", certification.issued_at)
            expires = values.get("expires_at", certification.expires_at)
            if (
                issued
                and expires
                and date.fromisoformat(str(expires)) < date.fromisoformat(str(issued))
            ):
                raise CompetencyInvalid("Ngày hết hạn không được trước ngày cấp")

    async def create_resource(
        self,
        kind: ResourceKind,
        actor: User,
        user_id: uuid.UUID | None,
        payload: ExperienceCreate | ProjectCreate | CertificationCreate | AwardCreate,
        request_id: str | None,
    ) -> Resource:
        target = await self.resolve_target(actor, user_id, write=True)
        if target.company_id is None:
            raise CompetencyNotFound
        values = self._payload_values(payload)
        if kind in {"experience", "project"}:
            await self._validate_employment(values.get("employment_id"), target)
        source = ProfileSourceType.SELF if actor.id == target.id else ProfileSourceType.ADMIN
        model = RESOURCE_MODELS[kind]
        resource = model(
            **values,
            user_id=target.id,
            company_id=target.company_id,
            source_type=source,
            created_by=actor.id,
            updated_by=actor.id,
            **({"self_reported": actor.id == target.id} if kind == "award" else {}),
        )
        try:
            new_version = await self._profile_cas(target, payload.profile_version)
            current_count = int(
                await self.session.scalar(
                    select(func.count())
                    .select_from(model)
                    .where(model.user_id == target.id, model.company_id == target.company_id)
                )
                or 0
            )
            if current_count >= PROFILE_COLLECTION_LIMIT:
                raise CompetencyInvalid(
                    f"Mỗi danh sách hồ sơ không được vượt quá {PROFILE_COLLECTION_LIMIT} mục"
                )
            self.session.add(resource)
            await self.session.flush()
            await self.activity.log(
                actor_id=actor.id,
                company_id=target.company_id,
                action=f"profile.{kind}.created",
                entity_type=kind,
                entity_id=str(resource.id),
                request_id=request_id,
                changes={
                    "fields": sorted(values),
                    "fromVersion": payload.profile_version,
                    "toVersion": new_version,
                },
            )
            await self.session.commit()
            return resource
        except CompetencyVersionConflict:
            raise
        except Exception:
            await self.session.rollback()
            raise

    async def update_resource(
        self,
        kind: ResourceKind,
        resource_id: uuid.UUID,
        actor: User,
        user_id: uuid.UUID | None,
        payload: ExperiencePatch | ProjectPatch | CertificationPatch | AwardPatch,
        request_id: str | None,
    ) -> Resource:
        target = await self.resolve_target(actor, user_id, write=True)
        resource = await self._scoped_resource(kind, resource_id, actor, target)
        values = self._payload_values(payload)
        self._validate_combined_dates(kind, resource, values)
        if kind in {"experience", "project"} and "employment_id" in values:
            await self._validate_employment(values["employment_id"], target)
        source = ProfileSourceType.SELF if actor.id == target.id else ProfileSourceType.ADMIN
        try:
            new_version = await self._profile_cas(target, payload.profile_version)
            for field, value in values.items():
                setattr(resource, field, value)
            resource.source_type = source
            resource.source_import_id = None
            resource.proposal_item_id = None
            if kind == "award":
                cast(Award, resource).self_reported = actor.id == target.id
            resource.updated_by = actor.id
            resource.version += 1
            await self.session.flush()
            await self.activity.log(
                actor_id=actor.id,
                company_id=resource.company_id,
                action=f"profile.{kind}.updated",
                entity_type=kind,
                entity_id=str(resource.id),
                request_id=request_id,
                changes={
                    "fields": sorted(values),
                    "fromVersion": payload.profile_version,
                    "toVersion": new_version,
                },
            )
            await self.session.commit()
            return resource
        except CompetencyVersionConflict:
            raise
        except Exception:
            await self.session.rollback()
            raise

    async def delete_resource(
        self,
        kind: ResourceKind,
        resource_id: uuid.UUID,
        actor: User,
        user_id: uuid.UUID | None,
        profile_version: int,
        request_id: str | None,
    ) -> None:
        target = await self.resolve_target(actor, user_id, write=True)
        resource = await self._scoped_resource(kind, resource_id, actor, target)
        try:
            new_version = await self._profile_cas(target, profile_version)
            await self.session.delete(resource)
            await self.activity.log(
                actor_id=actor.id,
                company_id=resource.company_id,
                action=f"profile.{kind}.deleted",
                entity_type=kind,
                entity_id=str(resource.id),
                request_id=request_id,
                changes={"fromVersion": profile_version, "toVersion": new_version},
            )
            await self.session.commit()
        except CompetencyVersionConflict:
            raise
        except Exception:
            await self.session.rollback()
            raise

    async def aggregate(self, actor: User, user_id: uuid.UUID | None) -> CompetencyAggregate:
        await self._start_read_snapshot()
        target = await self.resolve_target(actor, user_id, write=False)
        company_filter = self._company_filter(actor, target)

        async def rows(model: type[ResourceType]) -> tuple[ResourceType, ...]:
            filters = [model.user_id == target.id]
            if company_filter is not None:
                filters.append(model.company_id == company_filter)
            result = await self.session.scalars(
                select(model).where(*filters).order_by(model.id).limit(PROFILE_COLLECTION_LIMIT + 1)
            )
            return tuple(self._bounded(result.all()))

        skill_filters = [EmployeeSkill.user_id == target.id]
        employment_filters = [Employment.user_id == target.id]
        if company_filter is not None:
            skill_filters.append(EmployeeSkill.company_id == company_filter)
            employment_filters.append(Employment.company_id == company_filter)
        skills = tuple(
            (
                await self.session.scalars(
                    select(EmployeeSkill)
                    .options(selectinload(EmployeeSkill.skill))
                    .join(EmployeeSkill.skill)
                    .where(*skill_filters)
                    .order_by(func.lower(Skill.name), EmployeeSkill.id)
                    .limit(PROFILE_COLLECTION_LIMIT + 1)
                )
            ).all()
        )
        self._bounded(skills)
        employments = tuple(
            (
                await self.session.scalars(
                    select(Employment)
                    .where(*employment_filters)
                    .order_by(Employment.id)
                    .limit(PROFILE_COLLECTION_LIMIT + 1)
                )
            ).all()
        )
        self._bounded(employments)
        return CompetencyAggregate(
            user=target,
            skills=skills,
            experiences=await rows(Experience),
            projects=await rows(Project),
            certifications=await rows(Certification),
            awards=await rows(Award),
            employments=employments,
        )
