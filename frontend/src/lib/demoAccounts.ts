/**
 * Seeded demo users from `backend/prisma/seed.ts`.
 * Login is a picker over this list — password is the shared seed secret,
 * not something the user types.
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
    name: 'Alice Nguyen',
    role: 'EMPLOYEE',
    jobTitle: 'Frontend Engineer',
    company: 'Acme Corp',
  },
  {
    email: 'admin@acme.dev',
    name: 'Acme Admin',
    role: 'COMPANY_ADMIN',
    jobTitle: 'HR Manager',
    company: 'Acme Corp',
  },
  {
    email: 'bob@acme.dev',
    name: 'Bob Tran',
    role: 'EMPLOYEE',
    jobTitle: 'Backend Engineer',
    company: 'Acme Corp',
  },
  {
    email: 'carol@acme.dev',
    name: 'Carol Le',
    role: 'EMPLOYEE',
    jobTitle: 'Product Designer',
    company: 'Acme Corp',
  },
  {
    email: 'superadmin@careermate.dev',
    name: 'Super Admin',
    role: 'SUPER_ADMIN',
    jobTitle: 'Platform',
    company: null,
  },
];

export const ROLE_LABEL: Record<DemoRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  COMPANY_ADMIN: 'Company Admin',
  EMPLOYEE: 'Employee',
};

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
