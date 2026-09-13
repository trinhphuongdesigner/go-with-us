"""Verify search is mounted on the real v2 app, not only the isolated test app."""

import json
from datetime import UTC, datetime
from uuid import uuid4

import pytest

from app.domain.enums import AdminPermission, EmploymentStatus, ProfileSourceType, Role
from app.domain.models import Company, EmployeeSkill, Employment, Skill, User
from app.main import app
from app.people_search.intent import IntentCompilation, get_intent_compiler
from app.people_search.schemas import EmployeeSearchPlan
from app.security.jwt import hash_password


@pytest.mark.parametrize("role,expected", [(Role.COMPANY_ADMIN, 200), (Role.EMPLOYEE, 403)])
async def test_main_app_search_uses_existing_auth_and_permissions(
    client, db_session, role, expected
):
    company = Company(name="QA composition company")
    db_session.add(company)
    await db_session.flush()
    user = User(
        email=f"qa-{uuid4()}@example.com",
        name="Synthetic QA User",
        role=role,
        company_id=company.id,
        hashed_password=hash_password("CompositionTest123!"),
        admin_permissions=[AdminPermission.EMPLOYEE_READ.value]
        if role == Role.COMPANY_ADMIN
        else [],
    )
    db_session.add(user)
    await db_session.commit()
    calls = []

    class Compiler:
        async def compile(self, query, *, tenant_id, actor_id):
            calls.append((tenant_id, actor_id))
            return IntentCompilation(
                EmployeeSearchPlan(
                    raw_query=query,
                    needs_clarification=True,
                    clarification_reason="Synthetic compiler: canonical data unavailable.",
                )
            )

    app.dependency_overrides[get_intent_compiler] = lambda: Compiler()
    try:
        login = await client.post(
            "/api/v2/auth/login",
            json={
                "email": user.email,
                "password": "CompositionTest123!",
            },
        )
        assert login.status_code == 200, login.text
        response = await client.post(
            "/api/v2/people-search/query",
            headers={
                "Authorization": f"Bearer {login.json()['accessToken']}",
                "X-Request-ID": "qa-search",
            },
            json={"query": "React engineer"},
        )
        assert response.status_code == expected
        assert response.headers["X-Request-ID"] == "qa-search"
        if expected == 200:
            assert calls == [(company.id, user.id)]
            assert response.json()["status"] == "needs_clarification"
            assert response.json()["candidates"] == []
        else:
            assert calls == []
    finally:
        app.dependency_overrides.pop(get_intent_compiler, None)


async def test_main_app_search_rejects_anonymous_request(client):
    response = await client.post("/api/v2/people-search/query", json={"query": "Engineer"})
    assert response.status_code in {401, 403}


def test_main_app_openapi_has_one_search_operation():
    path = app.openapi()["paths"]["/api/v2/people-search/query"]
    assert set(path) == {"post"}


def test_main_app_openapi_exposes_grounded_rag_search():
    assert "/api/v2/people-search/ask" in app.openapi()["paths"]


async def test_rag_search_retrieves_only_authorized_company_profile_data(client, db_session):
    company = Company(name="RAG tenant")
    other_company = Company(name="Other tenant")
    db_session.add_all([company, other_company])
    await db_session.flush()
    actor = User(
        email="rag-admin@example.com",
        name="RAG Admin",
        role=Role.COMPANY_ADMIN,
        company_id=company.id,
        hashed_password=hash_password("CompositionTest123!"),
        admin_permissions=[AdminPermission.EMPLOYEE_READ.value],
    )
    candidate = User(
        email="rag-candidate@example.com",
        name="Nguyen An",
        job_title="Frontend Engineer",
        role=Role.EMPLOYEE,
        company_id=company.id,
        hashed_password=hash_password("CandidateTest123!"),
    )
    outsider = User(
        email="rag-outsider@example.com",
        name="Other Tenant Person",
        job_title="React Engineer",
        role=Role.EMPLOYEE,
        company_id=other_company.id,
        hashed_password=hash_password("OutsiderTest123!"),
    )
    db_session.add_all([actor, candidate, outsider])
    await db_session.flush()
    now = datetime.now(UTC)
    db_session.add_all(
        [
            Employment(
                user_id=candidate.id,
                company_id=company.id,
                title="Frontend Engineer",
                start_date=now,
                status=EmploymentStatus.ACTIVE,
            ),
            Employment(
                user_id=outsider.id,
                company_id=other_company.id,
                title="React Engineer",
                start_date=now,
                status=EmploymentStatus.ACTIVE,
            ),
        ]
    )
    react = Skill(name="React", normalized_key="react", category="Engineering")
    db_session.add(react)
    await db_session.flush()
    db_session.add_all(
        [
            EmployeeSkill(
                user_id=candidate.id,
                company_id=company.id,
                skill_id=react.id,
                rating=4,
                note="Built React design systems",
                self_assessed=True,
                source_type=ProfileSourceType.SELF,
                created_by=candidate.id,
                updated_by=candidate.id,
            ),
            EmployeeSkill(
                user_id=outsider.id,
                company_id=other_company.id,
                skill_id=react.id,
                rating=5,
                note="Leads React projects",
                self_assessed=False,
                source_type=ProfileSourceType.ADMIN,
                created_by=outsider.id,
                updated_by=outsider.id,
            ),
        ]
    )
    await db_session.commit()

    login = await client.post(
        "/api/v2/auth/login", json={"email": actor.email, "password": "CompositionTest123!"}
    )
    response = await client.post(
        "/api/v2/people-search/ask",
        headers={"Authorization": f"Bearer {login.json()['accessToken']}"},
        json={"query": "Ai có kinh nghiệm React?"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["retrieval_mode"] == "STRUCTURED_PROFILE_RAG"
    assert body["answer_source"] == "deterministic_fallback"
    assert [item["name"] for item in body["candidates"]] == ["Nguyen An"]
    assert body["candidates"][0]["matched_terms"] == ["react"]
    assert body["candidates"][0]["evidence"][0]["source_type"] == "skill"
    assert "Other Tenant Person" not in response.text


async def test_hr_rag_never_sends_peer_or_higher_role_profiles_to_provider(
    client, db_session, monkeypatch
):
    company = Company(name="RAG role hierarchy tenant")
    db_session.add(company)
    await db_session.flush()
    actor = User(
        email="rag-hr@example.com",
        name="RAG HR",
        role=Role.HR,
        company_id=company.id,
        hashed_password=hash_password("CompositionTest123!"),
        admin_permissions=[AdminPermission.EMPLOYEE_READ.value],
    )
    bod = User(
        email="rag-bod@example.com",
        name="Forbidden BOD",
        job_title="React forbidden-bod-evidence",
        role=Role.BOD,
        company_id=company.id,
        hashed_password=hash_password("CandidateTest123!"),
    )
    peer_hr = User(
        email="rag-peer-hr@example.com",
        name="Forbidden HR peer",
        job_title="React forbidden-peer-evidence",
        role=Role.HR,
        company_id=company.id,
        hashed_password=hash_password("CandidateTest123!"),
    )
    employee = User(
        email="rag-employee@example.com",
        name="Allowed Employee",
        job_title="React allowed-employee-evidence",
        role=Role.EMPLOYEE,
        company_id=company.id,
        hashed_password=hash_password("CandidateTest123!"),
    )
    db_session.add_all([actor, bod, peer_hr, employee])
    await db_session.flush()
    now = datetime.now(UTC)
    db_session.add_all(
        [
            Employment(
                user_id=user.id,
                company_id=company.id,
                title=user.job_title or "React",
                start_date=now,
                status=EmploymentStatus.ACTIVE,
            )
            for user in (bod, peer_hr, employee)
        ]
    )
    await db_session.commit()

    provider_payloads: list[str] = []

    async def grounded_reply(_db, _system, messages):
        provider_payloads.append(messages[0]["content"])
        return {
            "content": json.dumps(
                {
                    "answer": "Có một hồ sơ nhân viên phù hợp.",
                    "candidate_reasons": [],
                }
            )
        }

    monkeypatch.setattr("app.people_search.rag.send_chat", grounded_reply)
    login = await client.post(
        "/api/v2/auth/login", json={"email": actor.email, "password": "CompositionTest123!"}
    )
    response = await client.post(
        "/api/v2/people-search/ask",
        headers={"Authorization": f"Bearer {login.json()['accessToken']}"},
        json={"query": "React"},
    )

    assert response.status_code == 200
    assert [item["name"] for item in response.json()["candidates"]] == ["Allowed Employee"]
    assert len(provider_payloads) == 1
    assert "allowed-employee-evidence" in provider_payloads[0]
    assert "forbidden-bod-evidence" not in provider_payloads[0]
    assert "forbidden-peer-evidence" not in provider_payloads[0]
