import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getPersonLive,
  listAvailableCompaniesLive,
  listPeopleLive,
} from "@/lib/api";
import type { Session } from "@/lib/types";

const superSession: Session = {
  accessToken: "live-super-token",
  user: {
    id: "super-id",
    companyId: null,
    companyName: "CareerMate",
    email: "super@example.invalid",
    name: "Super Admin",
    title: "Platform Administrator",
    initials: "SA",
    role: "SUPER_ADMIN",
    permissions: ["people:read", "platform:manage"],
  },
};

afterEach(() => vi.unstubAllGlobals());

describe("live roster API wiring", () => {
  it("encodes tenant scope, server search and pagination in the roster request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      items: [], total: 0, page: 2, pageSize: 20,
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await listPeopleLive(superSession, {
      companyId: "00000000-0000-5000-8000-000000000101",
      q: "An & Bình",
      page: 2,
      pageSize: 20,
    });

    expect(result).toMatchObject({ total: 0, page: 2, pageSize: 20 });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/people?companyId=00000000-0000-5000-8000-000000000101&q=An+%26+B%C3%ACnh&page=2&pageSize=20"),
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
  });

  it("keeps the selected tenant scope on detail and company-option requests", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [{ id: "00000000-0000-5000-8000-000000000101", name: "Acme Việt Nam" }],
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: "00000000-0000-5000-8000-000000000201",
        name: "Nguyễn Khánh Linh",
        jobTitle: null,
        isActive: true,
        profileVersion: 1,
        updatedAt: "2026-09-12T00:00:00Z",
        companyId: "00000000-0000-5000-8000-000000000101",
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listAvailableCompaniesLive(superSession)).resolves.toEqual([
      { id: "00000000-0000-5000-8000-000000000101", name: "Acme Việt Nam" },
    ]);
    await getPersonLive(
      superSession,
      "00000000-0000-5000-8000-000000000201",
      { companyId: "00000000-0000-5000-8000-000000000101", companyName: "Acme Việt Nam" },
    );

    expect(fetchMock.mock.calls[0]?.[0]).toContain("/companies/options");
    expect(fetchMock.mock.calls[1]?.[0]).toContain(
      "/people/00000000-0000-5000-8000-000000000201?companyId=00000000-0000-5000-8000-000000000101",
    );
  });
});
