"""Explicit company access memberships, independent of current employment ownership."""

import uuid

from fastapi import APIRouter, HTTPException
from sqlalchemy import ForeignKey, Index, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from app.api.v2.dependencies import CurrentUser, DbSession
from app.core.database import Base
from app.domain.enums import CompanyStatus, Role
from app.domain.models import Company, TimestampMixin, User
from app.domain.schemas import ApiModel


class CompanyMembership(TimestampMixin, Base):
    __tablename__ = "company_memberships"
    __table_args__ = (Index("ix_company_memberships_company", "company_id"),)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), primary_key=True
    )


async def resolve_company_scope(
    db: AsyncSession,
    actor: User,
    explicit_company_id: uuid.UUID | None,
    require_explicit_super: bool = True,
) -> uuid.UUID | None:
    """Recheck membership on every explicit selection; never rewrite actor.company_id."""
    if not actor.is_active:
        raise HTTPException(403, "Tài khoản không hoạt động")
    scope = explicit_company_id
    if actor.role == Role.SUPER_ADMIN:
        if explicit_company_id is None:
            if require_explicit_super:
                raise HTTPException(400, "Hãy chọn công ty")
            return None
    elif explicit_company_id is None:
        scope = actor.company_id
        if scope is None:
            raise HTTPException(403, "Tài khoản chưa có công ty hiện tại")
    else:
        scope = explicit_company_id
        membership = await db.scalar(
            select(CompanyMembership.user_id).where(
                CompanyMembership.user_id == actor.id, CompanyMembership.company_id == scope
            )
        )
        if membership is None:
            raise HTTPException(403, "Bạn không còn là thành viên của công ty đã chọn")
    if scope is None:
        raise HTTPException(403, "Tài khoản chưa có công ty hiện tại")
    company = await db.get(Company, scope)
    if company is None or company.status != CompanyStatus.ACTIVE:
        raise HTTPException(404, "Công ty không tồn tại hoặc đã ngừng hoạt động")
    return scope


router = APIRouter(prefix="/company-memberships", tags=["company-memberships"])


class MembershipCompanyRead(ApiModel):
    id: uuid.UUID
    name: str
    industry: str | None = None


class MemberRead(ApiModel):
    user_id: uuid.UUID
    name: str
    email: str
    role: Role
    job_title: str | None = None


class AddMember(ApiModel):
    user_id: uuid.UUID


class MembershipRead(ApiModel):
    company_id: uuid.UUID
    user_id: uuid.UUID


async def company_brief(db: AsyncSession, company: Company) -> MembershipCompanyRead:
    from app.organization import CompanyDetails

    details = await db.get(CompanyDetails, company.id)
    return MembershipCompanyRead(
        id=company.id, name=company.name, industry=details.industry if details else None
    )


def require_membership_manager(actor: User, company_id: uuid.UUID) -> None:
    if actor.role == Role.SUPER_ADMIN:
        return
    if actor.role != Role.COMPANY_ADMIN or actor.company_id != company_id:
        raise HTTPException(
            403, "Chỉ quản trị hệ thống hoặc quản trị công ty này được quản lý thành viên"
        )


@router.get("/mine", response_model=list[MembershipCompanyRead])
async def mine(db: DbSession, actor: CurrentUser):
    rows = await db.scalars(
        select(Company)
        .join(CompanyMembership, CompanyMembership.company_id == Company.id)
        .where(CompanyMembership.user_id == actor.id, Company.status == CompanyStatus.ACTIVE)
        .order_by(Company.name, Company.id)
    )
    return [await company_brief(db, row) for row in rows]


@router.get("/{company_id}", response_model=MembershipCompanyRead)
async def company_for_member(company_id: uuid.UUID, db: DbSession, actor: CurrentUser):
    await resolve_company_scope(db, actor, company_id)
    company = await db.get(Company, company_id)
    if company is None:
        raise HTTPException(404, "Không tìm thấy công ty")
    return await company_brief(db, company)


@router.get("/{company_id}/members", response_model=list[MemberRead])
async def members(company_id: uuid.UUID, db: DbSession, actor: CurrentUser):
    require_membership_manager(actor, company_id)
    company = await db.get(Company, company_id)
    if company is None:
        raise HTTPException(404, "Không tìm thấy công ty")
    rows = await db.scalars(
        select(User)
        .join(CompanyMembership, CompanyMembership.user_id == User.id)
        .where(CompanyMembership.company_id == company_id)
        .order_by(User.name, User.id)
    )
    return [
        MemberRead(
            user_id=row.id, name=row.name, email=row.email, role=row.role, job_title=row.job_title
        )
        for row in rows
    ]


@router.post("/{company_id}/members", response_model=MembershipRead)
async def add_member(company_id: uuid.UUID, payload: AddMember, db: DbSession, actor: CurrentUser):
    require_membership_manager(actor, company_id)
    company = await db.scalar(select(Company).where(Company.id == company_id).with_for_update())
    if company is None or company.status != CompanyStatus.ACTIVE:
        raise HTTPException(404, "Công ty không hoạt động")
    target = await db.get(User, payload.user_id)
    if target is None or not target.is_active:
        raise HTTPException(404, "Tài khoản không tồn tại hoặc không hoạt động")
    membership = await db.get(CompanyMembership, (target.id, company_id))
    if membership is None:
        db.add(CompanyMembership(user_id=target.id, company_id=company_id))
    await db.commit()
    return MembershipRead(company_id=company_id, user_id=target.id)


@router.delete("/{company_id}/members/{user_id}", response_model=MembershipRead)
async def remove_member(
    company_id: uuid.UUID, user_id: uuid.UUID, db: DbSession, actor: CurrentUser
):
    require_membership_manager(actor, company_id)
    company = await db.scalar(select(Company).where(Company.id == company_id).with_for_update())
    if company is None:
        raise HTTPException(404, "Không tìm thấy công ty")
    membership = await db.get(CompanyMembership, (user_id, company_id))
    if membership is not None:
        await db.delete(membership)
    await db.commit()
    return MembershipRead(company_id=company_id, user_id=user_id)
