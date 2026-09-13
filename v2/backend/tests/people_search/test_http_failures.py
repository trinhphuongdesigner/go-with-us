"""HTTP status mapping for provider failures, per ai-reliability-contract.md
section 8: provider timeout with no fallback => 504; every other
malformed/invalid/failed provider outcome => 502. Deterministic on the
gateway's exact warning code, never on parsed error text. Synthetic
transports only; no live provider calls.
"""

import httpx
import pytest

from app.domain.enums import AdminPermission, Role
from tests.people_search._helpers import (
    create_company,
    create_employment,
    create_user,
    login_token,
)
from tests.people_search.test_intent import compiler_for, intent_data, tool_stream


async def _admin_token(client, db_session, email):
    company = await create_company(db_session)
    admin = await create_user(
        db_session,
        email=email,
        password="Password123!",
        company=company,
        role=Role.COMPANY_ADMIN,
        admin_permissions=[AdminPermission.EMPLOYEE_READ.value],
    )
    await create_employment(
        db_session, user=admin, company=company, title="Backend Engineer", years_ago_start=3
    )
    return await login_token(client, admin.email, "Password123!")


def _override_compiler(compiler):
    from app.people_search.app import app
    from app.people_search.intent import get_intent_compiler

    app.dependency_overrides[get_intent_compiler] = lambda: compiler
    return app


@pytest.mark.asyncio
async def test_provider_timeout_maps_to_504(client, db_session, monkeypatch):
    provider_detail = "synthetic timeout must stay private"
    provider_calls = []
    retrieval_calls = []

    def handler(request):
        provider_calls.append(request)
        raise httpx.TimeoutException(provider_detail)

    async def fail_if_retrieved(*_args, **_kwargs):
        retrieval_calls.append(True)
        raise AssertionError("retrieval must not run after provider failure")

    monkeypatch.setattr("app.people_search.router.search_candidates", fail_if_retrieved)
    token = await _admin_token(client, db_session, "timeout-admin@example.dev")
    app = None
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as transport_client:
        app = _override_compiler(compiler_for(transport_client))
        try:
            response = await client.post(
                "/api/v2/people-search/query",
                json={"query": "Backend engineer"},
                headers={"Authorization": f"Bearer {token}"},
            )
        finally:
            from app.people_search.intent import get_intent_compiler

            app.dependency_overrides.pop(get_intent_compiler, None)

    assert response.status_code == 504
    body = response.json()
    assert body["status"] == "provider_failure"
    assert body["candidates"] == []
    assert body["unsupported_reasons"] == ["Không thể phân tích yêu cầu lúc này; vui lòng thử lại."]
    assert provider_detail not in response.text
    assert len(provider_calls) == 2
    assert retrieval_calls == []


@pytest.mark.asyncio
async def test_malformed_provider_output_maps_to_502(client, db_session):
    def handler(_request):
        # Schema-invalid: candidate_ids is not a field the model may supply.
        return httpx.Response(200, text=tool_stream(intent_data(candidate_ids=["invented"])))

    token = await _admin_token(client, db_session, "malformed-admin@example.dev")
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as transport_client:
        app = _override_compiler(compiler_for(transport_client))
        try:
            response = await client.post(
                "/api/v2/people-search/query",
                json={"query": "Backend engineer"},
                headers={"Authorization": f"Bearer {token}"},
            )
        finally:
            from app.people_search.intent import get_intent_compiler

            app.dependency_overrides.pop(get_intent_compiler, None)

    assert response.status_code == 502
    body = response.json()
    assert body["status"] == "provider_failure"
    assert body["candidates"] == []


@pytest.mark.asyncio
async def test_provider_5xx_exhausted_retries_maps_to_502(client, db_session):
    def handler(_request):
        return httpx.Response(503)

    token = await _admin_token(client, db_session, "provider5xx-admin@example.dev")
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as transport_client:
        app = _override_compiler(compiler_for(transport_client))
        try:
            response = await client.post(
                "/api/v2/people-search/query",
                json={"query": "Backend engineer"},
                headers={"Authorization": f"Bearer {token}"},
            )
        finally:
            from app.people_search.intent import get_intent_compiler

            app.dependency_overrides.pop(get_intent_compiler, None)

    assert response.status_code == 502
    body = response.json()
    assert body["status"] == "provider_failure"
    assert body["candidates"] == []


@pytest.mark.asyncio
async def test_unauthorized_request_never_reaches_provider_or_gets_5xx(client):
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(200, text=tool_stream(intent_data()))

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as transport_client:
        app = _override_compiler(compiler_for(transport_client))
        try:
            response = await client.post(
                "/api/v2/people-search/query", json={"query": "Backend engineer"}
            )
        finally:
            from app.people_search.intent import get_intent_compiler

            app.dependency_overrides.pop(get_intent_compiler, None)

    assert response.status_code == 401
    assert calls == []


@pytest.mark.asyncio
async def test_forbidden_permission_never_reaches_provider(client, db_session):
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(200, text=tool_stream(intent_data()))

    company = await create_company(db_session)
    await create_user(
        db_session, email="emp-http@acme.dev", password="Password123!", company=company
    )
    token = await login_token(client, "emp-http@acme.dev", "Password123!")

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as transport_client:
        app = _override_compiler(compiler_for(transport_client))
        try:
            response = await client.post(
                "/api/v2/people-search/query",
                json={"query": "Backend engineer"},
                headers={"Authorization": f"Bearer {token}"},
            )
        finally:
            from app.people_search.intent import get_intent_compiler

            app.dependency_overrides.pop(get_intent_compiler, None)

    assert response.status_code == 403
    assert calls == []


@pytest.mark.asyncio
async def test_successful_and_clarification_status_unaffected_at_200(client, db_session):
    token = await _admin_token(client, db_session, "ok-admin@example.dev")

    def handler(_request):
        return httpx.Response(200, text=tool_stream(intent_data()))

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as transport_client:
        app = _override_compiler(compiler_for(transport_client))
        try:
            ok_response = await client.post(
                "/api/v2/people-search/query",
                json={"query": "Backend engineer"},
                headers={"Authorization": f"Bearer {token}"},
            )
        finally:
            from app.people_search.intent import get_intent_compiler

            app.dependency_overrides.pop(get_intent_compiler, None)

    assert ok_response.status_code == 200
    assert ok_response.json()["status"] == "empty"

    def clarify_handler(_request):
        return httpx.Response(
            200, text=tool_stream(intent_data(sensitive_constraints_detected=True))
        )

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(clarify_handler)
    ) as transport_client:
        app = _override_compiler(compiler_for(transport_client))
        try:
            clarify_response = await client.post(
                "/api/v2/people-search/query",
                json={"query": "Backend engineer"},
                headers={"Authorization": f"Bearer {token}"},
            )
        finally:
            from app.people_search.intent import get_intent_compiler

            app.dependency_overrides.pop(get_intent_compiler, None)

    assert clarify_response.status_code == 200
    assert clarify_response.json()["status"] == "needs_clarification"
