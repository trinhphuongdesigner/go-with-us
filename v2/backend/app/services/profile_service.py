from __future__ import annotations

import uuid
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.enums import CompanyStatus, Permission, Role
from app.domain.models import User
from app.domain.profile_schemas import ProfilePatch
from app.repositories.activity_repo import ActivityLogRepository
from app.repositories.user_repo import CompanyRepository, UserRepository
from app.security.permissions import effective_permissions
from app.security.roles import get_manageable_roles


class RosterScopeRequired(ValueError):
    pass


class RosterTenantDenied(PermissionError):
    pass


class RosterCompanyNotFound(LookupError):
    pass


class RosterPersonNotFound(LookupError):
    pass


@dataclass(frozen=True)
class ProfileVersionConflict(Exception):
    current_version: int


class ProfileService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.users = UserRepository(session)
        self.companies = CompanyRepository(session)
        self.activity = ActivityLogRepository(session)

    async def update_self(
        self,
        *,
        actor: User,
        payload: ProfilePatch,
        request_id: str | None,
    ) -> User:
        if Permission.PROFILE_SELF not in effective_permissions(actor):
            raise RosterTenantDenied
        actor_id = actor.id
        actor_company_id = actor.company_id
        fields = sorted(
            {"jobTitle" if name == "job_title" else name for name in payload.model_fields_set}
            - {"profile_version"}
        )
        values: dict[str, object] = {}
        if "name" in payload.model_fields_set:
            values["name"] = payload.name
        if "job_title" in payload.model_fields_set:
            values["job_title"] = payload.job_title
        try:
            updated = await self.users.update_profile_if_version(
                actor_id, payload.profile_version, values
            )
            if updated is None:
                await self.session.rollback()
                current = await self.users.get_by_id(actor_id)
                if current is None:
                    raise RosterPersonNotFound
                raise ProfileVersionConflict(current.version)
            await self.activity.log(
                actor_id=actor_id,
                company_id=actor_company_id,
                action="profile.self.updated",
                entity_type="user",
                entity_id=str(actor_id),
                request_id=request_id,
                changes={
                    "fields": fields,
                    "fromVersion": payload.profile_version,
                    "toVersion": payload.profile_version + 1,
                    "source": "manual",
                },
            )
            await self.session.commit()
            return updated
        except ProfileVersionConflict:
            raise
        except Exception:
            await self.session.rollback()
            raise

    async def resolve_roster_company(
        self, actor: User, requested_company_id: uuid.UUID | None
    ) -> uuid.UUID:
        if Permission.PEOPLE_READ not in effective_permissions(actor):
            raise RosterTenantDenied
        if actor.role == Role.SUPER_ADMIN:
            if requested_company_id is None:
                raise RosterScopeRequired
            company_id = requested_company_id
        else:
            if actor.company_id is None:
                raise RosterTenantDenied
            if requested_company_id is not None and requested_company_id != actor.company_id:
                raise RosterTenantDenied
            company_id = actor.company_id
        company = await self.companies.get_by_id(company_id)
        if company is None or company.status != CompanyStatus.ACTIVE:
            raise RosterCompanyNotFound
        return company_id

    async def list_roster(
        self,
        *,
        actor: User,
        requested_company_id: uuid.UUID | None,
        query: str | None,
        active: bool | None,
        page: int,
        page_size: int,
    ) -> tuple[list[User], int]:
        company_id = await self.resolve_roster_company(actor, requested_company_id)
        roles = get_manageable_roles(actor.role)
        total = await self.users.count_roster(company_id, query=query, active=active, roles=roles)
        users = await self.users.list_roster(
            company_id,
            query=query,
            active=active,
            offset=(page - 1) * page_size,
            limit=page_size,
            roles=roles,
        )
        return list(users), total

    async def get_roster_person(
        self,
        *,
        actor: User,
        requested_company_id: uuid.UUID | None,
        user_id: uuid.UUID,
    ) -> User:
        company_id = await self.resolve_roster_company(actor, requested_company_id)
        user = await self.users.get_roster_person(
            user_id, company_id, roles=get_manageable_roles(actor.role)
        )
        if user is None:
            raise RosterPersonNotFound
        return user
