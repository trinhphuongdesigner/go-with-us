import { describe, expect, it } from "vitest";

import { getCurrentSession, login } from "@/lib/api";

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
});
