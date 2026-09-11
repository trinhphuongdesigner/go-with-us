import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;
const DEMO_PASSWORD = 'Password123!';
const SUPER_ADMIN_EMAIL = 'superadmin@careermate.dev';
const LEGACY_SUPER_ADMIN_EMAIL = 'superadmin@gowithus.dev';

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, SALT_ROUNDS);

  const legacySuperAdmin = await prisma.user.findUnique({
    where: { email: LEGACY_SUPER_ADMIN_EMAIL },
  });
  if (legacySuperAdmin) {
    await prisma.user.update({
      where: { email: LEGACY_SUPER_ADMIN_EMAIL },
      data: { email: SUPER_ADMIN_EMAIL },
    });
  }

  const superAdmin = await prisma.user.upsert({
    where: { email: SUPER_ADMIN_EMAIL },
    update: {},
    create: {
      email: SUPER_ADMIN_EMAIL,
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

  // No-company account — a career record that outlived its employment
  // (docs/careermate-scope.md), so company-scoped UI (nav gating,
  // Cross Assessment, etc.) has something real to test against.
  const unaffiliatedEmployee = await prisma.user.upsert({
    where: { email: 'dana@careermate.dev' },
    update: {},
    create: {
      email: 'dana@careermate.dev',
      passwordHash,
      name: 'Dana Pham',
      role: Role.EMPLOYEE,
      companyId: null,
      jobTitle: 'Freelance Engineer',
    },
  });

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

  // --- CareerMate demo data (docs/careermate-scope.md) ---------------------

  // Employment periods — the backbone the career record hangs off, so the
  // assessment history keeps its context after someone leaves.
  await Promise.all(
    employees.map((employee, index) =>
      prisma.employment.upsert({
        where: { id: `demo-employment-${index}` },
        update: {},
        create: {
          id: `demo-employment-${index}`,
          userId: employee.id,
          companyId: company.id,
          jobTitle: employee.jobTitle ?? 'Engineer',
          level: ['Middle', 'Senior', 'Middle'][index],
          department: ['Product', 'Platform', 'Design'][index],
          startDate: new Date(`${2022 + index}-03-01`),
        },
      }),
    ),
  );

  // A company-defined competency scale: groups carry weights, questions carry
  // their own weight and are scored 1-10.
  const existingTemplate = await prisma.assessmentTemplate.findFirst({
    where: { companyId: company.id },
  });

  const template =
    existingTemplate ??
    (await prisma.assessmentTemplate.create({
      data: {
        companyId: company.id,
        createdById: companyAdmin.id,
        name: 'Acme monthly competency scale',
        description:
          'Default cross-assessment scale — adjust the groups and weights to match each period goal.',
        status: 'ACTIVE',
        groups: {
          create: [
            {
              name: 'Professional competency',
              description: 'Technical depth and delivery quality.',
              weight: 3,
              order: 0,
              questions: {
                create: [
                  {
                    text: 'Delivers work at the quality expected for their level',
                    guidance:
                      '1-3 needs close review, 4-6 meets expectations with guidance, 7-10 consistently ships without rework.',
                    weight: 2,
                    maxScore: 10,
                    order: 0,
                  },
                  {
                    text: 'Solves problems independently',
                    guidance:
                      'How far can they take an ambiguous task before needing help?',
                    weight: 1,
                    maxScore: 10,
                    order: 1,
                  },
                ],
              },
            },
            {
              name: 'Attitude & collaboration',
              description: 'How they work with the people around them.',
              weight: 2,
              order: 1,
              questions: {
                create: [
                  {
                    text: 'Communicates proactively with the team',
                    guidance:
                      'Raises blockers early, keeps others informed without being asked.',
                    weight: 1,
                    maxScore: 10,
                    order: 0,
                  },
                  {
                    text: 'Supports colleagues and shares knowledge',
                    guidance: 'Reviews, mentoring, internal sharing sessions.',
                    weight: 1,
                    maxScore: 10,
                    order: 1,
                  },
                ],
              },
            },
            {
              name: 'Growth',
              description: 'Progress against their own development plan.',
              weight: 1,
              order: 2,
              questions: {
                create: [
                  {
                    text: 'Made visible progress on their development goals',
                    guidance:
                      'Measured against the goals they set, not against other people.',
                    weight: 1,
                    maxScore: 10,
                    order: 0,
                  },
                ],
              },
            },
          ],
        },
      },
    }));

  // One open cycle for the current month, so employees can check in
  // immediately after seeding.
  const period = new Date().toISOString().slice(0, 7);
  await prisma.assessmentCycle.upsert({
    where: { companyId_period: { companyId: company.id, period } },
    update: {},
    create: {
      companyId: company.id,
      templateId: template.id,
      name: `Check-in ${period}`,
      period,
      status: 'OPEN',
    },
  });

  console.log('\nSeed complete. Demo login credentials (all use the same password):\n');
  console.log(`  Password for every seeded user: ${DEMO_PASSWORD}\n`);
  console.log(`  SUPER_ADMIN   -> ${superAdmin.email}`);
  console.log(`  COMPANY_ADMIN -> ${companyAdmin.email}  (company: ${company.name})`);
  for (const emp of employees) {
    console.log(`  EMPLOYEE      -> ${emp.email}`);
  }
  console.log(`  EMPLOYEE      -> ${unaffiliatedEmployee.email}  (no company)`);
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
