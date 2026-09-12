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
  HR: [...basePermissions, "people:read", "people:write"],
  BOD: [...basePermissions, "people:read", "people:write"],
  COMPANY_ADMIN: ["dashboard:read", "people:read", "people:write", "company:read", "company:manage"],
  SUPER_ADMIN: ["dashboard:read", "people:read", "people:write", "company:read", "company:manage", "platform:manage"],
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
    label: "Quản trị công ty",
    description: "Quản lý tài khoản và cấu hình tổ chức",
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
  {
    id: "hr",
    label: "Nhân sự (HR)",
    description: "Hồ sơ cá nhân và quản lý nhân viên theo quyền được cấp",
    email: "hr@demo.careermate.vn",
    password: "CareerMateDemo!",
    accent: "sage",
    user: {
      id: "demo-hr",
      name: "Lê Hoài Anh",
      email: "hr@demo.careermate.vn",
      title: "HR Specialist",
      companyId: "00000000-0000-5000-8000-000000000101",
      companyName: "Acme Việt Nam",
      role: "HR",
      permissions: rolePermissions.HR,
      initials: "HA",
    },
  },
  {
    id: "bod",
    label: "Ban giám đốc (BOD)",
    description: "Hồ sơ cá nhân và quản lý HR, nhân viên theo quyền được cấp",
    email: "bod@demo.careermate.vn",
    password: "CareerMateDemo!",
    accent: "violet",
    user: {
      id: "demo-bod",
      name: "Đỗ Minh Châu",
      email: "bod@demo.careermate.vn",
      title: "Operations Director",
      companyId: "00000000-0000-5000-8000-000000000101",
      companyName: "Acme Việt Nam",
      role: "BOD",
      permissions: rolePermissions.BOD,
      initials: "MC",
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
