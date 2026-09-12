import { afterEach, describe, expect, it, vi } from "vitest";

import { compileQuery, PeopleSearchApiError, searchPeople } from "@/features/people-search/people-search-api";
import { canonicalSearchResponse } from "./__fixtures__/canonical-search";
import { searchInterpretation } from "./__fixtures__/search-interpretation";

const contractResponse = {
  status: "ok",
  plan: {
    raw_query: "React",
    required_skills: [{ phrase: "React", required: true }],
    preferred_skills: [],
    min_experience_years: 2,
    availability: null,
    needs_clarification: false,
    clarification_reason: null,
  },
  candidates: [{
    user_id: "3a65de39-49f1-40c7-8f1d-df80a565d46e",
    name: "Ứng viên A",
    title: null,
    company_id: "11395991-a669-475f-9af5-912afbbe554b",
    score: 35,
    score_version: "people-search-v1",
    factors: [{ code: "EXPERIENCE", label: "Kinh nghiệm", weight: 0.5, contribution: 35 }],
    evidence: [
      { type: "user", user_id: "3a65de39-49f1-40c7-8f1d-df80a565d46e", employment_id: null, job_title: "", title: null, status: null, start_date: null, end_date: null },
      { type: "employment", user_id: null, employment_id: "e1", job_title: null, title: "Engineer", status: "ACTIVE", start_date: "2022-01-01", end_date: "" },
    ],
  }],
  unsupported_reasons: [],
  explanation: null,
  explanation_source: "deterministic_fallback",
} as const;

afterEach(() => vi.unstubAllGlobals());

describe("people search API contract", () => {
  it("accepts a detailed interpretation and preserves strict skill duration", async () => {
    const payload = { ...canonicalSearchResponse, plan: { ...canonicalSearchResponse.plan, interpretation: searchInterpretation } };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(payload))));
    expect(await searchPeople({ query: "React", accessToken: "synthetic" })).toEqual(payload);
  });

  it.each(["years", "id", "unknown"])("rejects invalid interpretation %s", async (mutation) => {
    const interpretation = structuredClone(searchInterpretation);
    if (mutation === "years") interpretation.skills[0].minimum_years = 61;
    if (mutation === "id") interpretation.skills[0].canonical_skill_id = "invented";
    const payload = { ...canonicalSearchResponse, plan: { ...canonicalSearchResponse.plan, interpretation: mutation === "unknown" ? { ...interpretation, sql: "forbidden" } : interpretation } };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(payload))));
    await expect(searchPeople({ query: "React", accessToken: "synthetic" })).rejects.toBeInstanceOf(PeopleSearchApiError);
  });
  it("accepts canonical bound sources and exact factor scores", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(canonicalSearchResponse))));
    const result = await searchPeople({ query: "React", accessToken: "synthetic" });
    expect(result).toEqual(canonicalSearchResponse);
  });

  it("accepts insufficient evidence without presenting zero matches", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...canonicalSearchResponse, status: "insufficient_evidence", candidates: [] }))));
    expect((await searchPeople({ query: "React", accessToken: "synthetic" })).status).toBe("insufficient_evidence");
  });

  it.each(["score", "tenant", "factor"])("rejects inconsistent canonical %s", async (mutation) => {
    const payload = structuredClone(canonicalSearchResponse);
    const item = payload.candidates[0];
    if (item.score_version !== "people-search-canonical-v1") throw new Error("Wrong fixture");
    if (mutation === "score") item.score = 99;
    if (mutation === "tenant") item.company_id = "00000000-0000-4000-8000-000000000099";
    if (mutation === "factor") item.score_factors[0].evidence_refs = [];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(payload))));
    await expect(searchPeople({ query: "React", accessToken: "synthetic" })).rejects.toBeInstanceOf(PeopleSearchApiError);
  });
  it("sends real auth, credentials, body and AbortSignal", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(contractResponse), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    const result = await searchPeople({ query: "React", accessToken: "session-token", signal: controller.signal });

    const item = result.candidates[0];
    expect(item.score_version).toBe("people-search-v1");
    if (item.score_version !== "people-search-v1") throw new Error("Wrong response variant");
    expect(item.evidence[1].status).toBe("ACTIVE");
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/people-search/query"), expect.objectContaining({
      credentials: "include",
      signal: controller.signal,
      headers: expect.objectContaining({ Authorization: "Bearer session-token" }),
      body: JSON.stringify({ query: "React" }),
    }));
  });

  it("rejects old string evidence instead of crashing during render", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ...contractResponse,
      candidates: [{ ...contractResponse.candidates[0], evidence: "not-contract-shaped" }],
    }), { status: 200 })));

    await expect(searchPeople({ query: "React", accessToken: "token" })).rejects.toBeInstanceOf(PeopleSearchApiError);
  });

  it("compiles structured filters without dropping mandatory unsupported criteria", () => {
    expect(compileQuery({
      query: "Tìm kỹ sư",
      requiredSkills: "React",
      preferredSkills: "Python",
      minExperienceYears: "2",
      domains: "bất động sản",
      availability: "AVAILABLE",
    })).toContain("domain bắt buộc: bất động sản");
  });
});
