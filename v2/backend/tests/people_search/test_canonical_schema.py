"""Public canonical search data must retain exact scores and bound sources."""

import hashlib
from datetime import UTC, datetime
from importlib import import_module
from importlib.util import find_spec
from uuid import UUID

import pytest
from pydantic import ValidationError

from app.people_search.schemas import EmployeeSearchPlan, SearchResponse


@pytest.fixture
def schema():
    assert find_spec("app.people_search.canonical_schema") is not None
    return import_module("app.people_search.canonical_schema").CanonicalCandidateMatch


@pytest.fixture
def payload():
    quote = "Verified React experience: 3 years."
    ref = {
        "subject_id": UUID(int=10),
        "tenant_id": UUID(int=1),
        "source_id": UUID(int=20),
        "source_version_id": UUID(int=21),
        "block_id": UUID(int=22),
        "char_start": 0,
        "char_end": len(quote),
        "quote": quote,
        "quote_sha256": hashlib.sha256(quote.encode()).hexdigest(),
    }
    return {
        "candidate_id": UUID(int=10),
        "company_id": UUID(int=1),
        "name": "Synthetic colleague",
        "title": "Engineer",
        "score": 100.0,
        "score_version": "people-search-canonical-v1",
        "score_factors": [
            {
                "code": "REQUIRED_SKILL",
                "points": 100.0,
                "maximum_points": 100.0,
                "evidence_refs": [ref.copy()],
            }
        ],
        "evidence_refs": [ref.copy()],
        "data_freshness_at": datetime(2026, 9, 12, tzinfo=UTC),
    }


def test_public_response_round_trip_retains_canonical_factor_and_source(schema, payload):
    item = schema.model_validate(payload)
    response = SearchResponse(
        status="ok", plan=EmployeeSearchPlan(raw_query="React trên 2 năm"), candidates=[item]
    )
    restored = SearchResponse.model_validate_json(response.model_dump_json())
    assert restored.candidates[0] == item
    assert restored.candidates[0].evidence_refs[0].source_version_id == UUID(int=21)


@pytest.mark.parametrize(
    "mutation", ["sum", "ceiling", "nan", "subject", "tenant", "missing", "extra", "date"]
)
def test_invalid_public_canonical_candidate_is_rejected(schema, payload, mutation):
    if mutation == "sum":
        payload["score"] = 99.0
    elif mutation == "ceiling":
        payload["score_factors"][0]["maximum_points"] = 99.0
    elif mutation == "nan":
        payload["score_factors"][0]["points"] = float("nan")
    elif mutation == "subject":
        payload["score_factors"][0]["evidence_refs"][0]["subject_id"] = UUID(int=99)
    elif mutation == "tenant":
        payload["evidence_refs"][0]["tenant_id"] = UUID(int=99)
    elif mutation == "missing":
        payload["evidence_refs"] = []
    elif mutation == "extra":
        payload["raw_cv"] = "Must not be exposed"
    elif mutation == "date":
        payload["data_freshness_at"] = datetime(2026, 9, 12)  # noqa: DTZ001 -- invalid input
    with pytest.raises(ValidationError):
        schema.model_validate(payload)


def test_insufficient_evidence_is_distinct_from_no_matches():
    response = SearchResponse(
        status="insufficient_evidence",
        plan=EmployeeSearchPlan(raw_query="React"),
        unsupported_reasons=["Dữ liệu kỹ năng chuẩn hóa chưa sẵn sàng."],
    )
    assert not response.candidates
