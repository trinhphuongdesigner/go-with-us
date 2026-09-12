import re
import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import RequestResponseEndpoint
from starlette.responses import Response

from app.ai.provider_runtime import build_profile_import_ai_gateway
from app.api.v2 import (
    auth_router,
    companies_router,
    competency_profile_router,
    people_router,
    profile_imports_router,
    profile_router,
    skills_competency_router,
)
from app.core.config import Settings, get_settings
from app.people_search.router import router as people_search_router


def configure_profile_import_ai_runtime(
    application: FastAPI,
    configured_settings: Settings,
    *,
    client: httpx.AsyncClient | None,
) -> None:
    if hasattr(application.state, "profile_import_ai_gateway"):
        delattr(application.state, "profile_import_ai_gateway")
    if not configured_settings.profile_import_ai_configured:
        return
    endpoint = configured_settings.profile_import_ai_endpoint
    model = configured_settings.profile_import_ai_model
    api_key = configured_settings.profile_import_ai_api_key
    if endpoint is None or model is None or api_key is None or client is None:
        raise RuntimeError("Profile import AI runtime configuration is incomplete")
    application.state.profile_import_ai_gateway = build_profile_import_ai_gateway(
        endpoint=str(endpoint),
        model=model,
        api_key=api_key,
        timeout_seconds=configured_settings.profile_import_ai_timeout_seconds,
        max_attempts=configured_settings.profile_import_ai_max_attempts,
        client=client,
    )


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncIterator[None]:
    configured_settings = get_settings()
    ai_client: httpx.AsyncClient | None = None
    if configured_settings.profile_import_ai_configured:
        ai_client = httpx.AsyncClient()
    configure_profile_import_ai_runtime(application, configured_settings, client=ai_client)
    try:
        yield
    finally:
        if hasattr(application.state, "profile_import_ai_gateway"):
            delattr(application.state, "profile_import_ai_gateway")
        if ai_client is not None:
            await ai_client.aclose()


settings = get_settings()
_REQUEST_ID_PATTERN = re.compile(r"[A-Za-z0-9._:-]{1,64}\Z")
app = FastAPI(
    title="CareerMate v2 API",
    version="0.1.0",
    docs_url="/api/v2/docs",
    redoc_url="/api/v2/redoc",
    openapi_url="/api/v2/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Idempotency-Key", "X-Request-ID"],
)


@app.middleware("http")
async def attach_request_id(request: Request, call_next: RequestResponseEndpoint) -> Response:
    supplied_request_id = request.headers.get("X-Request-ID", "").strip()
    request_id = (
        supplied_request_id
        if _REQUEST_ID_PATTERN.fullmatch(supplied_request_id)
        else str(uuid.uuid4())
    )
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


app.include_router(auth_router, prefix="/api/v2")
app.include_router(companies_router, prefix="/api/v2")
app.include_router(profile_router, prefix="/api/v2")
app.include_router(people_router, prefix="/api/v2")
app.include_router(profile_imports_router, prefix="/api/v2")
app.include_router(skills_competency_router, prefix="/api/v2")
app.include_router(competency_profile_router, prefix="/api/v2")
app.include_router(people_search_router, prefix="/api/v2")


@app.get("/api/v2/health", tags=["system"])
async def health() -> dict[str, str]:
    return {"status": "ok"}
