import { describe, expect, it } from "vitest";

import {
  adaptProfileRead,
  adaptCompetencyProfile,
  adaptRosterPage,
  adaptRosterPerson,
} from "@/lib/api";

describe("profile contract adapters", () => {
  it("maps every aggregate array and keeps admin provenance", () => {
    const core = adaptProfileRead({
      id: "00000000-0000-5000-8000-000000000101",
      email: "linh@example.invalid",
      name: "Nguyễn Khánh Linh",
      jobTitle: "Designer",
      role: "EMPLOYEE",
      companyId: "00000000-0000-5000-8000-000000000201",
      companyName: "Acme Việt Nam",
      isActive: true,
      profileVersion: 3,
      createdAt: "2026-09-01T00:00:00Z",
      updatedAt: "2026-09-12T00:00:00Z",
    });
    const provenance = {
      sourceType: "ADMIN" as const,
      sourceImportId: null,
      proposalItemId: null,
      createdBy: "00000000-0000-5000-8000-000000000301",
      updatedBy: "00000000-0000-5000-8000-000000000301",
      version: 1,
      createdAt: "2026-09-12T00:00:00Z",
      updatedAt: "2026-09-12T00:00:00Z",
    };
    const result = adaptCompetencyProfile(core, {
      user: { id: core.id, name: core.name, jobTitle: core.jobTitle },
      version: 8,
      skills: [{ ...provenance, id: "00000000-0000-5000-8000-000000000401", skillId: "00000000-0000-5000-8000-000000000402", name: "Research", category: "Design", note: null, rating: 4, selfAssessed: false }],
      experiences: [{ ...provenance, id: "00000000-0000-5000-8000-000000000501", title: "Mentor", organization: "Community", employmentId: "00000000-0000-5000-8000-000000000901", description: null, startDate: "2025-01-01", endDate: null }],
      projects: [{ ...provenance, id: "00000000-0000-5000-8000-000000000601", name: "CareerMate", role: "Designer", employmentId: null, domain: "HR", description: null, techStack: ["Next.js"], contribution: "UX", url: null, startDate: "2025-02-01", endDate: null }],
      certifications: [{ ...provenance, id: "00000000-0000-5000-8000-000000000701", name: "UX", type: "PROFESSIONAL", issuer: "Institute", score: "Pass", credentialUrl: null, issuedAt: "2025-03-01", expiresAt: null }],
      awards: [{ ...provenance, id: "00000000-0000-5000-8000-000000000801", name: "Impact", type: "WORK", issuer: "Acme", description: null, evidenceUrl: null, awardedAt: "2025-04-01", selfReported: false }],
      employments: [{ id: "00000000-0000-5000-8000-000000000901", title: "Designer", startDate: "2024-01-01T00:00:00Z", endDate: null }],
      timeline: [{ id: "00000000-0000-5000-8000-000000000801", kind: "AWARD", title: "Impact", subtitle: "Acme", startDate: "2025-04-01", endDate: null, sourceType: "ADMIN" }],
    });

    expect(result.profileVersion).toBe(8);
    expect(result.skills).toEqual([expect.objectContaining({ name: "Research", category: "Design", level: 4, sourceType: "ADMIN" })]);
    expect(result.experiences[0]).toMatchObject({ employmentId: "00000000-0000-5000-8000-000000000901" });
    expect(result.projects[0]).toMatchObject({ employmentId: null, description: null, techStack: ["Next.js"], contribution: "UX", url: null });
    expect(result.certifications[0]).toMatchObject({ credentialUrl: null });
    expect(result.awards).toHaveLength(1);
    expect(result.employments).toHaveLength(1);
    expect(result.timeline[0].sourceType).toBe("ADMIN");
  });

  it("turns the generated core profile response into a safe partial view model", () => {
    const result = adaptProfileRead({
      id: "00000000-0000-5000-8000-000000000101",
      email: "linh@example.invalid",
      name: "Nguyễn Khánh Linh",
      jobTitle: null,
      role: "EMPLOYEE",
      companyId: "00000000-0000-5000-8000-000000000201",
      companyName: "Acme Việt Nam",
      isActive: true,
      profileVersion: 3,
      createdAt: "2026-09-01T00:00:00Z",
      updatedAt: "2026-09-12T00:00:00Z",
    });

    expect(result).toMatchObject({
      name: "Nguyễn Khánh Linh",
      jobTitle: "",
      initials: "KL",
      companyName: "Acme Việt Nam",
      profileVersion: 3,
      skills: [],
      experiences: [],
      projects: [],
      certifications: [],
      awards: [],
      timeline: [],
    });
    expect(result).not.toHaveProperty("email");
  });

  it("maps the generated roster projection without inventing skills or departments", () => {
    const page = adaptRosterPage({
      items: [{
        id: "00000000-0000-5000-8000-000000000102",
        name: "Lê Hoàng Nam",
        jobTitle: "Senior Engineer",
        isActive: true,
        profileVersion: 7,
        updatedAt: "2026-09-12T00:00:00Z",
      }],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    expect(page).toEqual({
      items: [{
        id: "00000000-0000-5000-8000-000000000102",
        name: "Lê Hoàng Nam",
        jobTitle: "Senior Engineer",
        department: "Chưa cập nhật",
        initials: "HN",
        skillCount: null,
        profileVersion: 7,
        updatedAt: "2026-09-12T00:00:00Z",
      }],
      total: 1,
      page: 1,
      pageSize: 20,
    });
  });

  it("maps generated roster detail to a read-only partial profile", () => {
    const result = adaptRosterPerson({
      id: "00000000-0000-5000-8000-000000000102",
      companyId: "00000000-0000-5000-8000-000000000201",
      name: "Lê Hoàng Nam",
      jobTitle: null,
      isActive: true,
      profileVersion: 7,
      updatedAt: "2026-09-12T00:00:00Z",
    }, "Acme Việt Nam");

    expect(result.jobTitle).toBe("");
    expect(result.companyName).toBe("Acme Việt Nam");
    expect(result.department).toBe("Chưa cập nhật");
    expect(result.timeline).toEqual([]);
  });
});
