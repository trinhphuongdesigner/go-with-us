import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.enums import AdminPermission, Permission, Role
from app.domain.models import Company, validate_user_tenant_invariant
from app.repositories.user_repo import CompanyRepository
from app.security.permissions import effective_permissions
from app.security.roles import can_manage_role, get_manageable_roles, is_employee_role
from app.services.competency_profile_service import CompetencyNotFound, CompetencyProfileService
from app.services.profile_service import ProfileService, RosterPersonNotFound
from app.services.user_service import AuthorizationDenied, TenantMismatch, UserService
from tests.test_permissions import make_user
from tests.test_user_service import make_actor


@pytest.mark.parametrize("role", list(Role))
def test_personal_permissions_only_for_employee_roles(role: Role) -> None:
    permissions = effective_permissions(make_user(role))
    personal = {Permission.PROFILE_SELF, Permission.ROADMAP_SELF, Permission.ASSESSMENT_SELF}
    assert personal <= permissions if is_employee_role(role) else personal.isdisjoint(permissions)


@pytest.mark.parametrize("role", [Role.BOD, Role.HR])
def test_new_roles_require_tenant_and_explicit_admin_grants(role: Role) -> None:
    actor = make_user(role)
    assert Permission.PEOPLE_WRITE not in effective_permissions(actor)
    actor.admin_permissions = [AdminPermission.EMPLOYEE_WRITE.value, "platform:manage"]
    assert Permission.PEOPLE_WRITE in effective_permissions(actor)
    assert Permission.PLATFORM_MANAGE not in effective_permissions(actor)
    actor.company_id = None
    with pytest.raises(ValueError, match="company_id is required"):
        validate_user_tenant_invariant(actor)


@pytest.mark.parametrize("caller", list(Role))
@pytest.mark.parametrize("target", list(Role))
def test_management_hierarchy_is_strict(caller: Role, target: Role) -> None:
    ordered = [Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.BOD, Role.HR, Role.EMPLOYEE]
    expected = caller == Role.SUPER_ADMIN or ordered.index(caller) < ordered.index(target)
    assert can_manage_role(caller, target) == expected
    assert (target in get_manageable_roles(caller)) == expected


@pytest.mark.parametrize("role", [Role.COMPANY_ADMIN, Role.BOD, Role.HR])
async def test_management_roster_and_profile_scope(
    db_session: AsyncSession, role: Role
) -> None:
    own = await CompanyRepository(db_session).add(Company(name="Own"))
    other = await CompanyRepository(db_session).add(Company(name="Other"))
    await db_session.flush()
    grants = [AdminPermission.EMPLOYEE_READ.value, AdminPermission.EMPLOYEE_WRITE.value]
    actor = await make_actor(db_session, role=role, company=own, permissions=grants)
    targets = [
        await make_actor(db_session, role=target_role, company=own)
        for target_role in [Role.COMPANY_ADMIN, Role.BOD, Role.HR, Role.EMPLOYEE]
    ]
    foreign = await make_actor(db_session, role=Role.EMPLOYEE, company=other)
    service = ProfileService(db_session)
    users, total = await service.list_roster(
        actor=actor, requested_company_id=None, query=None, active=None, page=1, page_size=20
    )
    expected = {target.id for target in targets if can_manage_role(role, target.role)}
    assert {user.id for user in users} == expected
    assert total == len(expected)
    for target in targets:
        if target.id not in expected:
            with pytest.raises(RosterPersonNotFound):
                await service.get_roster_person(
                    actor=actor, requested_company_id=None, user_id=target.id
                )
    with pytest.raises(CompetencyNotFound):
        await CompetencyProfileService(db_session).resolve_target(actor, foreign.id, write=True)


@pytest.mark.parametrize("role,target", [(Role.COMPANY_ADMIN, Role.BOD), (Role.BOD, Role.HR), (Role.HR, Role.EMPLOYEE)])
async def test_employee_creation_honors_role_and_tenant_hierarchy(
    db_session: AsyncSession, role: Role, target: Role
) -> None:
    own = await CompanyRepository(db_session).add(Company(name="Own"))
    other = await CompanyRepository(db_session).add(Company(name="Other"))
    await db_session.flush()
    actor = await make_actor(
        db_session, role=role, company=own, permissions=[AdminPermission.EMPLOYEE_WRITE.value]
    )
    service = UserService(db_session)
    created = await service.create_employee(
        initiator=actor, request_id=None, company_id=own.id,
        email="created@example.dev", password="DemoPass123!", role=target,
    )
    assert created.role == target
    with pytest.raises(AuthorizationDenied):
        await service.create_employee(
            initiator=actor, request_id=None, company_id=own.id,
            email="peer@example.dev", password="DemoPass123!", role=role,
        )
    with pytest.raises(TenantMismatch):
        await service.create_employee(
            initiator=actor, request_id=None, company_id=other.id,
            email="other@example.dev", password="DemoPass123!", role=target,
        )
