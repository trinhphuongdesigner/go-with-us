import uuid

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import func, select

from app.domain.enums import Role
from app.domain.models import Company, EmployeeSkill, Skill, User
from app.rich_profile_import import routes as routes_module
from app.rich_profile_import.models import RichProfileImport
from app.rich_profile_import.routes import apply_import, refine, snapshot
from app.rich_profile_import.schemas import (
    ApplyRequest,
    RefineRequest,
    RichProposal,
    RichSkillApply,
    SelectedUpdates,
)
from app.security.jwt import hash_password


def test_rich_skill_proposal_does_not_invent_a_default_level() -> None:
    proposal = RichProposal.model_validate({"skills": [{"name": "React"}]})

    assert proposal.skills[0].level is None
    with pytest.raises(ValidationError):
        SelectedUpdates.model_validate({"skills": [{"name": "React", "level": None}]})


@pytest.mark.parametrize("level", [0, 6, True, 3.5, "3"])
def test_rich_skill_apply_rejects_invalid_or_coerced_levels(level) -> None:
    with pytest.raises(ValidationError):
        SelectedUpdates.model_validate({"skills": [{"name": "React", "level": level}]})


@pytest.mark.parametrize("level", [1, 5])
def test_rich_skill_apply_accepts_explicit_boundary_levels(level) -> None:
    updates = SelectedUpdates.model_validate({"skills": [{"name": "React", "level": level}]})

    assert updates.skills[0].level == level


async def test_rich_import_apply_fails_closed_without_evidence_backed_items(db_session) -> None:
    company = Company(name="Evidence-required company")
    db_session.add(company)
    await db_session.flush()
    actor = User(
        email="rich-import-safety@example.com",
        name="Rich Import Owner",
        role=Role.EMPLOYEE,
        company_id=company.id,
        hashed_password=hash_password("RichImportSafety123!"),
    )
    db_session.add(actor)
    await db_session.commit()
    _, fingerprint = await snapshot(db_session, actor)
    row = RichProfileImport(
        owner_user_id=actor.id,
        company_id=company.id,
        encrypted_sources="not-read-by-disabled-apply",
        source_labels=["CV.pdf"],
        proposal=RichProposal().model_dump(mode="json", by_alias=True),
        snapshot_hash=fingerprint,
    )
    db_session.add(row)
    await db_session.commit()

    with pytest.raises(HTTPException) as error:
        await apply_import(
            row.id,
            ApplyRequest(
                expected_version=1,
                client_request_id=uuid.uuid4(),
                updates=SelectedUpdates(
                    skills=[RichSkillApply(name="Invented expertise", level=5)]
                ),
            ),
            db_session,
            actor,
        )

    assert error.value.status_code == 409
    await db_session.refresh(row)
    assert row.applied is False
    assert row.applied_counts is None
    assert actor.version == 1
    assert await db_session.scalar(select(func.count()).select_from(Skill)) == 0
    assert await db_session.scalar(select(func.count()).select_from(EmployeeSkill)) == 0


async def test_refine_revalidates_version_after_provider_returns(
    db_session, monkeypatch: pytest.MonkeyPatch
) -> None:
    company = Company(name="Concurrent refine company")
    db_session.add(company)
    await db_session.flush()
    actor = User(
        email="refine-concurrency@example.com",
        name="Refine Owner",
        role=Role.EMPLOYEE,
        company_id=company.id,
        hashed_password=hash_password("RefineConcurrency123!"),
    )
    db_session.add(actor)
    await db_session.flush()
    original = RichProposal(summary="Original")
    row = RichProfileImport(
        owner_user_id=actor.id,
        company_id=company.id,
        encrypted_sources=routes_module.cipher()
        .encrypt(b'[{"label":"CV","text":"supported"}]')
        .decode(),
        source_labels=["CV"],
        proposal=original.model_dump(mode="json", by_alias=True),
        snapshot_hash="before-provider",
    )
    db_session.add(row)
    await db_session.commit()

    async def stable_snapshot(*args, **kwargs):
        return {}, "after-provider"

    async def concurrent_provider(*args, **kwargs):
        row.version = 2
        row.proposal = RichProposal(summary="Concurrent edit").model_dump(
            mode="json", by_alias=True
        )
        await db_session.commit()
        return RichProposal(summary="Provider result")

    monkeypatch.setattr(routes_module, "snapshot", stable_snapshot)
    monkeypatch.setattr(routes_module, "propose", concurrent_provider)

    with pytest.raises(HTTPException) as error:
        await refine(
            row.id,
            RefineRequest(
                expectedVersion=1,
                instruction="Làm rõ nội dung",
                proposal=original,
            ),
            db_session,
            actor,
        )

    assert error.value.status_code == 409
    await db_session.refresh(row)
    assert row.version == 2
    assert row.proposal["summary"] == "Concurrent edit"
