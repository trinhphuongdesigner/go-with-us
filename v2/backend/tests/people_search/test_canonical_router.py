"""Real auth/router/compiler/ranker, synthetic provider and canonical repository."""

import hashlib
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import httpx
import pytest

from app.ai.gateway import EvidenceBlock, EvidenceContext, EvidenceRef
from app.domain.enums import AdminPermission, Role
from app.people_search.app import app
from app.people_search.canonical_ranking import DomainFact, SkillFact, StaffingCandidate
from app.people_search.canonical_repository import CandidateProfile, CanonicalCandidateBatch
from app.people_search.canonical_service import CanonicalSearchService, get_canonical_search_service
from app.people_search.intent import CatalogSkill, StaticSkillCatalog, get_intent_compiler
from tests.people_search._helpers import create_company, create_user, login_token

from .test_intent import compiler_for, intent_data, synthetic_domains, tool_stream

REACT_ID = uuid4()


def synthetic_batch(tenant, actor):
    blocks, people, profiles = [], [], []
    now = datetime.now(UTC)
    for years in (2.0, 2.1):
        subject = uuid4()
        facts = []
        for kind, text in (
            ("skill", f"React experience: {years} years."),
            ("domain", "Worked in real-estate."),
        ):
            identifier = uuid4()
            block = EvidenceBlock(
                subject_id=subject,
                tenant_id=tenant,
                source_id=identifier,
                source_version_id=identifier,
                block_id=identifier,
                text=text,
            )
            blocks.append(block)
            ref = EvidenceRef(
                subject_id=subject,
                tenant_id=tenant,
                source_id=identifier,
                source_version_id=identifier,
                block_id=identifier,
                char_start=0,
                char_end=len(text),
                quote=text,
                quote_sha256=hashlib.sha256(text.encode()).hexdigest(),
            )
            common = {
                "observed_at": now - timedelta(days=1),
                "provenance": "VERIFIED_CANONICAL",
                "evidence_refs": (ref,),
            }
            facts.append(
                SkillFact(canonical_skill_id=REACT_ID, years=years, **common)
                if kind == "skill"
                else DomainFact(domain="real-estate", **common)
            )
        people.append(
            StaffingCandidate(
                subject, tenant, True, True, now - timedelta(days=1000), None, tuple(facts)
            )
        )
        profiles.append(CandidateProfile(subject, tenant, f"Synthetic React {years}", "Engineer"))
    return CanonicalCandidateBatch(
        tuple(people),
        tuple(profiles),
        EvidenceContext(
            tenant_id=tenant,
            actor_id=actor,
            evidence_blocks=tuple(blocks),
            allowed_entity_ids=frozenset(p.candidate_id for p in people),
        ),
    )


@pytest.mark.parametrize(
    "mode, expected",
    [
        ("ready", "ok"),
        ("unavailable", "insufficient_evidence"),
        ("wrong_actor", "insufficient_evidence"),
        ("no_permission", "forbidden"),
    ],
)
async def test_canonical_endpoint_uses_authorized_service(
    client, db_session, monkeypatch, mode, expected
):
    company = await create_company(db_session)
    actor = await create_user(
        db_session,
        email="canonical@acme.dev",
        password="Password123!",
        company=company,
        role=Role.EMPLOYEE if mode == "no_permission" else Role.COMPANY_ADMIN,
        admin_permissions=[AdminPermission.EMPLOYEE_READ.value],
    )
    token = await login_token(client, actor.email, "Password123!")
    loads, requests = [], []

    class Repository:
        async def load(self, intent, *, tenant_id, actor_id):
            loads.append((tenant_id, actor_id))
            assert intent.skills[0].minimum_years_exclusive
            assert intent.required_domains == ["real-estate"]
            if mode == "unavailable":
                return None
            batch = synthetic_batch(tenant_id, actor_id)
            if mode == "wrong_actor":
                batch = replace(
                    batch, context=batch.context.model_copy(update={"actor_id": uuid4()})
                )
            return batch

    def handler(request):
        requests.append(request)
        return httpx.Response(
            200,
            text=tool_stream(
                intent_data(
                    title_keywords=[],
                    skills=[
                        {
                            "name": "React",
                            "required": True,
                            "minimum_years": 2.0,
                            "minimum_years_exclusive": True,
                        }
                    ],
                    required_domains=["bất động sản"],
                )
            ),
        )

    async def no_legacy_query(*args, **kwargs):
        raise AssertionError("Canonical requests must not broaden into legacy title search")

    monkeypatch.setattr("app.people_search.router.search_candidates", no_legacy_query)
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as provider:
        compiler = compiler_for(
            provider,
            catalog=StaticSkillCatalog([CatalogSkill(REACT_ID, "React")]),
            domain_catalog=synthetic_domains(),
        )
        app.dependency_overrides[get_intent_compiler] = lambda: compiler
        app.dependency_overrides[get_canonical_search_service] = lambda: CanonicalSearchService(
            Repository()
        )
        try:
            response = await client.post(
                "/api/v2/people-search/query",
                json={"query": "React trên 2 năm trong lĩnh vực bất động sản"},
                headers={"Authorization": f"Bearer {token}"},
            )
        finally:
            app.dependency_overrides.pop(get_intent_compiler, None)
            app.dependency_overrides.pop(get_canonical_search_service, None)
    if expected == "forbidden":
        assert response.status_code == 403
        assert not requests and not loads
        return
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == expected
    assert loads == [(company.id, actor.id)]
    if expected == "ok":
        assert [item["name"] for item in body["candidates"]] == ["Synthetic React 2.1"]
        match = body["candidates"][0]
        assert match["score_version"] == "people-search-canonical-v1"
        assert match["score"] == sum(f["points"] for f in match["score_factors"])
        assert len(match["evidence_refs"]) == 2
    else:
        assert not body["candidates"]
