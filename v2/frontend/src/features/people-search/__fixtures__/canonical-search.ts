// Synthetic API response used only by tests. No real personnel or provider data.
import type { PeopleSearchResponse } from "../people-search-api";

const ref = {
  subject_id: "00000000-0000-4000-8000-000000000010",
  tenant_id: "00000000-0000-4000-8000-000000000001",
  source_id: "00000000-0000-4000-8000-000000000020",
  source_version_id: "00000000-0000-4000-8000-000000000021",
  block_id: "00000000-0000-4000-8000-000000000022",
  char_start: 0,
  char_end: 25,
  quote: "Kinh nghiệm React: 3 năm.",
  quote_sha256: "4bf1b2164acbe8ef1b9a8ba7584b7229284d72dfb0f737cb06a95b956b327baf",
};

export const canonicalSearchResponse: PeopleSearchResponse = {
  status: "ok",
  plan: { raw_query: "React trên 2 năm", required_skills: [{ phrase: "React", required: true }], preferred_skills: [], min_experience_years: null, availability: null, needs_clarification: false, clarification_reason: null },
  candidates: [{
    candidate_id: ref.subject_id,
    company_id: ref.tenant_id,
    name: "Nhân sự minh họa",
    title: "Frontend Engineer",
    score: 100,
    score_version: "people-search-canonical-v1",
    score_factors: [{ code: "REQUIRED_SKILL", points: 100, maximum_points: 100, evidence_refs: [ref] }],
    evidence_refs: [ref],
    data_freshness_at: "2026-09-12T00:00:00Z",
    explanation: null,
  }],
  unsupported_reasons: [],
  explanation: null,
  explanation_source: "deterministic_fallback",
};
