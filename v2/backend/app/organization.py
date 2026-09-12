"""Company/account administration and company role grants for the v2 runtime."""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Query
from pydantic import EmailStr, Field, SecretStr
from sqlalchemy import JSON, ForeignKey, String, UniqueConstraint, Uuid, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Mapped, mapped_column

from app.api.v2.dependencies import CurrentUser, DbSession
from app.core.database import Base
from app.company_memberships import CompanyMembership, resolve_company_scope
from app.domain.enums import AdminPermission, CompanyStatus, EmploymentStatus, Permission, Role
from app.domain.models import AuthSession, Company, Employment, TimestampMixin, User
from app.domain.schemas import ApiModel
from app.security.jwt import hash_password, verify_and_upgrade_password
from app.security.permissions import can_delegate_admin_grants, effective_permissions
from app.security.roles import can_manage_role, get_manageable_roles, is_employee_role


class CompanyDetails(Base):
    __tablename__ = "company_details"
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id"), primary_key=True)
    industry: Mapped[str | None] = mapped_column(String(180))


class CompanyRoleDefinition(TimestampMixin, Base):
    __tablename__ = "company_role_definitions"
    __table_args__ = (UniqueConstraint("company_id", "role", name="uq_company_role_definition"),)
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id"), nullable=False)
    role: Mapped[str] = mapped_column(String(24), nullable=False)
    permissions: Mapped[list[str]] = mapped_column(JSON, default=list)
    version: Mapped[int] = mapped_column(default=1)


DEFAULT_GRANTS = {
    Role.BOD: [
        AdminPermission.COMPANY_READ,
        AdminPermission.EMPLOYEE_READ,
        AdminPermission.PASSPORT_APPROVE,
    ],
    Role.HR: [
        AdminPermission.COMPANY_READ,
        AdminPermission.EMPLOYEE_READ,
        AdminPermission.EMPLOYEE_WRITE,
        AdminPermission.ASSESSMENT_REVIEW,
    ],
}
router = APIRouter(prefix="/organization", tags=["organization"])


def require(actor: User, permission: Permission) -> None:
    if permission not in effective_permissions(actor):
        raise HTTPException(403, "Bạn không có quyền thực hiện thao tác này")


def company_scope(actor: User, company_id: uuid.UUID | None) -> uuid.UUID:
    if actor.role == Role.SUPER_ADMIN:
        if company_id is None:
            raise HTTPException(400, "Hãy chọn công ty")
        return company_id
    if actor.company_id is None or company_id not in {None, actor.company_id}:
        raise HTTPException(403, "Không thể truy cập công ty này")
    return actor.company_id


class CompanyRead(ApiModel):
    id: uuid.UUID
    name: str
    industry: str | None = None
    status: CompanyStatus
    version: int


class CompanyCreate(ApiModel):
    name: str = Field(min_length=1, max_length=255)
    industry: str | None = Field(default=None, max_length=180)
    admin_email: EmailStr
    admin_name: str = Field(min_length=1, max_length=160)
    admin_password: SecretStr = Field(min_length=12, max_length=256)


class CompanyPatch(ApiModel):
    expected_version: int = Field(ge=1)
    name: str = Field(min_length=1, max_length=255)
    industry: str | None = Field(default=None, max_length=180)
    status: CompanyStatus = CompanyStatus.ACTIVE


async def company_read(db, row: Company) -> CompanyRead:
    details = await db.get(CompanyDetails, row.id)
    return CompanyRead(
        id=row.id,
        name=row.name,
        status=row.status,
        version=row.version,
        industry=details.industry if details else None,
    )


@router.get("/companies", response_model=list[CompanyRead])
async def companies(db: DbSession, actor: CurrentUser):
    require(actor, Permission.COMPANY_READ)
    query = select(Company).order_by(Company.created_at.desc())
    if actor.role != Role.SUPER_ADMIN:
        query = query.join(CompanyMembership, CompanyMembership.company_id == Company.id).where(
            CompanyMembership.user_id == actor.id, Company.status == CompanyStatus.ACTIVE
        )
    return [await company_read(db, row) for row in (await db.scalars(query)).all()]


@router.post("/companies", response_model=CompanyRead, status_code=201)
async def create_company(payload: CompanyCreate, db: DbSession, actor: CurrentUser):
    require(actor, Permission.PLATFORM_MANAGE)
    company = Company(name=payload.name.strip())
    if not company.name:
        raise HTTPException(422, "Tên công ty không được trống")
    try:
        db.add(company)
        await db.flush()
        db.add(CompanyDetails(company_id=company.id, industry=payload.industry))
        admin = User(
            email=str(payload.admin_email).casefold(),
            name=payload.admin_name.strip(),
            role=Role.COMPANY_ADMIN,
            company_id=company.id,
            hashed_password=hash_password(payload.admin_password.get_secret_value()),
            admin_permissions=[item.value for item in AdminPermission],
        )
        db.add(admin)
        await db.flush()
        db.add(CompanyMembership(user_id=admin.id, company_id=company.id))
        for role, grants in DEFAULT_GRANTS.items():
            db.add(
                CompanyRoleDefinition(
                    company_id=company.id,
                    role=role.value,
                    permissions=[item.value for item in grants],
                )
            )
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, "Công ty hoặc email quản trị đã tồn tại") from None
    return await company_read(db, company)


@router.patch("/companies/{company_id}", response_model=CompanyRead)
async def patch_company(
    company_id: uuid.UUID, payload: CompanyPatch, db: DbSession, actor: CurrentUser
):
    require(actor, Permission.COMPANY_MANAGE)
    scope = company_scope(actor, company_id)
    if actor.role not in {Role.SUPER_ADMIN, Role.COMPANY_ADMIN}:
        raise HTTPException(403, "Chỉ quản trị viên được chỉnh sửa công ty")
    row = await db.scalar(select(Company).where(Company.id == scope).with_for_update())
    if row is None:
        raise HTTPException(404, "Không tìm thấy công ty")
    if row.version != payload.expected_version:
        raise HTTPException(409, "Công ty đã thay đổi; hãy tải lại")
    if not payload.name.strip():
        raise HTTPException(422, "Tên công ty không được trống")
    if actor.role != Role.SUPER_ADMIN and row.status != payload.status:
        raise HTTPException(403, "Chỉ quản trị hệ thống được khóa công ty")
    row.name, row.status, row.version = payload.name.strip(), payload.status, row.version + 1
    details = await db.get(CompanyDetails, scope)
    if details is None:
        details = CompanyDetails(company_id=scope)
        db.add(details)
    details.industry = payload.industry
    await db.commit()
    return await company_read(db, row)


class AccountRead(ApiModel):
    id: uuid.UUID
    email: str
    name: str
    job_title: str | None
    role: Role
    company_id: uuid.UUID | None
    is_active: bool
    version: int
    admin_permissions: list[str]


class AccountCreate(ApiModel):
    company_id: uuid.UUID | None = None
    email: EmailStr
    name: str = Field(min_length=1, max_length=160)
    job_title: str | None = Field(default=None, max_length=160)
    role: Role = Role.EMPLOYEE
    password: SecretStr = Field(min_length=12, max_length=256)


class AccountPatch(ApiModel):
    expected_version: int = Field(ge=1)
    email: EmailStr
    name: str = Field(min_length=1, max_length=160)
    job_title: str | None = Field(default=None, max_length=160)
    role: Role
    is_active: bool


async def role_grants(db, company_id, role: Role) -> list[str]:
    if role == Role.COMPANY_ADMIN:
        return [item.value for item in AdminPermission]
    definition = await db.scalar(
        select(CompanyRoleDefinition).where(
            CompanyRoleDefinition.company_id == company_id, CompanyRoleDefinition.role == role.value
        )
    )
    return (
        list(definition.permissions)
        if definition
        else [item.value for item in DEFAULT_GRANTS.get(role, [])]
    )


@router.get("/users", response_model=list[AccountRead])
async def accounts(
    db: DbSession, actor: CurrentUser, company_id: uuid.UUID | None = Query(None, alias="companyId")
):
    require(actor, Permission.PEOPLE_READ)
    query = select(User).order_by(User.created_at.desc())
    if actor.role == Role.SUPER_ADMIN:
        if company_id:
            query = query.where(User.company_id == company_id)
    else:
        query = query.where(
            User.company_id == company_scope(actor, company_id),
            User.role.in_(get_manageable_roles(actor.role)),
        )
    return list((await db.scalars(query)).all())


@router.post("/users", response_model=AccountRead, status_code=201)
async def create_account(payload: AccountCreate, db: DbSession, actor: CurrentUser):
    require(actor, Permission.PEOPLE_WRITE)
    if not can_manage_role(actor.role, payload.role):
        raise HTTPException(403, "Không được cấp vai trò ngang hoặc cao hơn")
    company_id = (
        None if payload.role == Role.SUPER_ADMIN else company_scope(actor, payload.company_id)
    )
    if company_id:
        company = await db.get(Company, company_id)
        if company is None or company.status != CompanyStatus.ACTIVE:
            raise HTTPException(404, "Công ty không hoạt động")
    if not payload.name.strip():
        raise HTTPException(422, "Tên không được trống")
    row = User(
        email=str(payload.email).casefold(),
        name=payload.name.strip(),
        job_title=payload.job_title,
        role=payload.role,
        company_id=company_id,
        hashed_password=hash_password(payload.password.get_secret_value()),
        admin_permissions=await role_grants(db, company_id, payload.role),
    )
    try:
        db.add(row)
        await db.flush()
        if company_id:
            db.add(CompanyMembership(user_id=row.id, company_id=company_id))
        if is_employee_role(row.role):
            db.add(
                Employment(
                    user_id=row.id,
                    company_id=company_id,
                    title=payload.job_title or "Nhân viên",
                    start_date=datetime.now(UTC),
                    status=EmploymentStatus.ACTIVE,
                )
            )
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, "Email đã tồn tại hoặc dữ liệu không hợp lệ") from None
    return row


@router.patch("/users/{user_id}", response_model=AccountRead)
async def patch_account(
    user_id: uuid.UUID, payload: AccountPatch, db: DbSession, actor: CurrentUser
):
    require(actor, Permission.PEOPLE_WRITE)
    row = await db.scalar(select(User).where(User.id == user_id).with_for_update())
    if row is None or (actor.role != Role.SUPER_ADMIN and row.company_id != actor.company_id):
        raise HTTPException(404, "Không tìm thấy tài khoản")
    if (
        row.id == actor.id
        or not can_manage_role(actor.role, row.role)
        or not can_manage_role(actor.role, payload.role)
    ):
        raise HTTPException(403, "Không được chỉnh quyền chính mình hoặc tài khoản ngang/cao hơn")
    if (row.role == Role.SUPER_ADMIN) != (payload.role == Role.SUPER_ADMIN):
        raise HTTPException(422, "Không thể chuyển tài khoản giữa phạm vi hệ thống và công ty")
    if row.version != payload.expected_version:
        raise HTTPException(409, "Tài khoản đã thay đổi; hãy tải lại")
    if not payload.name.strip():
        raise HTTPException(422, "Tên không được trống")
    if row.role != payload.role:
        row.admin_permissions = await role_grants(db, row.company_id, payload.role)
    row.email, row.name, row.job_title = (
        str(payload.email).casefold(),
        payload.name.strip(),
        payload.job_title,
    )
    row.role, row.is_active, row.version = payload.role, payload.is_active, row.version + 1
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, "Email đã tồn tại hoặc dữ liệu không hợp lệ") from None
    return row


class RoleGrantsRead(ApiModel):
    role: Role
    permissions: list[AdminPermission]
    version: int


class RoleGrantsPatch(ApiModel):
    expected_version: int = Field(ge=0)
    permissions: list[AdminPermission] = Field(max_length=7)


@router.get("/roles", response_model=list[RoleGrantsRead])
async def list_roles(
    db: DbSession, actor: CurrentUser, company_id: uuid.UUID | None = Query(None, alias="companyId")
):
    require(actor, Permission.ROLES_MANAGE)
    scope = await resolve_company_scope(db, actor, company_id)
    rows = {
        row.role: row
        for row in (
            await db.scalars(
                select(CompanyRoleDefinition).where(CompanyRoleDefinition.company_id == scope)
            )
        ).all()
    }
    return [
        RoleGrantsRead(
            role=role,
            permissions=rows[role].permissions if role in rows else DEFAULT_GRANTS[role],
            version=rows[role].version if role in rows else 0,
        )
        for role in DEFAULT_GRANTS
    ]


@router.patch("/roles/{role}", response_model=RoleGrantsRead)
async def patch_role(
    role: Role,
    payload: RoleGrantsPatch,
    db: DbSession,
    actor: CurrentUser,
    company_id: uuid.UUID | None = Query(None, alias="companyId"),
):
    require(actor, Permission.ROLES_MANAGE)
    if role not in DEFAULT_GRANTS:
        raise HTTPException(403, "Chỉ được chỉnh quyền của vai trò HR/BOD")
    if actor.role in {Role.BOD, Role.HR} and not can_delegate_admin_grants(
        actor, payload.permissions
    ):
        raise HTTPException(403, "Không được cấp quyền mà chính bạn không có")
    scope = await resolve_company_scope(db, actor, company_id)
    # Lock company to serialize creation of the first role definition as well.
    company = await db.scalar(select(Company).where(Company.id == scope).with_for_update())
    if company is None:
        raise HTTPException(404, "Không tìm thấy công ty")
    row = await db.scalar(
        select(CompanyRoleDefinition).where(
            CompanyRoleDefinition.company_id == scope, CompanyRoleDefinition.role == role.value
        )
    )
    if (row.version if row else 0) != payload.expected_version:
        raise HTTPException(409, "Quyền đã thay đổi; hãy tải lại")
    grants = sorted({item.value for item in payload.permissions})
    if row is None:
        row = CompanyRoleDefinition(
            company_id=scope, role=role.value, permissions=grants, version=1
        )
        db.add(row)
    else:
        row.permissions, row.version = grants, row.version + 1
    await db.execute(
        update(User)
        .where(User.company_id == scope, User.role == role)
        .values(admin_permissions=grants, version=User.version + 1)
    )
    await db.commit()
    return RoleGrantsRead(role=role, permissions=grants, version=row.version)


class PasswordReset(ApiModel):
    password: SecretStr = Field(min_length=12, max_length=256)
    current_password: SecretStr | None = Field(default=None, min_length=1, max_length=256)


class PasswordResetRead(ApiModel):
    id: uuid.UUID
    sessions_revoked: bool = True


@router.post("/users/{user_id}/reset-password", response_model=PasswordResetRead)
async def reset_password(
    user_id: uuid.UUID, payload: PasswordReset, db: DbSession, actor: CurrentUser
):
    row = await db.scalar(select(User).where(User.id == user_id).with_for_update())
    if row is None:
        raise HTTPException(404, "Không tìm thấy tài khoản")
    if row.id == actor.id:
        if (
            payload.current_password is None
            or not verify_and_upgrade_password(
                payload.current_password.get_secret_value(), row.hashed_password
            )[0]
        ):
            raise HTTPException(403, "Cần mật khẩu hiện tại hợp lệ để đổi mật khẩu")
    else:
        require(actor, Permission.PEOPLE_WRITE)
        if not can_manage_role(actor.role, row.role) or (
            actor.role != Role.SUPER_ADMIN and actor.company_id != row.company_id
        ):
            raise HTTPException(403, "Không được đặt lại mật khẩu tài khoản này")
    row.hashed_password = hash_password(payload.password.get_secret_value())
    row.version += 1
    await db.execute(
        update(AuthSession)
        .where(AuthSession.user_id == row.id, AuthSession.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )
    await db.commit()
    return PasswordResetRead(id=row.id)
