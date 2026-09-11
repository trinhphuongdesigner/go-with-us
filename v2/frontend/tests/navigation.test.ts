import { describe, expect, it } from "vitest";

import { canAccessPath, getAllowedNavigation } from "@/lib/navigation";

describe("permission-aware navigation", () => {
  it("keeps employee navigation focused on self-service features", () => {
    const items = getAllowedNavigation(["dashboard:read", "profile:self", "roadmap:self", "assessment:self"]);
    expect(items.map((item) => item.href)).toEqual(["/dashboard", "/ho-so", "/lo-trinh", "/danh-gia", "/cai-dat"]);
  });

  it("shows platform administration only with the platform permission", () => {
    const items = getAllowedNavigation(["dashboard:read", "platform:manage"]);
    expect(items.some((item) => item.href === "/he-thong")).toBe(true);
    expect(items.some((item) => item.href === "/nhan-su")).toBe(false);
  });

  it("denies direct URLs when the required permission is absent", () => {
    const employeePermissions = ["dashboard:read", "profile:self", "roadmap:self", "assessment:self"] as const;
    expect(canAccessPath("/lo-trinh", [...employeePermissions])).toBe(true);
    expect(canAccessPath("/he-thong", [...employeePermissions])).toBe(false);
    expect(canAccessPath("/cong-ty/thanh-vien", [...employeePermissions])).toBe(false);
  });
});
