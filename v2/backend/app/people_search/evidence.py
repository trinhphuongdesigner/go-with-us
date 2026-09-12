"""Evidence entries built only from real User/Employment rows -- never fabricated."""

from __future__ import annotations

from app.people_search.repository import CandidateRow
from app.people_search.schemas import CandidateEvidence


def build_evidence(candidate: CandidateRow) -> list[CandidateEvidence]:
    evidence = [
        CandidateEvidence(
            type="user",
            user_id=str(candidate.user.id),
            job_title=candidate.user.job_title or "",
        )
    ]
    for employment in candidate.employments:
        evidence.append(
            CandidateEvidence(
                type="employment",
                employment_id=str(employment.id),
                title=employment.title,
                status=employment.status.value,
                start_date=employment.start_date.isoformat(),
                end_date=employment.end_date.isoformat() if employment.end_date else "",
            )
        )
    return evidence
