import {
  BadgeCheck,
  Building2,
  Gauge,
  Map,
  Settings2,
  ShieldCheck,
  UserRound,
  UsersRound,
  MessageCircle,
  FileCheck,
  BriefcaseBusiness,
  BookUser,
  type LucideIcon,
} from "lucide-react";

import type { Permission } from "@/lib/types";

export interface NavigationItem {
  label: string;
  shortLabel: string;
  href: string;
  icon: LucideIcon;
  permission: Permission;
  anyPermissions?: Permission[];
  exact?: boolean;
}

export const navigationItems: NavigationItem[] = [
  { label: "Tổng quan", shortLabel: "Tổng quan", href: "/dashboard", icon: Gauge, permission: "dashboard:read" },
  { label: "Hồ sơ năng lực", shortLabel: "Hồ sơ", href: "/ho-so", icon: UserRound, permission: "profile:self" },
  { label: "Lộ trình phát triển", shortLabel: "Lộ trình", href: "/lo-trinh", icon: Map, permission: "roadmap:self" },
  { label: "Đánh giá năng lực", shortLabel: "Đánh giá", href: "/danh-gia", icon: BadgeCheck, permission: "assessment:self", anyPermissions: ["assessment:self", "assessment:review", "company:manage", "passport:approve"] },
  { label: "Trợ lý Milo", shortLabel: "Trợ lý", href: "/tro-ly", icon: MessageCircle, permission: "dashboard:read" },
  { label: "Gửi & duyệt minh chứng", shortLabel: "Minh chứng", href: "/yeu-cau-nang-luc", icon: FileCheck, permission: "profile:self" },
  { label: "Hộ chiếu nghề nghiệp", shortLabel: "Hộ chiếu", href: "/ho-chieu", icon: BookUser, permission: "profile:self", anyPermissions: ["profile:self", "passport:approve"] },
  { label: "Yêu cầu tuyển dụng", shortLabel: "Tuyển dụng", href: "/job-requirements", icon: BriefcaseBusiness, permission: "people:write" },
  { label: "Đội ngũ", shortLabel: "Đội ngũ", href: "/nhan-su", icon: UsersRound, permission: "people:read" },
  { label: "Quản lý tài khoản", shortLabel: "Tài khoản", href: "/tai-khoan", icon: UsersRound, permission: "people:write" },
  { label: "Mẫu & chu kỳ đánh giá", shortLabel: "Mẫu đánh giá", href: "/cong-ty/tieu-chi", icon: BadgeCheck, permission: "assessment:review" },
  { label: "Quản lý công ty", shortLabel: "Công ty", href: "/cong-ty", icon: Building2, permission: "company:manage" },
  { label: "Quản trị hệ thống", shortLabel: "Hệ thống", href: "/he-thong", icon: ShieldCheck, permission: "platform:manage" },
  { label: "Cài đặt", shortLabel: "Cài đặt", href: "/cai-dat", icon: Settings2, permission: "dashboard:read" },
];

export function getAllowedNavigation(permissions: Permission[]) {
  return navigationItems.filter((item) => (item.anyPermissions ?? [item.permission]).some((permission) => permissions.includes(permission)));
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
    { label: "Bộ tiêu chí đánh giá", shortLabel: "Bộ tiêu chí", href: `/cong-ty/tieu-chi${query}`, icon: BadgeCheck, permission: "company:manage" as const },
    { label: "Chu kỳ & lượt đánh giá", shortLabel: "Đánh giá", href: `/danh-gia${query}`, icon: BadgeCheck, permission: "assessment:review" as const },
    { label: "Duyệt hộ chiếu", shortLabel: "Hộ chiếu", href: `/ho-chieu${query}`, icon: BookUser, permission: "passport:approve" as const },
  ].filter((item) => permissions.includes(item.permission));
}

export function canAccessPath(pathname: string, permissions: Permission[]) {
  const item = getNavigationItem(pathname);
  return item ? (item.anyPermissions ?? [item.permission]).some((permission) => permissions.includes(permission)) : false;
}
