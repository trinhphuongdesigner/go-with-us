"""Verify search is mounted on the real v2 app, not only the isolated test app."""

from uuid import uuid4

import pytest

from app.domain.enums import AdminPermission, Role
from app.domain.models import Company, User
from app.main import app
from app.people_search.intent import IntentCompilation, get_intent_compiler
from app.people_search.schemas import EmployeeSearchPlan
from app.security.jwt import hash_password


@pytest.mark.parametrize("role,expected", [(Role.COMPANY_ADMIN, 200), (Role.EMPLOYEE, 403)])
async def test_main_app_search_uses_existing_auth_and_permissions(client, db_session, role, expected):
    company = Company(name="QA composition company")
    db_session.add(company)
    await db_session.flush()
    user = User(
        email=f"qa-{uuid4()}@example.com",
        name="Synthetic QA User",
        role=role,
        company_id=company.id,
        hashed_password=hash_password("CompositionTest123!"),
        admin_permissions=[AdminPermission.EMPLOYEE_READ.value] if role == Role.COMPANY_ADMIN else [],
    )
    db_session.add(user)
    await db_session.commit()
    calls = []

    class Compiler:
        async def compile(self, query, *, tenant_id, actor_id):
            calls.append((tenant_id, actor_id))
            return IntentCompilation(EmployeeSearchPlan(
                raw_query=query,
                needs_clarification=True,
                clarification_reason="Synthetic compiler: canonical data unavailable.",
            ))

    app.dependency_overrides[get_intent_compiler] = lambda: Compiler()
    try:
        login = await client.post("/api/v2/auth/login", json={
            "email": user.email, "password": "CompositionTest123!",
        })
        assert login.status_code == 200, login.text
        response = await client.post(
            "/api/v2/people-search/query",
            headers={"Authorization": f"Bearer {login.json()['accessToken']}", "X-Request-ID": "qa-search"},
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
