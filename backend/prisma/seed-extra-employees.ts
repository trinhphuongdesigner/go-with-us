/**
 * One-off script to bulk-add 30 extra EMPLOYEE users to the demo company
 * (`demo-company-seed` / Acme Corp) without touching anything the main
 * `seed.ts` already created — every user is upserted by email, so running
 * this again is a no-op rather than a duplicate insert.
 *
 * Run with: npx ts-node prisma/seed-extra-employees.ts
 * (or: npx prisma db seed -- ... if wired up separately)
 */
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;
const DEMO_PASSWORD = 'Password123!';
const COMPANY_ID = 'demo-company-seed';
const EMPLOYEE_COUNT = 30;

const FIRST_NAMES = [
  'Anh', 'Binh', 'Chi', 'Dung', 'Giang', 'Ha', 'Hoa', 'Huy', 'Khanh', 'Lan',
  'Linh', 'Long', 'Mai', 'Minh', 'Nam', 'Ngoc', 'Nhung', 'Phong', 'Phuong', 'Quang',
  'Quyen', 'Son', 'Tam', 'Thao', 'Thuy', 'Trang', 'Tuan', 'Tuyet', 'Van', 'Vy',
];
const LAST_NAMES = [
  'Nguyen', 'Tran', 'Le', 'Pham', 'Hoang', 'Huynh', 'Phan', 'Vu', 'Vo', 'Dang',
  'Bui', 'Do', 'Ho', 'Ngo', 'Duong', 'Ly',
];
const JOB_TITLES = [
  'Frontend Engineer', 'Backend Engineer', 'Fullstack Engineer', 'QA Engineer',
  'DevOps Engineer', 'Product Designer', 'Product Manager', 'Business Analyst',
  'Data Analyst', 'Mobile Engineer', 'UI/UX Designer', 'Technical Lead',
];
const DEPARTMENTS = ['Product', 'Platform', 'Design', 'Data', 'Mobile', 'QA'];
const LEVELS = ['Junior', 'Middle', 'Senior'];

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, SALT_ROUNDS);

  const company = await prisma.company.findUnique({ where: { id: COMPANY_ID } });
  if (!company) {
    throw new Error(
      `Company ${COMPANY_ID} not found — run "npx prisma db seed" first to create Acme Corp.`,
    );
  }

  const created: { email: string; name: string; jobTitle: string }[] = [];

  for (let i = 1; i <= EMPLOYEE_COUNT; i++) {
    const firstName = pick(FIRST_NAMES, i - 1);
    const lastName = pick(LAST_NAMES, i * 3 - 1);
    const name = `${lastName} ${firstName}`;
    const email = `employee${String(i).padStart(2, '0')}@acme.dev`;
    const jobTitle = pick(JOB_TITLES, i - 1);
    const department = pick(DEPARTMENTS, i - 1);
    const level = pick(LEVELS, i);

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        role: Role.EMPLOYEE,
        companyId: company.id,
      },
      create: {
        email,
        passwordHash,
        name,
        role: Role.EMPLOYEE,
        companyId: company.id,
        jobTitle,
        onboardDate: new Date(`202${3 + (i % 3)}-0${(i % 9) + 1}-01`),
      },
    });

    await prisma.employment.upsert({
      where: { id: `demo-extra-employment-${i}` },
      update: {},
      create: {
        id: `demo-extra-employment-${i}`,
        userId: user.id,
        companyId: company.id,
        jobTitle,
        level,
        department,
        startDate: new Date(`202${3 + (i % 3)}-0${(i % 9) + 1}-01`),
      },
    });

    created.push({ email, name, jobTitle });
  }

  console.log(`\nSeeded ${created.length} extra employees into ${company.name}:\n`);
  console.log(`  Password for every seeded user: ${DEMO_PASSWORD}\n`);
  for (const c of created) {
    console.log(`  EMPLOYEE -> ${c.email}  (${c.name} — ${c.jobTitle})`);
  }
  console.log('');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
