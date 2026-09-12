import { describe, expect, it } from "vitest";

import {
  adaptProfileRead,
  adaptRosterPage,
  adaptRosterPerson,
} from "@/lib/api";

describe("profile contract adapters", () => {
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
