import { describe, expect, it } from "vitest";

import { canAccessPath, getAllowedNavigation, getCompanyNavigation } from "@/lib/navigation";
import { demoAccounts } from "@/features/auth/demo-accounts";
import { isEmployeeRole } from "@/lib/types";

describe("permission-aware navigation", () => {
  it.each(demoAccounts)("keeps personal routes aligned with the $id role", ({ user }) => {
    for (const path of ["/ho-so", "/lo-trinh", "/danh-gia"]) {
      expect(canAccessPath(path, user.permissions)).toBe(isEmployeeRole(user.role));
    }
  });

  it("keeps company context on existing links without granting permissions", () => {
    const items = getCompanyNavigation("company-1", ["people:read"]);
    expect(items.map((item) => item.href)).toEqual(["/nhan-su?companyId=company-1"]);
    expect(getCompanyNavigation("company-1", [])).toEqual([]);
  });
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
