import uuid
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.enums import AdminPermission, CompanyStatus, EmploymentStatus, Permission, Role
from app.domain.models import Company, Employment, User, validate_user_tenant_invariant
from app.repositories.activity_repo import ActivityLogRepository
from app.repositories.user_repo import CompanyRepository, EmploymentRepository, UserRepository
from app.security.jwt import hash_password
from app.security.permissions import effective_permissions
from app.security.roles import can_manage_role, is_employee_role


class AuthorizationDenied(PermissionError):
    pass


class TenantMismatch(PermissionError):
    pass


class UserService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.user_repo = UserRepository(session)
        self.company_repo = CompanyRepository(session)
        self.employment_repo = EmploymentRepository(session)
        self.activity_repo = ActivityLogRepository(session)

    async def create_company_with_admin(
        self,
        *,
        initiator: User,
        request_id: str | None,
        company_name: str,
        admin_email: str,
        admin_password: str,
    ) -> tuple[Company, User]:
        self._require_active_initiator(initiator)
        if initiator.role != Role.SUPER_ADMIN:
            raise AuthorizationDenied("Only a super admin can create a company")
        try:
            company = await self.company_repo.add(Company(name=company_name.strip()))
            admin = await self.user_repo.add(
                User(
                    email=admin_email.strip().casefold(),
                    name="Quản trị viên",
                    job_title="Quản lý công ty",
                    hashed_password=hash_password(admin_password),
                    role=Role.COMPANY_ADMIN,
                    company_id=company.id,
                    admin_permissions=[permission.value for permission in AdminPermission],
                    is_active=True,
                )
            )
            await self.activity_repo.log(
                actor_id=initiator.id,
                company_id=company.id,
                action="company.created",
                entity_type="company",
                entity_id=str(company.id),
                changes={"fields": ["name"]},
                request_id=request_id,
            )
            await self.session.commit()
            return company, admin
        except Exception:
            await self.session.rollback()
            raise

    async def create_employee(
        self,
        *,
        initiator: User,
        request_id: str | None,
        company_id: uuid.UUID,
        email: str,
        password: str,
        title: str = "Employee",
        role: Role = Role.EMPLOYEE,
    ) -> User:
        self._require_active_initiator(initiator)
        if Permission.PEOPLE_WRITE not in effective_permissions(initiator):
            raise AuthorizationDenied("Employee write permission is required")
        if not is_employee_role(role) or not can_manage_role(initiator.role, role):
            raise AuthorizationDenied("Cannot create an employee with this role")
        if initiator.role != Role.SUPER_ADMIN and initiator.company_id != company_id:
            raise TenantMismatch("Cannot create employees in another tenant")
        company = await self.company_repo.get_by_id(company_id)
        if company is None or company.status != CompanyStatus.ACTIVE:
            raise TenantMismatch("Target company is unavailable")

        try:
            user = await self.user_repo.add(
                User(
                    email=email.strip().casefold(),
                    name=email.split("@", maxsplit=1)[0].replace(".", " ").title(),
                    job_title=title,
                    hashed_password=hash_password(password),
                    role=role,
                    company_id=company_id,
                    is_active=True,
                )
            )
            await self.employment_repo.add(
                Employment(
                    user_id=user.id,
                    company_id=company_id,
                    title=title,
                    start_date=datetime.now(UTC),
                    status=EmploymentStatus.ACTIVE,
                )
            )
            await self.activity_repo.log(
                actor_id=initiator.id,
                company_id=company_id,
                action="employee.created",
                entity_type="user",
                entity_id=str(user.id),
                changes={"fields": ["email", "role", "company_id"]},
                request_id=request_id,
            )
            await self.session.commit()
            return user
        except Exception:
            await self.session.rollback()
            raise

    @staticmethod
    def _require_active_initiator(initiator: User) -> None:
        validate_user_tenant_invariant(initiator)
        if not initiator.is_active:
            raise AuthorizationDenied("Inactive users cannot perform administrative actions")

    async def get_user_scoped(
        self, user_id: uuid.UUID, requester_company_id: uuid.UUID | None
    ) -> User | None:
        if requester_company_id is None:
            return await self.user_repo.get_by_id(user_id)
        return await self.user_repo.get_in_company(user_id, requester_company_id)
