import type { Permission, SessionUser, UserRole } from "@/lib/types";

export interface DemoAccount {
  id: string;
  label: string;
  description: string;
  email: string;
  password: string;
  accent: "blue" | "sage" | "violet";
  user: SessionUser;
}

const basePermissions: Permission[] = ["dashboard:read", "profile:self", "roadmap:self", "assessment:self"];

const rolePermissions: Record<UserRole, Permission[]> = {
  EMPLOYEE: basePermissions,
  COMPANY_ADMIN: [...basePermissions, "people:read", "company:manage"],
  SUPER_ADMIN: [...basePermissions, "people:read", "company:manage", "platform:manage"],
};

export const demoAccounts: DemoAccount[] = [
  {
    id: "employee",
    label: "Nhân viên",
    description: "Xem hồ sơ, mục tiêu và lộ trình phát triển",
    email: "linh.nguyen@demo.careermate.vn",
    password: "CareerMateDemo!",
    accent: "blue",
    user: {
      id: "demo-employee",
      name: "Nguyễn Khánh Linh",
      email: "linh.nguyen@demo.careermate.vn",
      title: "Product Designer",
      companyId: "00000000-0000-5000-8000-000000000101",
      companyName: "Acme Việt Nam",
      role: "EMPLOYEE",
      permissions: rolePermissions.EMPLOYEE,
      initials: "KL",
    },
  },
  {
    id: "company-admin",
    label: "Quản lý nhân sự",
    description: "Theo dõi đội ngũ, năng lực và đánh giá",
    email: "hr.manager@demo.careermate.vn",
    password: "CareerMateDemo!",
    accent: "sage",
    user: {
      id: "demo-company-admin",
      name: "Trần Minh An",
      email: "hr.manager@demo.careermate.vn",
      title: "People Operations Manager",
      companyId: "00000000-0000-5000-8000-000000000101",
      companyName: "Acme Việt Nam",
      role: "COMPANY_ADMIN",
      permissions: rolePermissions.COMPANY_ADMIN,
      initials: "MA",
    },
  },
  {
    id: "super-admin",
    label: "Quản trị hệ thống",
    description: "Quản lý doanh nghiệp và cấu hình nền tảng",
    email: "platform.admin@demo.careermate.vn",
    password: "CareerMateDemo!",
    accent: "violet",
    user: {
      id: "demo-super-admin",
      name: "Phạm Thu Hà",
      email: "platform.admin@demo.careermate.vn",
      title: "Platform Administrator",
      companyId: null,
      companyName: "CareerMate",
      role: "SUPER_ADMIN",
      permissions: rolePermissions.SUPER_ADMIN,
      initials: "TH",
    },
  },
];

export function findDemoAccount(email: string, password: string) {
  return demoAccounts.find(
    (account) => account.email.toLowerCase() === email.trim().toLowerCase() && account.password === password,
  );
}

export function findDemoAccountByToken(token: string) {
  const prefix = "demo-token-";
  if (!token.startsWith(prefix)) return undefined;
  return demoAccounts.find((account) => account.id === token.slice(prefix.length));
}
