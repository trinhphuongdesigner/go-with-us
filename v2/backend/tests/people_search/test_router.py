import json

import httpx
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.enums import AdminPermission, Role
from tests.people_search._helpers import create_company, create_employment, create_user, login_token
from tests.people_search.test_intent import compiler_for, intent_data, tool_stream


@pytest.fixture(autouse=True)
async def synthetic_intent():
    """Use the real compiler/gateway/transport pipeline, never network or regex."""
    from app.people_search.app import app
    from app.people_search.intent import get_intent_compiler

    requests = []

    def handler(request):
        requests.append(request)
        query = json.loads(request.content)["messages"][0]["content"]
        data = intent_data()
        if "lãnh đạo" in query:
            data = intent_data(skills=[{"name": "Lãnh đạo", "required": True}])
        if "provider unavailable" in query:
            return httpx.Response(503)
        if "bất động sản" in query:
            data = intent_data(required_domains=["bất động sản"])
        if "strict experience" in query:
            data = intent_data(minimum_total_years=3.0, minimum_total_years_exclusive=True)
        return httpx.Response(200, text=tool_stream(data))

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as transport_client:
        compiler = compiler_for(transport_client)
        app.dependency_overrides[get_intent_compiler] = lambda: compiler
        yield requests
    app.dependency_overrides.pop(get_intent_compiler, None)


@pytest.mark.asyncio
async def test_employee_without_permission_gets_403(
    client: AsyncClient, db_session: AsyncSession, synthetic_intent
) -> None:
    company = await create_company(db_session)
    await create_user(db_session, email="emp@acme.dev", password="Password123!", company=company)
    token = await login_token(client, "emp@acme.dev", "Password123!")

    response = await client.post(
        "/api/v2/people-search/query",
        json={"query": "Backend engineer"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403
    assert synthetic_intent == []


@pytest.mark.asyncio
async def test_admin_ok_status_with_matching_candidate(
    client: AsyncClient, db_session: AsyncSession, synthetic_intent
) -> None:
    company = await create_company(db_session)
    admin = await create_user(
        db_session,
        email="admin@acme.dev",
        password="Password123!",
        company=company,
        role=Role.COMPANY_ADMIN,
        admin_permissions=[AdminPermission.EMPLOYEE_READ.value],
    )
    engineer = await create_user(
        db_session,
        email="eng@acme.dev",
        password="Password123!",
        company=company,
        job_title="Backend Engineer",
    )
    await create_employment(
        db_session, user=engineer, company=company, title="Backend Engineer", years_ago_start=3
    )
    token = await login_token(client, admin.email, "Password123!")

    response = await client.post(
        "/api/v2/people-search/query",
        json={"query": "Backend engineer"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert len(body["candidates"]) == 1
    assert body["explanation_source"] == "deterministic_fallback"
    assert body["candidates"][0]["score_version"] == "people-search-v1"
    assert len(synthetic_intent) == 1


@pytest.mark.asyncio
async def test_empty_status_when_no_candidates(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    company = await create_company(db_session)
    admin = await create_user(
        db_session,
        email="admin2@acme.dev",
        password="Password123!",
        company=company,
        role=Role.COMPANY_ADMIN,
        admin_permissions=[AdminPermission.EMPLOYEE_READ.value],
    )
    token = await login_token(client, admin.email, "Password123!")

    response = await client.post(
        "/api/v2/people-search/query",
        json={"query": "Backend engineer"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "empty"


@pytest.mark.asyncio
async def test_needs_clarification_status(client: AsyncClient, db_session: AsyncSession) -> None:
    company = await create_company(db_session)
    admin = await create_user(
        db_session,
        email="admin3@acme.dev",
        password="Password123!",
        company=company,
        role=Role.COMPANY_ADMIN,
        admin_permissions=[AdminPermission.EMPLOYEE_READ.value],
    )
    token = await login_token(client, admin.email, "Password123!")

    response = await client.post(
        "/api/v2/people-search/query",
        json={"query": "Người có kỹ năng lãnh đạo tốt"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "needs_clarification"


@pytest.mark.asyncio
async def test_missing_immutable_evidence_uses_deterministic_fallback(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """No provider call: current User/Employment rows are not immutable SourceBlocks."""

    company = await create_company(db_session)
    admin = await create_user(
        db_session,
        email="admin4@acme.dev",
        password="Password123!",
        company=company,
        role=Role.COMPANY_ADMIN,
        admin_permissions=[AdminPermission.EMPLOYEE_READ.value],
    )
    engineer = await create_user(
        db_session,
        email="eng4@acme.dev",
        password="Password123!",
        company=company,
        job_title="Backend Engineer",
    )
    await create_employment(
        db_session, user=engineer, company=company, title="Backend Engineer", years_ago_start=3
    )
    token = await login_token(client, admin.email, "Password123!")

    response = await client.post(
        "/api/v2/people-search/query",
        json={"query": "Backend engineer"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert len(body["candidates"]) == 1
    assert body["explanation"] is None
    assert body["explanation_source"] == "deterministic_fallback"


@pytest.mark.asyncio
async def test_strict_request_rejects_unknown_fields(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    company = await create_company(db_session, "Strict")
    admin = await create_user(
        db_session,
        email="strict@x.dev",
        password="Password123!",
        company=company,
        role=Role.COMPANY_ADMIN,
        admin_permissions=[AdminPermission.EMPLOYEE_READ.value],
    )
    token = await login_token(client, admin.email, "Password123!")
    response = await client.post(
        "/api/v2/people-search/query",
        json={"query": "Engineer", "company_id": "attacker"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_composition_app_allows_frontend_origin_preflight(client: AsyncClient) -> None:
    response = await client.options(
        "/api/v2/people-search/query",
        headers={
            "Origin": "http://127.0.0.1:3131",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:3131"
    assert response.headers["access-control-allow-credentials"] == "true"


@pytest.mark.parametrize(
    "query,expected,expected_status",
    [
        ("provider unavailable", "provider_failure", 502),
        ("Backend engineer có domain bất động sản", "needs_clarification", 200),
        ("female Backend engineer", "needs_clarification", 200),
        ("strict experience", "empty", 200),
    ],
)
async def test_compiler_failures_and_unsupported_hard_filters_never_return_candidates(
    client,
    db_session,
    query,
    expected,
    expected_status,
):
    company = await create_company(db_session)
    admin = await create_user(
        db_session,
        email="intent-admin@example.dev",
        password="Password123!",
        company=company,
        role=Role.COMPANY_ADMIN,
        admin_permissions=[AdminPermission.EMPLOYEE_READ.value],
    )
    await create_employment(
        db_session, user=admin, company=company, title="Backend Engineer", years_ago_start=3
    )
    token = await login_token(client, admin.email, "Password123!")
    response = await client.post(
        "/api/v2/people-search/query",
        json={"query": query},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == expected_status
    assert response.json()["status"] == expected
    assert response.json()["candidates"] == []


async def test_unauthenticated_request_rejected_before_provider(client, synthetic_intent):
    response = await client.post("/api/v2/people-search/query", json={"query": "Engineer"})
    assert response.status_code == 401
    assert synthetic_intent == []
