from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.enums import CompanyStatus
from app.domain.models import AuthSession, User, utc_now
from app.repositories.activity_repo import ActivityLogRepository
from app.repositories.auth_session_repo import AuthSessionRepository
from app.repositories.user_repo import UserRepository
from app.security.jwt import (
    hash_jti,
    hash_password,
    issue_access_token,
    verify_and_upgrade_password,
)

_DUMMY_PASSWORD_HASH = hash_password("careermate-auth-timing-placeholder")


@dataclass(frozen=True)
class LoginResult:
    access_token: str
    user: User


class AuthService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.user_repo = UserRepository(session)
        self.activity_repo = ActivityLogRepository(session)
        self.auth_session_repo = AuthSessionRepository(session)

    async def login(self, email: str, password: str, request_id: str | None) -> LoginResult | None:
        normalized_email = email.strip().casefold()
        user = await self.user_repo.get_by_email(normalized_email)
        if user is None:
            verify_and_upgrade_password(password, _DUMMY_PASSWORD_HASH)
            return None

        valid, upgraded_hash = verify_and_upgrade_password(password, user.hashed_password)
        if (
            not valid
            or not user.is_active
            or (user.company is not None and user.company.status != CompanyStatus.ACTIVE)
        ):
            return None

        try:
            if upgraded_hash is not None:
                user.hashed_password = upgraded_hash
            issued_token = issue_access_token(user.id)
            await self.auth_session_repo.add(
                AuthSession(
                    user_id=user.id,
                    company_id=user.company_id,
                    jti_hash=hash_jti(issued_token.jti),
                    expires_at=issued_token.expires_at,
                )
            )
            await self.activity_repo.log(
                actor_id=user.id,
                company_id=user.company_id,
                action="auth.login",
                entity_type="user",
                entity_id=str(user.id),
                changes={},
                request_id=request_id,
            )
            await self.session.commit()
            return LoginResult(access_token=issued_token.encoded, user=user)
        except Exception:
            await self.session.rollback()
            raise

    async def logout(self, user: User, auth_session: AuthSession, request_id: str | None) -> None:
        if auth_session.user_id != user.id or auth_session.company_id != user.company_id:
            raise PermissionError("Authentication session does not belong to the current user")
        try:
            auth_session.revoked_at = utc_now()
            await self.activity_repo.log(
                actor_id=user.id,
                company_id=user.company_id,
                action="auth.logout",
                entity_type="user",
                entity_id=str(user.id),
                changes={},
                request_id=request_id,
            )
            await self.session.commit()
        except Exception:
            await self.session.rollback()
            raise
