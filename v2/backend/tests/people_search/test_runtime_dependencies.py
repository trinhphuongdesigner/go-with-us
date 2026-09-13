import json

import pytest

from app.domain.models import Skill
from app.people_search.intent import get_intent_compiler
from tests.people_search.test_intent import intent_data


@pytest.mark.asyncio
async def test_runtime_compiler_resolves_skills_from_database(db_session, monkeypatch) -> None:
    react = Skill(name="React", normalized_key="react", category="Engineering")
    db_session.add(react)
    await db_session.flush()

    async def fake_send_chat(*_args, **_kwargs):
        return {
            "content": json.dumps(
                intent_data(
                    title_keywords=[],
                    skills=[
                        {
                            "name": "React",
                            "required": True,
                            "minimum_years": 2.0,
                        }
                    ],
                )
            )
        }

    monkeypatch.setattr("app.ai.shared_provider.send_chat", fake_send_chat)

    compiler = await get_intent_compiler(db_session)
    result = await compiler.compile(
        "Tìm người có React và ít nhất 2 năm kinh nghiệm",
        tenant_id=react.id,
        actor_id=react.id,
    )

    assert result.provider_failed is False
    assert result.intent is not None
    assert result.intent.skills[0].canonical_skill_id == react.id
    assert result.plan.interpretation is not None
    assert result.plan.interpretation.skills[0].canonical_skill_id == react.id
