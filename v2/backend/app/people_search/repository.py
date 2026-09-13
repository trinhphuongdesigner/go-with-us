"""Read-only tenant-scoped candidate projection for people search."""

from __future__ import annotations

import uuid
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, with_loader_criteria

from app.domain.enums import EmploymentStatus
from app.domain.models import Employment, User
from app.security.roles import EMPLOYEE_ROLES

Now = Callable[[], datetime]


@dataclass(frozen=True, slots=True)
class CandidateProjection:
    """Canonical ranking boundary. Missing W1 fields stay explicitly absent."""

    user: User
    employments: tuple[Employment, ...]
    total_experience_years: float
    updated_at: datetime
    canonical_skill_ids: frozenset[uuid.UUID] | None = None
    skill_experience_years: dict[uuid.UUID, float] | None = None
    domains: frozenset[str] | None = None
    availability: str | None = None


CandidateRow = CandidateProjection


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def experience_years(employments: Iterable[Employment], *, now: datetime) -> float:
    """Merge overlapping intervals; reject impossible source dates."""
    instant = _aware(now)
    intervals: list[tuple[datetime, datetime]] = []
    for employment in employments:
        start = _aware(employment.start_date)
        end = _aware(employment.end_date) if employment.end_date else instant
        if start > instant or end > instant or end < start:
            raise ValueError("employment interval is future-dated or reversed")
        intervals.append((start, end))
    intervals.sort()
    merged: list[tuple[datetime, datetime]] = []
    for start, end in intervals:
        if merged and start <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))
    return round(sum((end - start).total_seconds() for start, end in merged) / 31_557_600, 2)


async def search_candidates(
    session: AsyncSession,
    *,
    company_id: uuid.UUID,
    title_terms: list[str] | None = None,
    required_terms: list[str] | None = None,
    preferred_terms: list[str] | None = None,
    min_total_experience_years: float | None = None,
    limit: int | None = 25,
    now: Now = lambda: datetime.now(UTC),
) -> list[CandidateProjection]:
    """Apply tenant, eligibility, and honest hard filters before top-k."""
    del preferred_terms  # preferences rank only
    required = required_terms if required_terms is not None else (title_terms or [])
    active_employment = exists().where(
        Employment.user_id == User.id,
        Employment.company_id == company_id,
        Employment.status == EmploymentStatus.ACTIVE,
    )
    stmt = (
        select(User)
        .options(
            selectinload(User.employments),
            with_loader_criteria(Employment, Employment.company_id == company_id),
        )
        .where(
            User.company_id == company_id,
            User.role.in_(EMPLOYEE_ROLES),
            User.is_active.is_(True),
            active_employment,
        )
    )
    for term in required:
        pattern = f"%{term.casefold()}%"
        employment_title_match = exists().where(
            Employment.user_id == User.id,
            Employment.company_id == company_id,
            func.lower(Employment.title).like(pattern),
        )
        stmt = stmt.where(
            or_(func.lower(func.coalesce(User.job_title, "")).like(pattern), employment_title_match)
        )

    users = (await session.execute(stmt.order_by(func.lower(User.name), User.id))).scalars().all()
    instant = now()
    rows: list[CandidateProjection] = []
    for user in users:
        employments = tuple(e for e in user.employments if e.company_id == company_id)
        try:
            years = experience_years(employments, now=instant)
        except ValueError:
            # Invalid source dates cannot become ranking evidence or break valid tenant results.
            continue
        if min_total_experience_years is not None and years < min_total_experience_years:
            continue
        latest_update = max(
            _aware(v) for v in [user.updated_at, *(e.updated_at for e in employments)]
        )
        rows.append(CandidateProjection(user, employments, years, latest_update))
    return rows if limit is None else rows[:limit]
