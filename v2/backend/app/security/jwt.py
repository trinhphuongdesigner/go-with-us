import hashlib
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
import jwt
from pwdlib import PasswordHash
from pwdlib.exceptions import PwdlibError

from app.core.config import get_settings

password_hash = PasswordHash.recommended()


@dataclass(frozen=True)
class IssuedAccessToken:
    encoded: str
    jti: uuid.UUID
    expires_at: datetime


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_and_upgrade_password(password: str, encoded: str) -> tuple[bool, str | None]:
    if encoded.startswith(("$2a$", "$2b$", "$2y$")):
        password_bytes = password.encode()
        # bcrypt only accepts the first 72 bytes. bcrypt 5 raises instead of
        # silently truncating, so fail closed for legacy hashes and let the API
        # return the same generic authentication error.
        if len(password_bytes) > 72:
            return False, None
        try:
            valid = bcrypt.checkpw(password_bytes, encoded.encode())
        except ValueError:
            return False, None
        return valid, hash_password(password) if valid else None
    try:
        return password_hash.verify(password, encoded), None
    except (PwdlibError, ValueError):
        return False, None


def hash_jti(jti: uuid.UUID) -> str:
    return hashlib.sha256(str(jti).encode()).hexdigest()


def issue_access_token(
    subject: uuid.UUID, expires_delta: timedelta | None = None
) -> IssuedAccessToken:
    settings = get_settings()
    now = datetime.now(UTC)
    expires_at = now + (expires_delta or timedelta(minutes=settings.access_token_expire_minutes))
    token_id = uuid.uuid4()
    payload: dict[str, Any] = {
        "sub": str(subject),
        "iat": now,
        "exp": expires_at,
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_audience,
        "jti": str(token_id),
    }
    return IssuedAccessToken(
        encoded=jwt.encode(
            payload,
            settings.jwt_secret.get_secret_value(),
            algorithm=settings.jwt_algorithm,
        ),
        jti=token_id,
        expires_at=expires_at,
    )


def decode_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    return jwt.decode(
        token,
        settings.jwt_secret.get_secret_value(),
        algorithms=[settings.jwt_algorithm],
        audience=settings.jwt_audience,
        issuer=settings.jwt_issuer,
        options={"require": ["sub", "iat", "exp", "iss", "aud", "jti"]},
    )
