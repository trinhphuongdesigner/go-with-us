from __future__ import annotations

import asyncio
import random
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from enum import StrEnum

Sleep = Callable[[float], Awaitable[None]]
Jitter = Callable[[float, int], float]
Clock = Callable[[], float]


@dataclass(frozen=True, slots=True)
class RetryPolicy:
    """Bounded transient retry policy; ``max_attempts`` includes the first call."""

    max_attempts: int = 2
    base_delay_seconds: float = 0.1
    max_delay_seconds: float = 1.0

    def __post_init__(self) -> None:
        if not 1 <= self.max_attempts <= 3:
            raise ValueError("max_attempts must be between 1 and 3")
        if self.base_delay_seconds < 0:
            raise ValueError("base_delay_seconds must not be negative")
        if self.max_delay_seconds < self.base_delay_seconds:
            raise ValueError("max_delay_seconds must be at least base_delay_seconds")

    def delay_before(self, retry_number: int) -> float:
        if retry_number < 1:
            raise ValueError("retry_number starts at 1")
        return float(
            min(self.base_delay_seconds * (2 ** (retry_number - 1)), self.max_delay_seconds)
        )


def full_jitter(delay: float, retry_number: int) -> float:
    del retry_number
    return float(random.uniform(0, delay))


async def async_sleep(delay: float) -> None:
    await asyncio.sleep(delay)


class CircuitState(StrEnum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class CircuitBreaker:
    """Small provider-local circuit breaker with an injectable monotonic clock."""

    def __init__(
        self,
        *,
        failure_threshold: int = 3,
        recovery_timeout_seconds: float = 30,
        clock: Clock = time.monotonic,
    ) -> None:
        if failure_threshold < 1:
            raise ValueError("failure_threshold must be positive")
        if recovery_timeout_seconds < 0:
            raise ValueError("recovery_timeout_seconds must not be negative")
        self._failure_threshold = failure_threshold
        self._recovery_timeout_seconds = recovery_timeout_seconds
        self._clock = clock
        self._failure_count = 0
        self._opened_at: float | None = None
        self._state = CircuitState.CLOSED

    @property
    def state(self) -> CircuitState:
        return self._state

    def allow_request(self) -> bool:
        if self._state == CircuitState.CLOSED:
            return True
        if self._state == CircuitState.HALF_OPEN:
            return False
        assert self._opened_at is not None
        if self._clock() - self._opened_at < self._recovery_timeout_seconds:
            return False
        self._state = CircuitState.HALF_OPEN
        return True

    def record_success(self) -> None:
        self._failure_count = 0
        self._opened_at = None
        self._state = CircuitState.CLOSED

    def record_failure(self) -> None:
        self._failure_count += 1
        if self._state == CircuitState.HALF_OPEN or self._failure_count >= self._failure_threshold:
            self._state = CircuitState.OPEN
            self._opened_at = self._clock()
