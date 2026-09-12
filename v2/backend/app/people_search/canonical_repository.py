"""Read-only canonical staffing seam; no W1 database implementation exists yet.

Future adapters load authorized canonical facts and original immutable source
blocks. They own verified value lineage and SQL tenant/employment/permission/hard
filters before retrieval; they must not truncate before complete ranking. Mutable
profile labels are for display only and never manufacture ranking evidence.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol
from uuid import UUID

from app.ai.gateway import EvidenceContext
from app.people_search.canonical_ranking import StaffingCandidate
from app.people_search.intent_models import ResolvedSearchIntent


@dataclass(frozen=True, slots=True)
class CandidateProfile:
    candidate_id: UUID
    tenant_id: UUID
    name: str
    title: str | None


@dataclass(frozen=True, slots=True)
class CanonicalCandidateBatch:
    candidates: tuple[StaffingCandidate, ...]
    profiles: tuple[CandidateProfile, ...]
    context: EvidenceContext


class CanonicalRepository(Protocol):
    async def load(
        self, intent: ResolvedSearchIntent, *, tenant_id: UUID, actor_id: UUID
    ) -> CanonicalCandidateBatch | None:
        """Return a complete authorized projection, or None when W1 is unavailable."""
        ...


class UnavailableCanonicalRepository:
    async def load(
        self, intent: ResolvedSearchIntent, *, tenant_id: UUID, actor_id: UUID
    ) -> CanonicalCandidateBatch | None:
        """Never substitute mutable title/tenure rows for canonical staffing facts."""
        return None
