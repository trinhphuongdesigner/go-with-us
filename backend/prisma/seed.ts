import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;
const DEMO_PASSWORD = 'Password123!';

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, SALT_ROUNDS);

  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@gowithus.dev' },
    update: {},
    create: {
      email: 'superadmin@gowithus.dev',
      passwordHash,
      name: 'Super Admin',
      role: Role.SUPER_ADMIN,
    },
  });

  const company = await prisma.company.upsert({
    where: { id: 'demo-company-seed' },
    update: {},
    create: {
      id: 'demo-company-seed',
      name: 'Acme Corp',
      industry: 'Software',
    },
  });

  const companyAdmin = await prisma.user.upsert({
    where: { email: 'admin@acme.dev' },
    update: {},
    create: {
      email: 'admin@acme.dev',
      passwordHash,
      name: 'Acme Admin',
      role: Role.COMPANY_ADMIN,
      companyId: company.id,
      jobTitle: 'HR Manager',
    },
  });

  const employees = await Promise.all(
    [
      { email: 'alice@acme.dev', name: 'Alice Nguyen', jobTitle: 'Frontend Engineer' },
      { email: 'bob@acme.dev', name: 'Bob Tran', jobTitle: 'Backend Engineer' },
      { email: 'carol@acme.dev', name: 'Carol Le', jobTitle: 'Product Designer' },
    ].map((e) =>
      prisma.user.upsert({
        where: { email: e.email },
        update: {},
        create: {
          email: e.email,
          passwordHash,
          name: e.name,
          role: Role.EMPLOYEE,
          companyId: company.id,
          jobTitle: e.jobTitle,
        },
      }),
    ),
  );

  const skillNames: Array<{ name: string; category: string }> = [
    { name: 'JavaScript', category: 'Programming' },
    { name: 'TypeScript', category: 'Programming' },
    { name: 'React', category: 'Frontend' },
    { name: 'Node.js', category: 'Backend' },
    { name: 'SQL', category: 'Data' },
    { name: 'Communication', category: 'Soft skill' },
    { name: 'Project Management', category: 'Soft skill' },
    { name: 'English (TOEIC)', category: 'Language' },
  ];

  await Promise.all(
    skillNames.map((s) =>
      prisma.skill.upsert({
        where: { name: s.name },
        update: {},
        create: s,
      }),
    ),
  );

  console.log('\nSeed complete. Demo login credentials (all use the same password):\n');
  console.log(`  Password for every seeded user: ${DEMO_PASSWORD}\n`);
  console.log(`  SUPER_ADMIN   -> ${superAdmin.email}`);
  console.log(`  COMPANY_ADMIN -> ${companyAdmin.email}  (company: ${company.name})`);
  for (const emp of employees) {
    console.log(`  EMPLOYEE      -> ${emp.email}`);
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
