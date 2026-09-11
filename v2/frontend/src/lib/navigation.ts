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
  return navigationItems.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
}

export function canAccessPath(pathname: string, permissions: Permission[]) {
  const item = getNavigationItem(pathname);
  return item ? permissions.includes(item.permission) : false;
}
