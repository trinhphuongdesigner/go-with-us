import unicodedata
import uuid
from datetime import UTC, datetime
from uuid import uuid4

from app.domain.enums import ProfileSourceType, Role
from app.domain.models import Company, Employment, Experience, User
from app.people_search.rag import (
    GeneratedCandidateReason,
    GeneratedRagAnswer,
    PeopleRagService,
    StructuredProfileRagRepository,
    query_terms,
)
from app.people_search.schemas import RagCandidateRead, RagEvidenceRead
from tests.people_search._helpers import create_company, create_employment, create_user


def candidate(name: str = "Nguyen An") -> RagCandidateRead:
    company_id = uuid4()
    return RagCandidateRead(
        user_id=uuid4(),
        name=name,
        title="Frontend Engineer",
        company_id=company_id,
        matched_terms=["react"],
        reason="Dữ liệu hồ sơ khớp trực tiếp với: react.",
        evidence=[
            RagEvidenceRead(
                source_type="skill",
                source_id=uuid4(),
                label="Kỹ năng: React",
                excerpt="React, mức độ 4/5. Built React design systems",
                verified=False,
            )
        ],
    )


async def test_rag_service_keeps_retrieval_order_and_applies_grounded_ai_reasons():
    retrieved = [candidate("Nguyen An"), candidate("Tran Binh")]

    class Repository:
        async def search(self, query, *, company_id, allowed_roles, limit=8):
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
        "Ai có kinh nghiệm React?",
        company_id=retrieved[0].company_id,
        allowed_roles=(Role.EMPLOYEE,),
    )

    assert result.answer_source == "ai"
    assert result.answer == "Hai hồ sơ có bằng chứng React phù hợp."
    assert [item.name for item in result.candidates] == ["Nguyen An", "Tran Binh"]
    assert result.candidates[0].reason == "Có kinh nghiệm xây dựng React design system."
    assert result.warnings == []


async def test_rag_service_rejects_invented_references_and_falls_back():
    retrieved = [candidate()]

    class Repository:
        async def search(self, query, *, company_id, allowed_roles, limit=8):
            return retrieved

    class Answerer:
        async def summarize(self, query, candidates):
            return GeneratedRagAnswer(
                answer="Có thêm một ứng viên rất phù hợp.",
                candidate_reasons=[
                    GeneratedCandidateReason(
                        candidate_ref="candidate-8",
                        reason="Ứng viên do AI thêm vào.",
                        evidence_refs=["candidate-8-evidence-1"],
                    )
                ],
            )

    result = await PeopleRagService(Repository(), Answerer()).search(
        "Ai có kinh nghiệm React?",
        company_id=retrieved[0].company_id,
        allowed_roles=(Role.EMPLOYEE,),
    )

    assert result.answer_source == "deterministic_fallback"
    assert [item.name for item in result.candidates] == ["Nguyen An"]
    assert "candidate-8" not in result.model_dump_json()
    assert result.warnings == ["ai_summary_invalid_grounding"]


async def test_rag_service_rejects_an_uncited_summary_and_falls_back():
    retrieved = [candidate("Nguyen An"), candidate("Tran Binh")]

    class Repository:
        async def search(self, query, *, company_id, allowed_roles, limit=8):
            return retrieved

    class Answerer:
        async def summarize(self, query, candidates):
            return GeneratedRagAnswer(
                answer="candidate-1 phù hợp nhất; candidate-2 là lựa chọn tiếp theo.",
                candidate_reasons=[],
            )

    result = await PeopleRagService(Repository(), Answerer()).search(
        "Ai có kinh nghiệm React?",
        company_id=retrieved[0].company_id,
        allowed_roles=(Role.EMPLOYEE,),
    )

    assert result.answer_source == "deterministic_fallback"
    assert result.answer == "Tìm thấy 2 nhân sự có dữ liệu hồ sơ khớp trực tiếp với yêu cầu."
    assert "candidate-" not in result.answer
    assert result.warnings == ["ai_summary_invalid_grounding"]


async def test_rag_service_rejects_a_candidate_mentioned_without_its_evidence_reason():
    retrieved = [candidate("Nguyen An"), candidate("Tran Binh")]

    class Repository:
        async def search(self, query, *, company_id, allowed_roles, limit=8):
            return retrieved

    class Answerer:
        async def summarize(self, query, candidates):
            return GeneratedRagAnswer(
                answer="candidate-2 phù hợp nhất.",
                candidate_reasons=[
                    GeneratedCandidateReason(
                        candidate_ref="candidate-1",
                        reason="Có bằng chứng React.",
                        evidence_refs=["candidate-1-evidence-1"],
                    )
                ],
            )

    result = await PeopleRagService(Repository(), Answerer()).search(
        "Ai có kinh nghiệm React?",
        company_id=retrieved[0].company_id,
        allowed_roles=(Role.EMPLOYEE,),
    )

    assert result.answer_source == "deterministic_fallback"
    assert result.warnings == ["ai_summary_invalid_grounding"]


def test_query_terms_remove_generic_vietnamese_staffing_words():
    assert query_terms("Ai phù hợp dẫn dắt dự án React trong quý tới?") == (
        "dan",
        "dat",
        "react",
    )
    assert query_terms("Tìm người có FastAPI và PostgreSQL cho dự án AI nội bộ.") == (
        "fastapi",
        "postgresql",
    )
    assert query_terms(
        "Ai có kinh nghiệm Figma và accessibility để cải thiện hành trình nhân viên?"
    ) == ("figma", "accessibility")
    assert query_terms("đạo") == ("dao",)


async def test_structured_rag_repository_only_returns_authorized_role_subset(db_session):
    company = await create_company(db_session)
    bod = await create_user(
        db_session,
        email="bod-rag@example.com",
        password="safe-password",
        company=company,
        role=Role.BOD,
        job_title="React Engineering Lead",
    )
    hr = await create_user(
        db_session,
        email="hr-rag@example.com",
        password="safe-password",
        company=company,
        role=Role.HR,
        job_title="React Talent Partner",
    )
    employee = await create_user(
        db_session,
        email="employee-rag@example.com",
        password="safe-password",
        company=company,
        role=Role.EMPLOYEE,
        job_title="React Engineer",
    )
    for user in (bod, hr, employee):
        await create_employment(
            db_session,
            user=user,
            company=company,
            title=user.job_title or "React",
            years_ago_start=1,
        )

    candidates = await StructuredProfileRagRepository(db_session).search(
        "React",
        company_id=company.id,
        allowed_roles=(Role.EMPLOYEE,),
    )

    assert [candidate.user_id for candidate in candidates] == [employee.id]


async def test_structured_rag_bounds_long_evidence_around_the_matching_term(db_session):
    company = await create_company(db_session, "Long evidence company")
    employee = await create_user(
        db_session,
        email="long-rag-evidence@example.com",
        password="safe-password",
        company=company,
        job_title="Backend Engineer",
    )
    await create_employment(
        db_session,
        user=employee,
        company=company,
        title="Backend Engineer",
        years_ago_start=2,
    )
    db_session.add(
        Experience(
            user_id=employee.id,
            company_id=company.id,
            title="Platform modernization",
            organization="CareerMate",
            description=unicodedata.normalize("NFD", "Reactive ế " * 400)
            + "React architecture ownership",
            source_type=ProfileSourceType.SELF,
            created_by=employee.id,
            updated_by=employee.id,
        )
    )
    await db_session.commit()

    candidates = await StructuredProfileRagRepository(db_session).search(
        "React",
        company_id=company.id,
        allowed_roles=(Role.EMPLOYEE,),
    )

    assert [candidate.user_id for candidate in candidates] == [employee.id]
    excerpt = candidates[0].evidence[0].excerpt
    assert len(excerpt) <= 1200
    assert "React architecture ownership" in excerpt


async def test_structured_rag_prefilter_matches_unaccented_vietnamese_query(db_session):
    company = await create_company(db_session, "Vietnamese search company")
    employee = await create_user(
        db_session,
        email="architect-rag@example.com",
        password="safe-password",
        company=company,
        job_title="Kiến trúc giải pháp",
    )
    await create_employment(
        db_session,
        user=employee,
        company=company,
        title="Kiến trúc giải pháp",
        years_ago_start=2,
    )

    candidates = await StructuredProfileRagRepository(db_session).search(
        "kien truc",
        company_id=company.id,
        allowed_roles=(Role.EMPLOYEE,),
    )

    assert [candidate.user_id for candidate in candidates] == [employee.id]


async def test_structured_rag_sql_and_python_share_unicode_token_boundaries(db_session):
    company = await create_company(db_session, "Unicode token company")
    unicode_dash = await create_user(
        db_session,
        email="unicode-dash-rag@example.com",
        password="safe-password",
        company=company,
        job_title="React–PostgreSQL Engineer",
    )
    decomposed = await create_user(
        db_session,
        email="decomposed-rag@example.com",
        password="safe-password",
        company=company,
        job_title=unicodedata.normalize("NFD", "Kiến trúc giải pháp"),
    )
    uppercase_d = await create_user(
        db_session,
        email="uppercase-d-rag@example.com",
        password="safe-password",
        company=company,
        job_title="Đạo diễn sản phẩm",
    )
    for user in (unicode_dash, decomposed, uppercase_d):
        await create_employment(
            db_session,
            user=user,
            company=company,
            title=user.job_title or "Engineer",
            years_ago_start=2,
        )

    react_candidates = await StructuredProfileRagRepository(db_session).search(
        "React",
        company_id=company.id,
        allowed_roles=(Role.EMPLOYEE,),
    )
    architecture_candidates = await StructuredProfileRagRepository(db_session).search(
        "kien truc",
        company_id=company.id,
        allowed_roles=(Role.EMPLOYEE,),
    )
    director_candidates = await StructuredProfileRagRepository(db_session).search(
        "dao dien",
        company_id=company.id,
        allowed_roles=(Role.EMPLOYEE,),
    )

    assert [candidate.user_id for candidate in react_candidates] == [unicode_dash.id]
    assert [candidate.user_id for candidate in architecture_candidates] == [decomposed.id]
    assert [candidate.user_id for candidate in director_candidates] == [uppercase_d.id]


async def test_structured_rag_preserves_sql_order_for_equal_rank_candidates(db_session):
    company = await create_company(db_session, "Stable rank company")
    tango = await create_user(
        db_session,
        email="tango-rag@example.com",
        password="safe-password",
        company=company,
        job_title="React Engineer",
    )
    tango.name = "Tango"
    sharp_s = await create_user(
        db_session,
        email="sharp-s-rag@example.com",
        password="safe-password",
        company=company,
        job_title="React Engineer",
    )
    sharp_s.name = "ßeta"
    for user in (tango, sharp_s):
        await create_employment(
            db_session,
            user=user,
            company=company,
            title="React Engineer",
            years_ago_start=2,
        )
    await db_session.commit()

    candidates = await StructuredProfileRagRepository(db_session).search(
        "React",
        company_id=company.id,
        allowed_roles=(Role.EMPLOYEE,),
    )

    assert [candidate.user_id for candidate in candidates] == [tango.id, sharp_s.id]


async def test_structured_rag_orders_by_sql_relevance_before_candidate_cap(db_session):
    company = Company(id=uuid.UUID(int=10_000), name="Large search company")
    db_session.add(company)
    users = []
    employments = []
    for index in range(205):
        user = User(
            id=uuid.UUID(int=index + 1),
            email=f"react-{index}@example.com",
            name=f"React Candidate {index}",
            job_title="React Engineer",
            hashed_password="test",
            role=Role.EMPLOYEE,
            company_id=company.id,
        )
        users.append(user)
        employments.append(
            Employment(
                id=uuid.UUID(int=20_000 + index),
                user_id=user.id,
                company_id=company.id,
                title="React Engineer",
                start_date=datetime(2025, 1, 1, tzinfo=UTC),
                status="ACTIVE",
            )
        )
    best = User(
        id=uuid.UUID(int=999),
        email="best-react-postgres@example.com",
        name="Best Candidate",
        job_title="React PostgreSQL Engineer",
        hashed_password="test",
        role=Role.EMPLOYEE,
        company_id=company.id,
    )
    users.append(best)
    employments.append(
        Employment(
            id=uuid.UUID(int=30_000),
            user_id=best.id,
            company_id=company.id,
            title="React PostgreSQL Engineer",
            start_date=datetime(2025, 1, 1, tzinfo=UTC),
            status="ACTIVE",
        )
    )
    db_session.add_all([*users, *employments])
    await db_session.commit()

    candidates = await StructuredProfileRagRepository(db_session).search(
        "React PostgreSQL",
        company_id=company.id,
        allowed_roles=(Role.EMPLOYEE,),
    )

    assert candidates[0].user_id == best.id


async def test_structured_rag_exact_token_is_not_crowded_out_by_substrings(db_session):
    company = Company(id=uuid.UUID(int=30_000), name="Exact token search company")
    db_session.add(company)
    users = []
    employments = []
    for index in range(205):
        user = User(
            id=uuid.UUID(int=index + 1),
            email=f"reactive-{index}@example.com",
            name=f"Reactive Candidate {index}",
            job_title="Reactive Engineer",
            hashed_password="test",
            role=Role.EMPLOYEE,
            company_id=company.id,
        )
        users.append(user)
        employments.append(
            Employment(
                id=uuid.UUID(int=31_000 + index),
                user_id=user.id,
                company_id=company.id,
                title="Reactive Engineer",
                start_date=datetime(2025, 1, 1, tzinfo=UTC),
                status="ACTIVE",
            )
        )
    exact = User(
        id=uuid.UUID(int=39_999),
        email="exact-react@example.com",
        name="Exact React Candidate",
        job_title="React Engineer",
        hashed_password="test",
        role=Role.EMPLOYEE,
        company_id=company.id,
    )
    exact_employment = Employment(
        id=uuid.UUID(int=40_000),
        user_id=exact.id,
        company_id=company.id,
        title="React Engineer",
        start_date=datetime(2025, 1, 1, tzinfo=UTC),
        status="ACTIVE",
    )
    db_session.add_all([*users, *employments, exact, exact_employment])
    await db_session.commit()

    candidates = await StructuredProfileRagRepository(db_session).search(
        "React",
        company_id=company.id,
        allowed_roles=(Role.EMPLOYEE,),
    )

    assert [candidate.user_id for candidate in candidates] == [exact.id]


async def test_structured_rag_more_evidence_wins_before_candidate_cap(db_session):
    company = Company(id=uuid.UUID(int=50_000), name="Evidence rank search company")
    db_session.add(company)
    users = []
    employments = []
    for index in range(205):
        user = User(
            id=uuid.UUID(int=index + 1),
            email=f"single-evidence-{index}@example.com",
            name=f"Single Evidence Candidate {index}",
            job_title="React Engineer",
            hashed_password="test",
            role=Role.EMPLOYEE,
            company_id=company.id,
        )
        users.append(user)
        employments.append(
            Employment(
                id=uuid.UUID(int=51_000 + index),
                user_id=user.id,
                company_id=company.id,
                title="React Engineer",
                start_date=datetime(2025, 1, 1, tzinfo=UTC),
                status="ACTIVE",
            )
        )
    best = User(
        id=uuid.UUID(int=59_999),
        email="multi-evidence-react@example.com",
        name="Multi Evidence Candidate",
        job_title="React Engineer",
        hashed_password="test",
        role=Role.EMPLOYEE,
        company_id=company.id,
    )
    best_employment = Employment(
        id=uuid.UUID(int=60_000),
        user_id=best.id,
        company_id=company.id,
        title="React Engineer",
        start_date=datetime(2025, 1, 1, tzinfo=UTC),
        status="ACTIVE",
    )
    best_experience = Experience(
        id=uuid.UUID(int=60_001),
        user_id=best.id,
        company_id=company.id,
        title="React platform ownership",
        organization="CareerMate",
        source_type=ProfileSourceType.SELF,
        created_by=best.id,
        updated_by=best.id,
    )
    db_session.add_all([*users, *employments, best, best_employment])
    await db_session.flush()
    db_session.add(best_experience)
    await db_session.commit()

    candidates = await StructuredProfileRagRepository(db_session).search(
        "React",
        company_id=company.id,
        allowed_roles=(Role.EMPLOYEE,),
    )

    assert candidates[0].user_id == best.id
    assert len(candidates[0].evidence) == 2
