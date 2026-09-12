from uuid import uuid4

from app.people_search.rag import GeneratedCandidateReason, GeneratedRagAnswer, PeopleRagService
from app.people_search.schemas import RagCandidateRead, RagEvidenceRead


def candidate(name: str = "Nguyen An") -> RagCandidateRead:
    company_id = uuid4()
    return RagCandidateRead(
        user_id=uuid4(),
        name=name,
        title="Frontend Engineer",
        company_id=company_id,
        matched_terms=["react"],
        reason="Dữ liệu hồ sơ khớp trực tiếp với: react.",
        evidence=[RagEvidenceRead(
            source_type="skill",
            source_id=uuid4(),
            label="Kỹ năng: React",
            excerpt="React, mức độ 4/5. Built React design systems",
            verified=False,
        )],
    )


async def test_rag_service_keeps_retrieval_order_and_applies_grounded_ai_reasons():
    retrieved = [candidate("Nguyen An"), candidate("Tran Binh")]

    class Repository:
        async def search(self, query, *, company_id, limit=8):
            return retrieved

    class Answerer:
        async def summarize(self, query, candidates):
            assert [item.name for item in candidates] == ["Nguyen An", "Tran Binh"]
            return GeneratedRagAnswer(
                answer="Hai hồ sơ có bằng chứng React phù hợp.",
                candidate_reasons=[
                    GeneratedCandidateReason(
                        candidate_ref="candidate-2",
                        reason="Có bằng chứng kỹ năng React trong hồ sơ.",
                        evidence_refs=["candidate-2-evidence-1"],
                    ),
                    GeneratedCandidateReason(
                        candidate_ref="candidate-1",
                        reason="Có kinh nghiệm xây dựng React design system.",
                        evidence_refs=["candidate-1-evidence-1"],
                    ),
                ],
            )

    result = await PeopleRagService(Repository(), Answerer()).search(
        "Ai có kinh nghiệm React?", company_id=retrieved[0].company_id
    )

    assert result.answer_source == "ai"
    assert result.answer == "Hai hồ sơ có bằng chứng React phù hợp."
    assert [item.name for item in result.candidates] == ["Nguyen An", "Tran Binh"]
    assert result.candidates[0].reason == "Có kinh nghiệm xây dựng React design system."
    assert result.warnings == []


async def test_rag_service_rejects_invented_references_and_falls_back():
    retrieved = [candidate()]

    class Repository:
        async def search(self, query, *, company_id, limit=8):
            return retrieved

    class Answerer:
        async def summarize(self, query, candidates):
            return GeneratedRagAnswer(
                answer="Có thêm một ứng viên rất phù hợp.",
                candidate_reasons=[GeneratedCandidateReason(
                    candidate_ref="candidate-8",
                    reason="Ứng viên do AI thêm vào.",
                    evidence_refs=["candidate-8-evidence-1"],
                )],
            )

    result = await PeopleRagService(Repository(), Answerer()).search(
        "Ai có kinh nghiệm React?", company_id=retrieved[0].company_id
    )

    assert result.answer_source == "deterministic_fallback"
    assert [item.name for item in result.candidates] == ["Nguyen An"]
    assert "candidate-8" not in result.model_dump_json()
    assert result.warnings == ["ai_summary_invalid_grounding"]
