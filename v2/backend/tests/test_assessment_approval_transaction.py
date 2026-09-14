import asyncio
import json
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.sql.selectable import Select

from app.company_memberships import CompanyMembership
from app.core.database import get_db
from app.domain.enums import AdminPermission, Role
from app.domain.models import ActivityLog, Company, User
from app.main import app
from app.repositories.activity_repo import ActivityLogRepository
from app.security.jwt import hash_password
from app.talent_workflows.models import Assessment, AssessmentCycle, AssessmentTemplate

PASSWORD = "AssessmentReview123!"


def snapshot(question_id: str = "delivery") -> dict[str, Any]:
    return {
        "groups": [
            {
                "id": "delivery-group",
                "weight": 1,
                "scoreDimension": "CONTRIBUTION",
                "questions": [
                    {"id": question_id, "weight": 1, "maxScore": 10},
                ],
            }
        ]
    }


async def user(
    db: AsyncSession,
    company: Company,
    *,
    email: str,
    role: Role,
    permissions: list[str] | None = None,
) -> User:
    row = User(
        email=email,
        name=email.split("@")[0],
        hashed_password=hash_password(PASSWORD),
        role=role,
        company_id=company.id,
        admin_permissions=permissions or [],
    )
    db.add(row)
    await db.flush()
    db.add(CompanyMembership(user_id=row.id, company_id=company.id))
    return row


async def headers(client: AsyncClient, actor: User) -> dict[str, str]:
    response = await client.post(
        "/api/v2/auth/login", json={"email": actor.email, "password": PASSWORD}
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['accessToken']}"}


async def setup_assessment(
    db: AsyncSession,
    *,
    status: str = "SUBMITTED",
    self_approve: bool = False,
    suffix: str = "",
) -> dict[str, Any]:
    company = Company(name="Assessment approval company")
    db.add(company)
    await db.flush()
    approver = await user(
        db,
        company,
        email=f"approver{suffix}@assessment.dev",
        role=Role.COMPANY_ADMIN,
        permissions=[AdminPermission.ASSESSMENT_REVIEW.value],
    )
    reviewee = approver if self_approve else await user(
        db,
        company,
        email=f"reviewee{suffix}@assessment.dev",
        role=Role.EMPLOYEE,
    )
    template = AssessmentTemplate(
        company_id=company.id,
        created_by_id=approver.id,
        name="Approval template",
        description="",
        status="ACTIVE",
        groups=snapshot()["groups"],
    )
    db.add(template)
    await db.flush()
    cycle = AssessmentCycle(
        company_id=company.id,
        template_id=template.id,
        name="Approval cycle",
        period="2026-09",
        status="OPEN",
    )
    db.add(cycle)
    await db.flush()
    immutable = snapshot()
    assessment = Assessment(
        company_id=company.id,
        cycle_id=cycle.id,
        reviewee_id=reviewee.id,
        reviewer_id=reviewee.id,
        type="SELF",
        status=status,
        version=1,
        template_snapshot=immutable,
        answers=[{"questionId": "delivery", "score": 8, "comment": "private answer"}],
        total_score=1,
        contribution_score=1,
        comment="private assessment comment",
    )
    db.add(assessment)
    await db.commit()
    return {
        "company": company,
        "approver": approver,
        "reviewee": reviewee,
        "template": template,
        "assessment": assessment,
        "snapshot": immutable,
    }


async def activity_logs(db: AsyncSession, assessment_id: object) -> list[ActivityLog]:
    await db.rollback()
    return list(
        (
            await db.scalars(
                select(ActivityLog)
                .where(
                    ActivityLog.entity_type == "assessment",
                    ActivityLog.entity_id == str(assessment_id),
                )
                .order_by(ActivityLog.created_at, ActivityLog.id)
            )
        ).all()
    )


async def test_approve_is_atomic_audited_and_recomputes_from_immutable_snapshot(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    seeded = await setup_assessment(db_session)
    assessment = seeded["assessment"]
    assessment_id = assessment.id
    approver_id = seeded["approver"].id
    template = seeded["template"]
    template.groups = snapshot("changed-live-question")["groups"]
    await db_session.commit()

    response = await client.post(
        f"/api/v2/assessments/{assessment.id}/approve",
        headers=await headers(client, seeded["approver"]),
        json={"expectedVersion": 1, "comment": "approved privately"},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "APPROVED"
    assert body["version"] == 2
    assert body["totalScore"] == body["contributionScore"] == 8.0
    assert body["attitudeScore"] is None
    assert body["templateSnapshot"] == seeded["snapshot"]
    logs = await activity_logs(db_session, assessment_id)
    assert len(logs) == 1
    assert logs[0].action == "assessment.approved"
    assert logs[0].actor_id == approver_id
    assert logs[0].company_id == seeded["company"].id
    assert logs[0].changes == {
        "fromStatus": "SUBMITTED",
        "toStatus": "APPROVED",
        "fromVersion": 1,
        "toVersion": 2,
        "cycleId": str(assessment.cycle_id),
        "revieweeId": str(assessment.reviewee_id),
        "reviewerId": str(assessment.reviewer_id),
        "scores": {"totalScore": 8.0, "contributionScore": 8.0, "attitudeScore": None},
    }
    serialized = json.dumps(logs[0].changes)
    assert "private answer" not in serialized
    assert "private assessment comment" not in serialized
    assert "approved privately" not in serialized
    db_session.expire_all()
    persisted = await db_session.get(Assessment, assessment_id)
    assert persisted is not None
    assert persisted.approved_by_id == approver_id
    assert persisted.approved_at is not None
    assert persisted.template_snapshot == seeded["snapshot"]


@pytest.mark.parametrize("status", ["DRAFT", "APPROVED", "REJECTED"])
async def test_review_actions_reject_invalid_source_states_with_typed_409(
    client: AsyncClient, db_session: AsyncSession, status: str
) -> None:
    seeded = await setup_assessment(db_session, status=status)
    assessment = seeded["assessment"]
    response = await client.post(
        f"/api/v2/assessments/{assessment.id}/approve",
        headers=await headers(client, seeded["approver"]),
        json={"expectedVersion": 1},
    )

    assert response.status_code == 409
    assert response.json()["detail"] == {"code": "invalid_state", "currentStatus": status}
    assert await activity_logs(db_session, assessment.id) == []


async def test_review_enforces_tenant_permission_and_self_approval_boundaries(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    seeded = await setup_assessment(db_session)
    assessment = seeded["assessment"]
    no_permission = await user(
        db_session,
        seeded["company"],
        email="no-permission@assessment.dev",
        role=Role.COMPANY_ADMIN,
    )
    other_company = Company(name="Other assessment company")
    db_session.add(other_company)
    await db_session.flush()
    outsider = await user(
        db_session,
        other_company,
        email="outsider@assessment.dev",
        role=Role.COMPANY_ADMIN,
        permissions=[AdminPermission.ASSESSMENT_REVIEW.value],
    )
    await db_session.commit()

    for actor in (no_permission, outsider):
        response = await client.post(
            f"/api/v2/assessments/{assessment.id}/approve",
            headers=await headers(client, actor),
            json={"expectedVersion": 1},
        )
        assert response.status_code == 403

    self_seeded = await setup_assessment(db_session, self_approve=True, suffix="-self")
    self_response = await client.post(
        f"/api/v2/assessments/{self_seeded['assessment'].id}/approve",
        headers=await headers(client, self_seeded["approver"]),
        json={"expectedVersion": 1},
    )
    assert self_response.status_code == 403
    assert await activity_logs(db_session, assessment.id) == []
    assert await activity_logs(db_session, self_seeded["assessment"].id) == []


@pytest.mark.parametrize(
    ("action", "target_status", "audit_action"),
    [
        ("reject", "REJECTED", "assessment.rejected"),
        ("request-revision", "DRAFT", "assessment.revision_requested"),
    ],
)
async def test_reject_and_request_revision_require_reason_and_emit_one_safe_audit(
    client: AsyncClient,
    db_session: AsyncSession,
    action: str,
    target_status: str,
    audit_action: str,
) -> None:
    seeded = await setup_assessment(db_session)
    assessment = seeded["assessment"]
    assessment_id = assessment.id
    actor_headers = await headers(client, seeded["approver"])
    missing_reason = await client.post(
        f"/api/v2/assessments/{assessment.id}/{action}",
        headers=actor_headers,
        json={"expectedVersion": 1, "comment": " "},
    )
    assert missing_reason.status_code == 422

    response = await client.post(
        f"/api/v2/assessments/{assessment.id}/{action}",
        headers=actor_headers,
        json={"expectedVersion": 1, "comment": "private revision reason"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["status"] == target_status
    assert response.json()["reviewComment"] == "private revision reason"
    duplicate = await client.post(
        f"/api/v2/assessments/{assessment.id}/{action}",
        headers=actor_headers,
        json={"expectedVersion": 2, "comment": "duplicate"},
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["detail"] == {
        "code": "invalid_state",
        "currentStatus": target_status,
    }
    logs = await activity_logs(db_session, assessment_id)
    assert [log.action for log in logs] == [audit_action]
    assert logs[0].changes["reasonProvided"] is True
    assert "private revision reason" not in json.dumps(logs[0].changes)
    db_session.expire_all()
    persisted = await db_session.get(Assessment, assessment_id)
    assert persisted is not None
    assert persisted.approved_by_id is None
    assert persisted.approved_at is None


async def test_request_revision_edit_and_resubmit_never_sets_approval_metadata(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    seeded = await setup_assessment(db_session)
    assessment_id = seeded["assessment"].id
    approver_headers = await headers(client, seeded["approver"])
    reviewee_headers = await headers(client, seeded["reviewee"])

    revision = await client.post(
        f"/api/v2/assessments/{assessment_id}/request-revision",
        headers=approver_headers,
        json={"expectedVersion": 1, "comment": "add evidence"},
    )
    assert revision.status_code == 200, revision.text
    assert revision.json()["status"] == "DRAFT"
    assert revision.json()["version"] == 2

    edited = await client.patch(
        f"/api/v2/assessments/{assessment_id}",
        headers=reviewee_headers,
        json={
            "expectedVersion": 2,
            "answers": [
                {"questionId": "delivery", "score": 9, "comment": "new evidence"}
            ],
        },
    )
    assert edited.status_code == 200, edited.text
    assert edited.json()["status"] == "DRAFT"
    assert edited.json()["version"] == 3

    resubmitted = await client.post(
        f"/api/v2/assessments/{assessment_id}/submit",
        headers=reviewee_headers,
        json={
            "expectedVersion": 3,
            "answers": [
                {"questionId": "delivery", "score": 9, "comment": "new evidence"}
            ],
        },
    )
    assert resubmitted.status_code == 200, resubmitted.text
    assert resubmitted.json()["status"] == "SUBMITTED"
    assert resubmitted.json()["version"] == 4

    db_session.expire_all()
    persisted = await db_session.get(Assessment, assessment_id)
    assert persisted is not None
    assert persisted.approved_by_id is None
    assert persisted.approved_at is None
    assert [log.action for log in await activity_logs(db_session, assessment_id)] == [
        "assessment.revision_requested"
    ]


async def test_rejected_assessment_cannot_be_edited_or_resubmitted(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    seeded = await setup_assessment(db_session)
    assessment = seeded["assessment"]
    await client.post(
        f"/api/v2/assessments/{assessment.id}/reject",
        headers=await headers(client, seeded["approver"]),
        json={"expectedVersion": 1, "comment": "terminal rejection"},
    )

    response = await client.patch(
        f"/api/v2/assessments/{assessment.id}",
        headers=await headers(client, seeded["reviewee"]),
        json={"expectedVersion": 2, "answers": []},
    )
    assert response.status_code == 409
    assert response.json()["detail"] == {
        "code": "invalid_state",
        "currentStatus": "REJECTED",
    }


async def test_audit_exception_rolls_back_the_entire_approval(
    client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seeded = await setup_assessment(db_session)
    assessment = seeded["assessment"]
    assessment_id = assessment.id
    actor_headers = await headers(client, seeded["approver"])

    async def fail_audit(*args: object, **kwargs: object) -> ActivityLog:
        raise RuntimeError("synthetic assessment audit failure")

    monkeypatch.setattr(ActivityLogRepository, "log", fail_audit)
    with pytest.raises(RuntimeError, match="synthetic assessment audit failure"):
        await client.post(
            f"/api/v2/assessments/{assessment_id}/approve",
            headers=actor_headers,
            json={"expectedVersion": 1},
        )

    await db_session.rollback()
    db_session.expire_all()
    persisted = await db_session.get(Assessment, assessment_id)
    assert persisted is not None
    assert persisted.status == "SUBMITTED"
    assert persisted.version == 1
    assert persisted.total_score == persisted.contribution_score == 1
    assert persisted.approved_by_id is None
    assert persisted.approved_at is None
    assert await activity_logs(db_session, assessment_id) == []


async def test_concurrent_double_approve_has_one_winner_and_one_audit_on_postgresql(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    if db_session.bind is None or db_session.bind.dialect.name != "postgresql":
        pytest.skip("PostgreSQL is required for row-lock concurrency coverage")
    seeded = await setup_assessment(db_session)
    assessment = seeded["assessment"]
    assessment_id = assessment.id
    actor_headers = await headers(client, seeded["approver"])
    release_selects = asyncio.Event()
    select_arrivals = 0
    arrival_lock = asyncio.Lock()

    class BarrierSession(AsyncSession):
        async def scalar(self, statement, *args, **kwargs):
            nonlocal select_arrivals
            if isinstance(statement, Select) and statement._for_update_arg is not None:
                async with arrival_lock:
                    select_arrivals += 1
                    if select_arrivals == 2:
                        release_selects.set()
                await asyncio.wait_for(release_selects.wait(), timeout=3)
            return await super().scalar(statement, *args, **kwargs)

    session_factory = async_sessionmaker(
        db_session.bind, class_=BarrierSession, expire_on_commit=False
    )

    async def concurrent_session():
        async with session_factory() as session:
            yield session

    original_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = concurrent_session
    try:
        async with (
            AsyncClient(transport=ASGITransport(app=app), base_url="http://approver-a") as first,
            AsyncClient(transport=ASGITransport(app=app), base_url="http://approver-b") as second,
        ):
            responses = await asyncio.wait_for(
                asyncio.gather(
                    first.post(
                        f"/api/v2/assessments/{assessment_id}/approve",
                        headers=actor_headers,
                        json={"expectedVersion": 1},
                    ),
                    second.post(
                        f"/api/v2/assessments/{assessment_id}/approve",
                        headers=actor_headers,
                        json={"expectedVersion": 1},
                    ),
                ),
                timeout=10,
            )
    finally:
        if original_override is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = original_override

    assert select_arrivals == 2
    assert sorted(response.status_code for response in responses) == [200, 409]
    loser = next(response for response in responses if response.status_code == 409)
    assert loser.json()["detail"] == {"code": "version_conflict", "currentVersion": 2}
    assert len(await activity_logs(db_session, assessment_id)) == 1
    db_session.expire_all()
    persisted = await db_session.get(Assessment, assessment_id)
    assert persisted is not None
    assert persisted.status == "APPROVED"
    assert persisted.version == 2
