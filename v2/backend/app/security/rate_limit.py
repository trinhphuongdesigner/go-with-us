import asyncio
import hashlib
import hmac
import math
import time
from collections import OrderedDict, deque
from collections.abc import Callable
from dataclasses import dataclass
from datetime import timedelta
from typing import Protocol

from sqlalchemy import case, delete, func
from sqlalchemy.dialects.postgresql import insert as postgres_insert
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.domain.models import LoginRateLimit


@dataclass(frozen=True)
class RateLimitDecision:
    allowed: bool
    retry_after_seconds: int = 0


class RateLimiterUnavailable(RuntimeError):
    """Raised when the shared limiter cannot safely authorize password work."""


class LoginRateLimiter(Protocol):
    """Shared boundary for account-wide and address-wide login throttling."""

    async def acquire(self, account_identifier: str, client_ip: str) -> RateLimitDecision: ...

    async def reset_account(self, account_identifier: str) -> None: ...


class InMemoryLoginRateLimiter:
    def __init__(
        self,
        max_attempts: int,
        window_seconds: int,
        max_keys: int,
        *,
        ip_max_attempts: int | None = None,
        key_hmac_secret: bytes = b"careermate-local-login-rate-limit",
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._account_max_attempts = max_attempts
        self._ip_max_attempts = ip_max_attempts or max_attempts * 10
        self._window_seconds = window_seconds
        self._max_keys = max_keys
        self._key_hmac_secret = key_hmac_secret
        self._clock = clock
        self._attempts: OrderedDict[str, deque[float]] = OrderedDict()
        self._lock = asyncio.Lock()

    @property
    def tracked_key_count(self) -> int:
        return len(self._attempts)

    async def acquire(self, account_identifier: str, client_ip: str) -> RateLimitDecision:
        async with self._lock:
            now = self._clock()
            ip_decision = self._acquire_bucket(
                self._bucket_key("ip", client_ip), self._ip_max_attempts, now
            )
            if not ip_decision.allowed:
                return ip_decision
            return self._acquire_bucket(
                self._bucket_key("account", account_identifier),
                self._account_max_attempts,
                now,
            )

    async def reset_account(self, account_identifier: str) -> None:
        async with self._lock:
            self._attempts.pop(self._bucket_key("account", account_identifier), None)

    def _acquire_bucket(self, key: str, max_attempts: int, now: float) -> RateLimitDecision:
        attempts = self._attempts.get(key)
        if attempts is not None:
            self._discard_expired(attempts, now)
            if not attempts:
                del self._attempts[key]
                attempts = None

        if attempts is not None and len(attempts) >= max_attempts:
            self._attempts.move_to_end(key)
            retry_after = max(1, math.ceil(attempts[0] + self._window_seconds - now))
            return RateLimitDecision(False, retry_after)

        if attempts is None:
            attempts = deque()
            self._attempts[key] = attempts
        attempts.append(now)
        self._attempts.move_to_end(key)
        while len(self._attempts) > self._max_keys:
            self._attempts.popitem(last=False)
        return RateLimitDecision(True)

    def _bucket_key(self, scope: str, identifier: str) -> str:
        return opaque_bucket_key(self._key_hmac_secret, scope, identifier)

    def _discard_expired(self, attempts: deque[float], now: float) -> None:
        cutoff = now - self._window_seconds
        while attempts and attempts[0] <= cutoff:
            attempts.popleft()


class PostgresLoginRateLimiter:
    """Atomic fixed-window counters shared by every application worker."""

    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession],
        account_max_attempts: int,
        ip_max_attempts: int,
        window_seconds: int,
        *,
        key_hmac_secret: bytes,
    ) -> None:
        self._session_factory = session_factory
        self._account_max_attempts = account_max_attempts
        self._ip_max_attempts = ip_max_attempts
        self._window_seconds = window_seconds
        self._key_hmac_secret = key_hmac_secret

    async def acquire(self, account_identifier: str, client_ip: str) -> RateLimitDecision:
        try:
            async with self._session_factory.begin() as session:
                await self._delete_expired_buckets(session)
                ip_decision = await self._acquire_bucket(
                    session,
                    opaque_bucket_key(self._key_hmac_secret, "ip", client_ip),
                    self._ip_max_attempts,
                )
                if not ip_decision.allowed:
                    return ip_decision
                return await self._acquire_bucket(
                    session,
                    opaque_bucket_key(
                        self._key_hmac_secret,
                        "account",
                        account_identifier,
                    ),
                    self._account_max_attempts,
                )
        except SQLAlchemyError as error:
            raise RateLimiterUnavailable("Shared login rate limiter is unavailable") from error

    async def _delete_expired_buckets(self, session: AsyncSession) -> None:
        await session.execute(
            delete(LoginRateLimit).where(
                LoginRateLimit.window_started_at
                <= func.clock_timestamp() - timedelta(seconds=self._window_seconds)
            )
        )

    async def reset_account(self, account_identifier: str) -> None:
        try:
            async with self._session_factory.begin() as session:
                await session.execute(
                    delete(LoginRateLimit).where(
                        LoginRateLimit.bucket_key
                        == opaque_bucket_key(
                            self._key_hmac_secret,
                            "account",
                            account_identifier,
                        )
                    )
                )
        except SQLAlchemyError as error:
            raise RateLimiterUnavailable("Shared login rate limiter is unavailable") from error

    async def _acquire_bucket(
        self,
        session: AsyncSession,
        bucket_key: str,
        max_attempts: int,
    ) -> RateLimitDecision:
        window = timedelta(seconds=self._window_seconds)
        database_now = func.clock_timestamp()
        expired = LoginRateLimit.window_started_at <= database_now - window
        statement = (
            postgres_insert(LoginRateLimit)
            .values(
                bucket_key=bucket_key,
                attempts=1,
                window_started_at=database_now,
            )
            .on_conflict_do_update(
                index_elements=[LoginRateLimit.bucket_key],
                set_={
                    "attempts": case(
                        (expired, 1),
                        else_=LoginRateLimit.attempts + 1,
                    ),
                    "window_started_at": case(
                        (expired, database_now),
                        else_=LoginRateLimit.window_started_at,
                    ),
                },
            )
            .returning(
                LoginRateLimit.attempts,
                func.greatest(
                    1,
                    func.ceil(
                        func.extract(
                            "epoch",
                            LoginRateLimit.window_started_at + window - database_now,
                        )
                    ),
                ).label("retry_after_seconds"),
            )
        )
        row = (await session.execute(statement)).one()
        attempts = int(row.attempts)
        if attempts > max_attempts:
            return RateLimitDecision(False, int(row.retry_after_seconds))
        return RateLimitDecision(True)


def derive_rate_limit_secret(application_secret: str) -> bytes:
    return hmac.new(
        application_secret.encode(),
        b"careermate-v2/login-rate-limit/key/v1",
        hashlib.sha256,
    ).digest()


def opaque_bucket_key(secret: bytes, scope: str, identifier: str) -> str:
    digest = hmac.new(
        secret,
        f"{scope}:{identifier}".encode(),
        hashlib.sha256,
    ).hexdigest()
    return f"{scope}:{digest}"
