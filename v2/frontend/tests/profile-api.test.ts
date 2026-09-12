import { describe, expect, it } from "vitest";

import { ProfileUpdateConflictError, updateOwnProfile } from "@/lib/api";
import { listDemoPeople } from "@/lib/profile-demo";
import type { Session } from "@/lib/types";

const session: Session = {
  accessToken: "demo-token-employee",
  user: {
    id: "demo-employee",
    companyId: "company-1",
    companyName: "Acme Việt Nam",
    email: "linh@example.invalid",
    name: "Nguyễn Khánh Linh",
    title: "Product Designer",
    initials: "KL",
    role: "EMPLOYEE",
    permissions: ["profile:self"],
  },
};

describe("profile API adapter", () => {
  it("keeps demo roster search semantics aligned with PostgreSQL ILIKE", () => {
    expect(listDemoPeople({
      ...session,
      user: { ...session.user, role: "COMPANY_ADMIN", permissions: ["people:read"] },
    }, { q: "Nguyen" }).items).toHaveLength(0);
  });

  it("converts a profile version mismatch into a typed conflict", async () => {
    const values = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        removeItem: (key: string) => values.delete(key),
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });
    await expect(updateOwnProfile(session, {
      name: "Nguyễn Khánh Linh",
      jobTitle: "Product Designer",
      profileVersion: -1,
    })).rejects.toMatchObject({
      name: "ProfileUpdateConflictError",
      status: 409,
      details: { currentProfileVersion: expect.any(Number) },
    });
    await expect(updateOwnProfile(session, {
      name: "Nguyễn Khánh Linh",
      jobTitle: "Product Designer",
      profileVersion: -1,
    })).rejects.toBeInstanceOf(ProfileUpdateConflictError);
  });
});
