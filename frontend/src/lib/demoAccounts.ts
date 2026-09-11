/**
 * Seeded demo users from `backend/prisma/seed.ts`.
 * The login picker fills these credentials; manual sign-in stays available.
 */
export const DEMO_PASSWORD = 'Password123!';

export type DemoRole = 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'EMPLOYEE';

export interface DemoAccount {
  email: string;
  name: string;
  role: DemoRole;
  jobTitle: string;
  company: string | null;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: 'alice@acme.dev',
    // Requested demo label; the authenticated profile still uses the API name.
    name: 'Alice Tran',
    role: 'EMPLOYEE',
    jobTitle: 'Kỹ sư Frontend',
    company: 'Acme Corp',
  },
  {
    email: 'admin@acme.dev',
    name: 'Admin Acme',
    role: 'COMPANY_ADMIN',
    jobTitle: 'Quản lý nhân sự',
    company: 'Acme Corp',
  },
  {
    email: 'bob@acme.dev',
    name: 'Bob Tran',
    role: 'EMPLOYEE',
    jobTitle: 'Kỹ sư Backend',
    company: 'Acme Corp',
  },
  {
    email: 'carol@acme.dev',
    name: 'Carol Le',
    role: 'EMPLOYEE',
    jobTitle: 'Nhà thiết kế sản phẩm',
    company: 'Acme Corp',
  },
  {
    email: 'superadmin@careermate.dev',
    name: 'SuperAdmin',
    role: 'SUPER_ADMIN',
    jobTitle: 'Nền tảng',
    company: null,
  },
];

export const ROLE_LABEL: Record<DemoRole, string> = {
  SUPER_ADMIN: 'Quản trị nền tảng',
  COMPANY_ADMIN: 'Quản trị công ty',
  EMPLOYEE: 'Nhân sự',
};

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
