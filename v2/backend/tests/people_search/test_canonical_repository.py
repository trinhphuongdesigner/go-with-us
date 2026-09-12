"""The default canonical seam never substitutes mutable rows or synthetic facts."""

from dataclasses import FrozenInstanceError
from importlib.util import find_spec
from uuid import UUID

import pytest

from app.people_search.intent_models import ResolvedSearchIntent


def test_canonical_repository_exists():
    assert find_spec("app.people_search.canonical_repository") is not None


async def test_default_repository_explicitly_reports_unavailable():
    from app.people_search.canonical_repository import UnavailableCanonicalRepository

    batch = await UnavailableCanonicalRepository().load(
        ResolvedSearchIntent(), tenant_id=UUID(int=1), actor_id=UUID(int=2)
    )
    assert batch is None


def test_profile_identity_is_frozen():
    from app.people_search.canonical_repository import CandidateProfile

    profile = CandidateProfile(UUID(int=3), UUID(int=1), "Synthetic Person", None)
    with pytest.raises(FrozenInstanceError):
        profile.tenant_id = UUID(int=9)


def test_candidate_batch_is_frozen():
    from app.ai.gateway import EvidenceContext
    from app.people_search.canonical_repository import CanonicalCandidateBatch

    context = EvidenceContext(tenant_id=UUID(int=1), actor_id=UUID(int=2))
    batch = CanonicalCandidateBatch((), (), context)
    with pytest.raises(FrozenInstanceError):
        batch.profiles = ()
