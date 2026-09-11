from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.api.v2.dependencies import CurrentAuthentication, CurrentUser, DbSession
from app.core.config import get_settings
from app.core.database import async_session
from app.domain.models import User
from app.domain.schemas import (
    LoginRequest,
    LoginResponse,
    MeResponse,
    MessageResponse,
    SessionUserRead,
)
from app.security.permissions import effective_permissions
from app.security.rate_limit import (
    InMemoryLoginRateLimiter,
    LoginRateLimiter,
    PostgresLoginRateLimiter,
    RateLimiterUnavailable,
    derive_rate_limit_secret,
)
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])
_settings = get_settings()
_rate_limit_secret = derive_rate_limit_secret(_settings.jwt_secret.get_secret_value())
if _settings.database_url.startswith(("postgresql://", "postgresql+asyncpg://")):
    _login_rate_limiter: LoginRateLimiter = PostgresLoginRateLimiter(
        async_session,
        _settings.login_rate_limit_attempts,
        _settings.login_rate_limit_ip_attempts,
        _settings.login_rate_limit_window_seconds,
        key_hmac_secret=_rate_limit_secret,
    )
else:
    _login_rate_limiter = InMemoryLoginRateLimiter(
        _settings.login_rate_limit_attempts,
        _settings.login_rate_limit_window_seconds,
        _settings.login_rate_limit_max_keys,
        ip_max_attempts=_settings.login_rate_limit_ip_attempts,
        key_hmac_secret=_rate_limit_secret,
    )


def get_login_rate_limiter() -> LoginRateLimiter:
    return _login_rate_limiter


RateLimiter = Annotated[LoginRateLimiter, Depends(get_login_rate_limiter)]


def session_user(user: User) -> SessionUserRead:
    permissions = sorted(effective_permissions(user), key=lambda permission: permission.value)
    name_parts = [part for part in user.name.split() if part]
    initials = "".join(part[0].upper() for part in name_parts[-2:]) or "CM"
    return SessionUserRead(
        id=user.id,
        email=user.email,
        name=user.name,
        title=user.job_title or "Nhân viên",
        company_name=user.company.name if user.company else "CareerMate",
        role=user.role,
        company_id=user.company_id,
        permissions=permissions,
        initials=initials,
    )


@router.post(
    "/login",
    response_model=LoginResponse,
    response_model_by_alias=True,
    responses={status.HTTP_401_UNAUTHORIZED: {"description": "Sai thông tin đăng nhập"}},
)
async def login(
    payload: LoginRequest,
    request: Request,
    db: DbSession,
    limiter: RateLimiter,
) -> LoginResponse:
    normalized_email = str(payload.email).strip().casefold()
    client_ip = request.client.host if request.client is not None else "unknown"
    try:
        decision = await limiter.acquire(normalized_email, client_ip)
    except RateLimiterUnavailable as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Dịch vụ đăng nhập tạm thời không khả dụng.",
            headers={"Retry-After": "1"},
        ) from error
    if not decision.allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Quá nhiều lần đăng nhập. Vui lòng thử lại sau.",
            headers={"Retry-After": str(decision.retry_after_seconds)},
        )
    result = await AuthService(db).login(
        normalized_email, payload.password, getattr(request.state, "request_id", None)
    )
    if result is None:
        raise HTTPException(status_code=401, detail="Email hoặc mật khẩu không đúng")
    try:
        await limiter.reset_account(normalized_email)
    except RateLimiterUnavailable:
        # Authentication and session creation already committed. Keeping the
        # account bucket is the safe failure mode and the issued token remains usable.
        pass
    return LoginResponse(
        access_token=result.access_token,
        user=session_user(result.user),
    )


@router.post("/logout", response_model=MessageResponse)
async def logout(
    authentication: CurrentAuthentication, request: Request, db: DbSession
) -> MessageResponse:
    await AuthService(db).logout(
        authentication.user,
        authentication.session,
        getattr(request.state, "request_id", None),
    )
    return MessageResponse(message="Đã đăng xuất")


@router.get("/me", response_model=MeResponse)
async def me(current_user: CurrentUser) -> MeResponse:
    return MeResponse(user=session_user(current_user))
