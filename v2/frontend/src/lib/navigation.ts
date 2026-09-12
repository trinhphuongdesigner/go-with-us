import {
  BadgeCheck,
  Building2,
  Gauge,
  Map,
  Settings2,
  ShieldCheck,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import type { Permission } from "@/lib/types";

export interface NavigationItem {
  label: string;
  shortLabel: string;
  href: string;
  icon: LucideIcon;
  permission: Permission;
  exact?: boolean;
}

export const navigationItems: NavigationItem[] = [
  { label: "Tổng quan", shortLabel: "Tổng quan", href: "/dashboard", icon: Gauge, permission: "dashboard:read" },
  { label: "Hồ sơ năng lực", shortLabel: "Hồ sơ", href: "/ho-so", icon: UserRound, permission: "profile:self" },
  { label: "Lộ trình phát triển", shortLabel: "Lộ trình", href: "/lo-trinh", icon: Map, permission: "roadmap:self" },
  { label: "Đánh giá năng lực", shortLabel: "Đánh giá", href: "/danh-gia", icon: BadgeCheck, permission: "assessment:self" },
  { label: "Đội ngũ", shortLabel: "Đội ngũ", href: "/nhan-su", icon: UsersRound, permission: "people:read" },
  { label: "Quản lý công ty", shortLabel: "Công ty", href: "/cong-ty", icon: Building2, permission: "company:manage" },
  { label: "Quản trị hệ thống", shortLabel: "Hệ thống", href: "/he-thong", icon: ShieldCheck, permission: "platform:manage" },
  { label: "Cài đặt", shortLabel: "Cài đặt", href: "/cai-dat", icon: Settings2, permission: "dashboard:read" },
];

export function getAllowedNavigation(permissions: Permission[]) {
  return navigationItems.filter((item) => permissions.includes(item.permission));
}

export function getNavigationItem(pathname: string) {
  return [...navigationItems].sort((a, b) => b.href.length - a.href.length).find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
}

export function getCompanyNavigation(companyId: string, permissions: Permission[]): NavigationItem[] {
  const query = `?companyId=${encodeURIComponent(companyId)}`;
  return [
    { label: "Tổng quan công ty", shortLabel: "Công ty", href: `/cong-ty${query}`, icon: Building2, permission: "company:manage" as const, exact: true },
    { label: "Nhân sự", shortLabel: "Nhân sự", href: `/nhan-su${query}`, icon: UsersRound, permission: "people:read" as const },
    { label: "Bộ đánh giá · Bản xem trước", shortLabel: "Bản xem trước", href: `/cong-ty/tieu-chi/preview${query}`, icon: BadgeCheck, permission: "company:manage" as const },
  ].filter((item) => permissions.includes(item.permission));
}

export function canAccessPath(pathname: string, permissions: Permission[]) {
  const item = getNavigationItem(pathname);
  return item ? permissions.includes(item.permission) : false;
}
