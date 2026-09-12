from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.people_search.repository import search_candidates
from tests.people_search._helpers import create_company, create_employment, create_user


@pytest.mark.asyncio
async def test_tenant_isolation(db_session: AsyncSession) -> None:
    company_a = await create_company(db_session, "A")
    company_b = await create_company(db_session, "B")
    user_a = await create_user(db_session, email="a@a.dev", password="Password123!", company=company_a)
    await create_user(db_session, email="b@b.dev", password="Password123!", company=company_b)
    await create_employment(db_session, user=user_a, company=company_a, title="Engineer", years_ago_start=2)

    rows = await search_candidates(db_session, company_id=company_a.id, title_terms=[])
    assert {row.user.email for row in rows} == {"a@a.dev"}


@pytest.mark.asyncio
async def test_title_term_filters_candidates(db_session: AsyncSession) -> None:
    company = await create_company(db_session, "C")
    engineer = await create_user(
        db_session, email="eng@c.dev", password="Password123!", company=company, job_title="Backend Engineer"
    )
    sales = await create_user(
        db_session, email="sales@c.dev", password="Password123!", company=company, job_title="Sales Rep"
    )
    await create_employment(db_session, user=engineer, company=company, title="Backend Engineer", years_ago_start=3)
    await create_employment(db_session, user=sales, company=company, title="Sales Rep", years_ago_start=3)

    rows = await search_candidates(db_session, company_id=company.id, title_terms=["engineer"])
    assert {row.user.email for row in rows} == {"eng@c.dev"}


@pytest.mark.asyncio
async def test_experience_years_computed_from_employment_dates(db_session: AsyncSession) -> None:
    company = await create_company(db_session, "D")
    user = await create_user(db_session, email="d@d.dev", password="Password123!", company=company)
    await create_employment(db_session, user=user, company=company, title="Engineer", years_ago_start=4)

    rows = await search_candidates(db_session, company_id=company.id, title_terms=[])
    assert rows[0].total_experience_years == pytest.approx(4.0, abs=0.05)

@pytest.mark.asyncio
async def test_requires_active_employment_and_filters_before_limit(db_session: AsyncSession) -> None:
    company = await create_company(db_session, "Eligible")
    ended = await create_user(db_session, email="a-ended@x.dev", password="Password123!", company=company)
    await create_employment(db_session, user=ended, company=company, title="Engineer", years_ago_start=3, years_ago_end=1)
    for index in range(26):
        user = await create_user(
            db_session,
            email=f"b{index:02d}@x.dev",
            password="Password123!",
            company=company,
            job_title="Sales",
        )
        await create_employment(db_session, user=user, company=company, title="Sales", years_ago_start=2)
    match = await create_user(
        db_session, email="z-match@x.dev", password="Password123!", company=company, job_title="Engineer"
    )
    await create_employment(db_session, user=match, company=company, title="Engineer", years_ago_start=2)

    rows = await search_candidates(db_session, company_id=company.id, title_terms=["Engineer"], limit=25)

    assert [row.user.email for row in rows] == ["z-match@x.dev"]


@pytest.mark.asyncio
async def test_required_terms_are_and_preferred_terms_do_not_filter(db_session: AsyncSession) -> None:
    company = await create_company(db_session, "Terms")
    both = await create_user(
        db_session, email="both@x.dev", password="Password123!", company=company, job_title="React TypeScript"
    )
    one = await create_user(
        db_session, email="one@x.dev", password="Password123!", company=company, job_title="React Python"
    )
    for user in (both, one):
        await create_employment(db_session, user=user, company=company, title=user.job_title or "", years_ago_start=3)

    rows = await search_candidates(
        db_session,
        company_id=company.id,
        title_terms=[],
        required_terms=["React", "TypeScript"],
        preferred_terms=["Python"],
    )
    assert [row.user.email for row in rows] == ["both@x.dev"]


@pytest.mark.asyncio
async def test_minimum_total_experience_is_hard_filter(db_session: AsyncSession) -> None:
    company = await create_company(db_session, "Experience")
    junior = await create_user(db_session, email="junior@x.dev", password="Password123!", company=company)
    senior = await create_user(db_session, email="senior@x.dev", password="Password123!", company=company)
    await create_employment(db_session, user=junior, company=company, title="Engineer", years_ago_start=1)
    await create_employment(db_session, user=senior, company=company, title="Engineer", years_ago_start=5)

    rows = await search_candidates(
        db_session, company_id=company.id, title_terms=[], min_total_experience_years=3
    )
    assert [row.user.email for row in rows] == ["senior@x.dev"]


@pytest.mark.asyncio
async def test_invalid_employment_does_not_break_valid_tenant_results(db_session: AsyncSession) -> None:
    company = await create_company(db_session, "Invalid interval")
    invalid = await create_user(db_session, email="invalid@x.dev", password="Password123!", company=company)
    valid = await create_user(db_session, email="valid@x.dev", password="Password123!", company=company)
    bad_employment = await create_employment(
        db_session, user=invalid, company=company, title="Engineer", years_ago_start=1
    )
    bad_employment.start_date = datetime.now(UTC) + timedelta(days=1)
    await db_session.commit()
    await create_employment(db_session, user=valid, company=company, title="Engineer", years_ago_start=2)

    rows = await search_candidates(db_session, company_id=company.id, title_terms=[])

    assert [row.user.email for row in rows] == ["valid@x.dev"]
