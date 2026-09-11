import uuid
from collections.abc import Callable, Coroutine
from dataclasses import dataclass
from typing import Annotated, Any

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.domain.enums import CompanyStatus, Permission, Role
from app.domain.models import AuthSession, User, validate_user_tenant_invariant
from app.repositories.auth_session_repo import AuthSessionRepository
from app.repositories.user_repo import UserRepository
from app.security.jwt import decode_token, hash_jti

bearer_scheme = HTTPBearer(auto_error=False)
DbSession = Annotated[AsyncSession, Depends(get_db)]


@dataclass(frozen=True)
class AuthenticationContext:
    user: User
    session: AuthSession


async def get_authentication_context(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: DbSession,
) -> AuthenticationContext:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Không thể xác thực phiên đăng nhập",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None or credentials.scheme.casefold() != "bearer":
        raise unauthorized
    try:
        claims = decode_token(credentials.credentials)
        user_id = uuid.UUID(str(claims.get("sub")))
        token_id = uuid.UUID(str(claims.get("jti")))
    except (jwt.PyJWTError, TypeError, ValueError):
        raise unauthorized from None

    auth_session = await AuthSessionRepository(db).get_active(user_id, hash_jti(token_id))
    if auth_session is None:
        raise unauthorized
    user = await UserRepository(db).get_by_id(user_id)
    if user is None or not user.is_active:
        raise unauthorized
    if user.company is not None and user.company.status != CompanyStatus.ACTIVE:
        raise unauthorized
    try:
        validate_user_tenant_invariant(user)
    except ValueError:
        raise unauthorized from None
    if auth_session.company_id != user.company_id:
        raise unauthorized
    return AuthenticationContext(user=user, session=auth_session)


CurrentAuthentication = Annotated[AuthenticationContext, Depends(get_authentication_context)]


async def get_current_user(authentication: CurrentAuthentication) -> User:
    return authentication.user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_role(
    *roles: Role,
) -> Callable[[CurrentUser], Coroutine[Any, Any, User]]:
    async def checker(current_user: CurrentUser) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn không có quyền thực hiện thao tác này",
            )
        return current_user

    return checker


def require_permission(
    permission: Permission,
) -> Callable[[CurrentUser], Coroutine[Any, Any, User]]:
    from app.security.permissions import effective_permissions

    async def checker(current_user: CurrentUser) -> User:
        if permission not in effective_permissions(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn không có quyền thực hiện thao tác này",
            )
        return current_user

    return checker


async def get_tenant_company_id(current_user: CurrentUser) -> uuid.UUID | None:
    if current_user.role != Role.SUPER_ADMIN and current_user.company_id is None:
        raise HTTPException(status_code=403, detail="Tài khoản chưa thuộc doanh nghiệp")
    return current_user.company_id
