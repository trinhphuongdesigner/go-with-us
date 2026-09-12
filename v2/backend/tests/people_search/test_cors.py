"""Browser-origin preflight must cover auth hydration as well as search POST."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.people_search._helpers import create_company, create_user, login_token


@pytest.mark.parametrize("origin", ["http://127.0.0.1:3131", "http://localhost:3131"])
@pytest.mark.parametrize(
    ("path", "method"),
    [
        ("/api/v2/auth/me", "GET"),
        ("/api/v2/auth/login", "POST"),
        ("/api/v2/people-search/query", "POST"),
    ],
)
async def test_allowed_frontend_preflight(client: AsyncClient, origin: str, path: str, method: str):
    response = await client.options(
        path,
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": method,
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin
    assert response.headers["access-control-allow-credentials"] == "true"
    assert method in response.headers["access-control-allow-methods"].split(", ")


@pytest.mark.parametrize("origin", ["https://untrusted.invalid", "http://localhost:9999"])
async def test_other_origins_still_rejected(client: AsyncClient, origin: str):
    response = await client.options(
        "/api/v2/auth/me",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        },
    )
    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers


@pytest.mark.parametrize("method", ["DELETE", "PUT", "PATCH"])
async def test_unneeded_methods_still_rejected(client: AsyncClient, method: str):
    response = await client.options(
        "/api/v2/people-search/query",
        headers={
            "Origin": "http://127.0.0.1:3131",
            "Access-Control-Request-Method": method,
        },
    )
    assert response.status_code == 400


async def test_real_auth_hydration_response_has_cors(client: AsyncClient, db_session: AsyncSession):
    company = await create_company(db_session)
    await create_user(
        db_session, email="cors-qa@example.dev", password="Password123!", company=company
    )
    token = await login_token(client, "cors-qa@example.dev", "Password123!")
    response = await client.get(
        "/api/v2/auth/me",
        headers={
            "Origin": "http://127.0.0.1:3131",
            "Authorization": f"Bearer {token}",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:3131"
    assert response.json()["user"]["email"] == "cors-qa@example.dev"
