import json

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.career_ai.models import AssistantConversation, AssistantMessage
from app.career_ai.routes import ask_assistant, get_conversation
from app.career_ai.schemas import AssistantQuery
from app.company_memberships import CompanyMembership
from app.domain.enums import AdminPermission, Role
from app.domain.models import Company, User
from app.security.jwt import hash_password


async def test_reused_general_conversation_is_locked_after_it_receives_roster_context(
    db_session, monkeypatch
):
    company = Company(name="Conversation security tenant")
    db_session.add(company)
    await db_session.flush()
    actor = User(
        email="conversation-hr@example.com",
        name="Conversation HR",
        role=Role.HR,
        company_id=company.id,
        hashed_password=hash_password("ConversationTest123!"),
        admin_permissions=[AdminPermission.EMPLOYEE_READ.value],
    )
    employee = User(
        email="conversation-employee@example.com",
        name="Authorized Employee",
        job_title="Software Engineer",
        role=Role.EMPLOYEE,
        company_id=company.id,
        hashed_password=hash_password("ConversationTest123!"),
    )
    db_session.add_all([actor, employee])
    await db_session.flush()
    db_session.add(CompanyMembership(user_id=actor.id, company_id=company.id))
    conversation = AssistantConversation(
        owner_user_id=actor.id,
        company_id=company.id,
        context_company_id=company.id,
        uses_roster=False,
        title="General conversation created before roster access",
        focus="GENERAL",
        category="WORK",
    )
    db_session.add(conversation)
    await db_session.commit()

    async def grounded_reply(_db, _system, _messages):
        return {
            "content": json.dumps(
                {
                    "answer": "ignored for roster responses",
                    "referencedUserIds": [],
                    "rosterClaims": [
                        {
                            "candidateRef": "candidate-1",
                            "evidenceRefs": ["candidate-1-profile"],
                        }
                    ],
                }
            )
        }

    monkeypatch.setattr("app.career_ai.routes.send_chat", grounded_reply)
    await ask_assistant(
        AssistantQuery(question="Ai đang ở trong đội?", conversation_id=conversation.id),
        db_session,
        actor,
    )
    await db_session.refresh(conversation)

    assert conversation.uses_roster is True
    assert conversation.context_company_id == company.id
    assistant_message = await db_session.scalar(
        select(AssistantMessage).where(
            AssistantMessage.conversation_id == conversation.id,
            AssistantMessage.role == "assistant",
        )
    )
    assert assistant_message is not None
    assert (
        assistant_message.content == "- Authorized Employee: Chức danh hiện tại: Software Engineer"
    )
    assert assistant_message.referenced_user_ids == [str(employee.id)]

    actor.admin_permissions = []
    await db_session.commit()
    with pytest.raises(HTTPException) as error:
        await get_conversation(db_session, actor, conversation.id)
    assert error.value.status_code == 403


async def test_roster_answer_without_evidence_bound_claim_is_not_persisted(db_session, monkeypatch):
    company = Company(name="Roster claim boundary tenant")
    db_session.add(company)
    await db_session.flush()
    actor = User(
        email="roster-claim-hr@example.com",
        name="Roster Claim HR",
        role=Role.HR,
        company_id=company.id,
        hashed_password=hash_password("ConversationTest123!"),
        admin_permissions=[AdminPermission.EMPLOYEE_READ.value],
    )
    employee = User(
        email="roster-claim-employee@example.com",
        name="Known Employee",
        role=Role.EMPLOYEE,
        company_id=company.id,
        hashed_password=hash_password("ConversationTest123!"),
    )
    db_session.add_all([actor, employee])
    await db_session.flush()
    db_session.add(CompanyMembership(user_id=actor.id, company_id=company.id))
    await db_session.commit()

    async def ungrounded_reply(_db, _system, _messages):
        return {
            "content": json.dumps(
                {
                    "answer": "Người Ngoài là BOD.",
                    "referencedUserIds": [],
                    "rosterClaims": [],
                }
            )
        }

    monkeypatch.setattr("app.career_ai.routes.send_chat", ungrounded_reply)
    with pytest.raises(HTTPException) as error:
        await ask_assistant(
            AssistantQuery(question="Ai phù hợp nhất?", company_id=company.id),
            db_session,
            actor,
        )

    assert error.value.status_code == 502
    assert (await db_session.scalars(select(AssistantConversation))).all() == []
    assert (await db_session.scalars(select(AssistantMessage))).all() == []


async def test_roster_claim_cannot_cite_evidence_from_outside_its_candidate(
    db_session, monkeypatch
):
    company = Company(name="Roster evidence boundary tenant")
    db_session.add(company)
    await db_session.flush()
    actor = User(
        email="roster-evidence-hr@example.com",
        name="Roster Evidence HR",
        role=Role.HR,
        company_id=company.id,
        hashed_password=hash_password("ConversationTest123!"),
        admin_permissions=[AdminPermission.EMPLOYEE_READ.value],
    )
    employee = User(
        email="roster-evidence-employee@example.com",
        name="Known Employee",
        role=Role.EMPLOYEE,
        company_id=company.id,
        hashed_password=hash_password("ConversationTest123!"),
    )
    db_session.add_all([actor, employee])
    await db_session.flush()
    db_session.add(CompanyMembership(user_id=actor.id, company_id=company.id))
    await db_session.commit()

    async def invalid_evidence_reply(_db, _system, _messages):
        return {
            "content": json.dumps(
                {
                    "answer": "ignored",
                    "referencedUserIds": [],
                    "rosterClaims": [
                        {
                            "candidateRef": "candidate-1",
                            "evidenceRefs": ["candidate-2-project-1"],
                        }
                    ],
                }
            )
        }

    monkeypatch.setattr("app.career_ai.routes.send_chat", invalid_evidence_reply)
    with pytest.raises(HTTPException) as error:
        await ask_assistant(
            AssistantQuery(question="Ai phù hợp nhất?", company_id=company.id),
            db_session,
            actor,
        )

    assert error.value.status_code == 502
    assert (await db_session.scalars(select(AssistantConversation))).all() == []
    assert (await db_session.scalars(select(AssistantMessage))).all() == []


@pytest.mark.parametrize(
    ("case", "bad_reference"),
    [
        ("malformed", "not-a-uuid"),
        ("unknown", "00000000-0000-0000-0000-000000000099"),
        ("mixed", "00000000-0000-0000-0000-000000000099"),
    ],
)
async def test_assistant_rejects_invalid_employee_references_before_persistence(
    db_session, monkeypatch, case, bad_reference
):
    company = Company(name="Assistant fail-closed tenant")
    db_session.add(company)
    await db_session.flush()
    actor = User(
        email=f"assistant-fail-closed-{case}@example.com",
        name="Assistant HR",
        role=Role.HR,
        company_id=company.id,
        hashed_password=hash_password("ConversationTest123!"),
        admin_permissions=[AdminPermission.EMPLOYEE_READ.value],
    )
    employee = User(
        email=f"known-employee-{case}@example.com",
        name="Known Employee",
        role=Role.EMPLOYEE,
        company_id=company.id,
        hashed_password=hash_password("ConversationTest123!"),
    )
    db_session.add_all([actor, employee])
    await db_session.flush()
    db_session.add(CompanyMembership(user_id=actor.id, company_id=company.id))
    await db_session.commit()

    async def ungrounded_reply(_db, _system, _messages):
        return {
            "content": json.dumps(
                {
                    "answer": "Nhân sự không có trong dữ liệu được phép.",
                    "referencedUserIds": (
                        [str(employee.id), bad_reference] if case == "mixed" else [bad_reference]
                    ),
                }
            )
        }

    monkeypatch.setattr("app.career_ai.routes.send_chat", ungrounded_reply)
    with pytest.raises(HTTPException) as error:
        await ask_assistant(
            AssistantQuery(question="Ai phù hợp nhất?", company_id=company.id),
            db_session,
            actor,
        )

    assert error.value.status_code == 502
    assert (await db_session.scalars(select(AssistantConversation))).all() == []
    assert (await db_session.scalars(select(AssistantMessage))).all() == []
