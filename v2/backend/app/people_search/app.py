"""Standalone FastAPI app composing auth + people-search routers, for isolated TestClient use.

Does not touch app/main.py; only used by tests and the smoke script.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v2.auth import router as auth_router
from app.people_search.router import router as people_search_router

app = FastAPI(title="CareerMate v2 People Search (isolated)")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:3131", "http://localhost:3131"],
    allow_credentials=True,
    # AuthProvider verifies a restored session with GET /auth/me before search.
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
app.include_router(auth_router, prefix="/api/v2")
app.include_router(people_search_router, prefix="/api/v2")
