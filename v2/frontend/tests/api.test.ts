import { afterEach, describe, expect, it, vi } from "vitest";

import { apiRequest, createProfileImport, getCurrentSession, listProfileImports, login } from "@/lib/api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("typed API adapter demo mode", () => {
  it("returns a deterministic, permission-bearing demo session", async () => {
    const session = await login("linh.nguyen@demo.careermate.vn", "CareerMateDemo!");
    expect(session.user.role).toBe("EMPLOYEE");
    expect(session.user.permissions).toContain("roadmap:self");
    expect(session.accessToken).toBe("demo-token-employee");
  });

  it("uses a recoverable error for invalid demo credentials", async () => {
    await expect(login("unknown@example.com", "wrong")).rejects.toMatchObject({ status: 401 });
  });

  it("rehydrates demo identity from the token instead of trusting stored permissions", async () => {
    const session = await getCurrentSession("demo-token-employee");
    expect(session.user.permissions).not.toContain("platform:manage");
    await expect(getCurrentSession("demo-token-forged")).rejects.toMatchObject({ status: 401 });
  });

  it("keeps demo import mutations isolated by authenticated owner", async () => {
    const employee = await login("linh.nguyen@demo.careermate.vn", "CareerMateDemo!");
    const manager = await login("hr.manager@demo.careermate.vn", "CareerMateDemo!");
    const employeeBefore = await listProfileImports(employee);
    const managerBefore = await listProfileImports(manager);

    await createProfileImport(
      employee,
      new File(["owner isolated"], `owner-${crypto.randomUUID()}.txt`, { type: "text/plain" }),
    );

    expect((await listProfileImports(employee)).total).toBe(employeeBefore.total + 1);
    expect((await listProfileImports(manager)).total).toBe(managerBefore.total);
  });

  it("lets the browser create the multipart boundary for FormData", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const body = new FormData();
    body.set("file", new File(["profile"], "profile.txt", { type: "text/plain" }));

    await apiRequest<{ ok: boolean }>("/profile-imports", { method: "POST", body }, "test-token");

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get("Content-Type")).toBeNull();
    expect(headers.get("Accept")).toBe("application/json");
    expect(headers.get("Authorization")).toBe("Bearer test-token");
  });
});
