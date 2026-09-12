import { AdminPermission, PrismaClient, Role } from '@prisma/client';
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
    update: {
      role: Role.COMPANY_ADMIN,
      companyId: company.id,
      adminPermissions: [AdminPermission.FULL],
    },
    create: {
      email: 'admin@acme.dev',
      passwordHash,
      name: 'Acme Admin',
      role: Role.COMPANY_ADMIN,
      adminPermissions: [AdminPermission.FULL],
      companyId: company.id,
      jobTitle: 'HR Manager',
    },
  });

  // Auto-provision RoleDefinitions for demo company
  await prisma.roleDefinition.upsert({
    where: { companyId_role: { companyId: company.id, role: Role.COMPANY_ADMIN } },
    update: { permissions: [AdminPermission.FULL], isHidden: true },
    create: {
      companyId: company.id,
      role: Role.COMPANY_ADMIN,
      permissions: [AdminPermission.FULL],
      isHidden: true,
    },
  });

  await prisma.roleDefinition.upsert({
    where: { companyId_role: { companyId: company.id, role: Role.HR } },
    update: { permissions: [AdminPermission.VIEW, AdminPermission.COLLECT, AdminPermission.CROSS_ASSESS, AdminPermission.EDIT], isHidden: false },
    create: {
      companyId: company.id,
      role: Role.HR,
      permissions: [AdminPermission.VIEW, AdminPermission.COLLECT, AdminPermission.CROSS_ASSESS, AdminPermission.EDIT],
      isHidden: false,
    },
  });

  await prisma.roleDefinition.upsert({
    where: { companyId_role: { companyId: company.id, role: Role.BOD } },
    update: { permissions: [AdminPermission.VIEW, AdminPermission.APPROVE], isHidden: false },
    create: {
      companyId: company.id,
      role: Role.BOD,
      permissions: [AdminPermission.VIEW, AdminPermission.APPROVE],
      isHidden: false,
    },
  });

  // Create HR and BOD demo users
  const hrUser = await prisma.user.upsert({
    where: { email: 'hr@acme.dev' },
    update: { role: Role.HR, companyId: company.id },
    create: {
      email: 'hr@acme.dev',
      passwordHash,
      name: 'HR Manager',
      role: Role.HR,
      companyId: company.id,
      jobTitle: 'HR Specialist',
    },
  });

  const bodUser = await prisma.user.upsert({
    where: { email: 'bod@acme.dev' },
    update: { role: Role.BOD, companyId: company.id },
    create: {
      email: 'bod@acme.dev',
      passwordHash,
      name: 'BOD Executive',
      role: Role.BOD,
      companyId: company.id,
      jobTitle: 'Board Director',
    },
  });

  const limitedAdmins = await Promise.all(
    [
      {
        email: 'viewer@acme.dev',
        name: 'Acme Viewer',
        adminPermissions: [AdminPermission.VIEW],
      },
      {
        email: 'approver@acme.dev',
        name: 'Acme Approver',
        adminPermissions: [AdminPermission.VIEW, AdminPermission.APPROVE],
      },
      {
        email: 'assessor@acme.dev',
        name: 'Acme Assessment Operator',
        adminPermissions: [
          AdminPermission.VIEW,
          AdminPermission.COLLECT,
          AdminPermission.CROSS_ASSESS,
          AdminPermission.EDIT,
        ],
      },
    ].map((admin) =>
      prisma.user.upsert({
        where: { email: admin.email },
        update: {
          role: Role.COMPANY_ADMIN,
          companyId: company.id,
          adminPermissions: admin.adminPermissions,
        },
        create: {
          ...admin,
          passwordHash,
          role: Role.COMPANY_ADMIN,
          companyId: company.id,
          jobTitle: 'HR',
        },
      }),
    ),
  );

  const employees = await Promise.all(
    [
      {
        email: 'alice@acme.dev',
        name: 'Alice Nguyen',
        jobTitle: 'Frontend Engineer',
      },
      { email: 'bob@acme.dev', name: 'Bob Tran', jobTitle: 'Backend Engineer' },
      {
        email: 'carol@acme.dev',
        name: 'Carol Le',
        jobTitle: 'Product Designer',
      },
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
              scoreDimension: 'ATTITUDE',
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

  // Global SUPER_ADMIN RoleDefinition (no company scope)
  // Use findFirst + create since unique constraint with null requires special handling
  const existingSuperDef = await prisma.roleDefinition.findFirst({
    where: { companyId: null, role: Role.SUPER_ADMIN },
  });
  if (existingSuperDef) {
    await prisma.roleDefinition.update({
      where: { id: existingSuperDef.id },
      data: { permissions: [AdminPermission.FULL], isHidden: true },
    });
  } else {
    await prisma.roleDefinition.create({
      data: {
        companyId: null,
        role: Role.SUPER_ADMIN,
        permissions: [AdminPermission.FULL],
        isHidden: true,
      },
    });
  }

  // --- Seed Employee Skills -----------------------------------------------
  const allSkills = await prisma.skill.findMany();
  const skillMap = new Map(allSkills.map((s) => [s.name, s.id]));

  const alice = employees[0];
  const bob = employees[1];
  const carol = employees[2];

  const aliceSkills = [
    { name: 'React', level: 5 },
    { name: 'TypeScript', level: 4 },
    { name: 'JavaScript', level: 5 },
    { name: 'Next.js', level: 4 },
    { name: 'Redux Toolkit', level: 4 },
    { name: 'Communication', level: 4 },
    { name: 'Project Management', level: 3 },
    { name: 'English (TOEIC)', level: 4 },
  ];

  for (const s of aliceSkills) {
    const skillId = skillMap.get(s.name);
    if (skillId) {
      await prisma.employeeSkill.upsert({
        where: { userId_skillId: { userId: alice.id, skillId } },
        update: { level: s.level },
        create: {
          userId: alice.id,
          skillId,
          level: s.level,
          selfAssessed: true,
        },
      });
    }
  }

  const bobSkills = [
    { name: 'Node.js', level: 5 },
    { name: 'NestJS', level: 4 },
    { name: 'PostgreSQL', level: 4 },
    { name: 'Redis', level: 3 },
    { name: 'TypeScript', level: 4 },
    { name: 'SQL', level: 4 },
  ];

  for (const s of bobSkills) {
    const skillId = skillMap.get(s.name);
    if (skillId) {
      await prisma.employeeSkill.upsert({
        where: { userId_skillId: { userId: bob.id, skillId } },
        update: { level: s.level },
        create: {
          userId: bob.id,
          skillId,
          level: s.level,
          selfAssessed: true,
        },
      });
    }
  }

  const carolSkills = [
    { name: 'Figma', level: 5 },
    { name: 'UI/UX Design', level: 5 },
    { name: 'Communication', level: 4 },
  ];

  for (const s of carolSkills) {
    const skillId = skillMap.get(s.name);
    if (skillId) {
      await prisma.employeeSkill.upsert({
        where: { userId_skillId: { userId: carol.id, skillId } },
        update: { level: s.level },
        create: {
          userId: carol.id,
          skillId,
          level: s.level,
          selfAssessed: true,
        },
      });
    }
  }

  // --- Seed Project Experiences -------------------------------------------
  await prisma.projectExperience.deleteMany({
    where: { userId: { in: [alice.id, bob.id, carol.id] } },
  });

  await prisma.projectExperience.createMany({
    data: [
      {
        userId: alice.id,
        companyId: company.id,
        employmentId: 'demo-employment-0',
        name: 'Cổng thông tin Bất động sản Vinhomes (Vinhomes Real Estate Portal)',
        role: 'Frontend Lead',
        domain: 'Bất động sản',
        techStack: ['React', 'TypeScript', 'Next.js', 'Redux Toolkit', 'Tailwind CSS'],
        contribution:
          'Xây dựng hệ thống bản đồ quy hoạch và lọc dự án bất động sản realtime, phục vụ 50.000 lượt truy cập/ngày.',
        startDate: new Date('2022-03-01'),
        endDate: new Date('2024-06-30'),
      },
      {
        userId: alice.id,
        companyId: company.id,
        employmentId: 'demo-employment-0',
        name: 'Hệ thống Quản lý Bất động sản Cho thuê (PropTech SaaS)',
        role: 'Senior Frontend Developer',
        domain: 'Bất động sản',
        techStack: ['React', 'TypeScript', 'Ant Design', 'GraphQL'],
        contribution:
          'Tối ưu hóa tốc độ tải trang từ 4.2s xuống 1.1s; thiết kế luồng ký hợp đồng thuê trực tuyến.',
        startDate: new Date('2024-07-01'),
        endDate: null,
      },
      {
        userId: bob.id,
        companyId: company.id,
        employmentId: 'demo-employment-1',
        name: 'Cổng thanh toán FinTech (FinTech Payment Gateway)',
        role: 'Backend Lead',
        domain: 'Tài chính - Ngân hàng (FinTech)',
        techStack: ['Node.js', 'NestJS', 'PostgreSQL', 'Redis', 'Kafka'],
        contribution:
          'Xử lý 1.000 giao dịch/giây, đảm bảo chuẩn bảo mật thanh toán quốc tế PCI-DSS.',
        startDate: new Date('2023-01-15'),
        endDate: null,
      },
      {
        userId: carol.id,
        companyId: company.id,
        employmentId: 'demo-employment-2',
        name: 'Acme Design System 2.0 & Token Architecture',
        role: 'Lead Product Designer',
        domain: 'Enterprise Software',
        techStack: ['Figma', 'Design System', 'Tokens', 'Prototyping'],
        contribution:
          'Chuẩn hóa hơn 100 components, rút ngắn 35% thời gian thiết kế UI cho toàn bộ team sản phẩm.',
        startDate: new Date('2024-02-01'),
        endDate: null,
      },
    ],
  });

  // --- Seed Certifications & Awards for Alice ------------------------------
  await prisma.certification.deleteMany({ where: { userId: alice.id } });
  await prisma.certification.createMany({
    data: [
      {
        userId: alice.id,
        name: 'AWS Certified Cloud Practitioner',
        type: 'PROFESSIONAL',
        issuer: 'Amazon Web Services',
        score: '880/1000',
        issuedAt: new Date('2023-05-15'),
      },
      {
        userId: alice.id,
        name: 'TOEIC 850',
        type: 'LANGUAGE',
        issuer: 'ETS',
        score: '850/990',
        issuedAt: new Date('2023-01-10'),
      },
    ],
  });

  await prisma.award.deleteMany({ where: { userId: alice.id } });
  await prisma.award.createMany({
    data: [
      {
        userId: alice.id,
        title: 'Nhân viên xuất sắc Quý 2/2024',
        category: 'WORK',
        issuer: 'Acme Corp',
        description:
          'Đóng góp nổi bật trong việc bàn giao module bản đồ quy hoạch BĐS đúng tiến độ.',
        awardedAt: new Date('2024-06-30'),
        selfReported: false,
      },
      {
        userId: alice.id,
        title: 'Giải Nhất Hackathon Nội bộ 2023 - Đề án PropTech AI',
        category: 'WORK',
        issuer: 'Acme Corp',
        description: 'Xây dựng trợ lý ảo định giá bất động sản theo thời gian thực.',
        awardedAt: new Date('2023-11-20'),
        selfReported: false,
      },
    ],
  });

  // --- Seed Previous Approved Assessment for Alice ------------------------
  const pastPeriod = '2024-08';
  const pastCycle = await prisma.assessmentCycle.upsert({
    where: { companyId_period: { companyId: company.id, period: pastPeriod } },
    update: {},
    create: {
      companyId: company.id,
      templateId: template.id,
      name: `Check-in ${pastPeriod}`,
      period: pastPeriod,
      status: 'CLOSED',
    },
  });

  const fullTemplate = await prisma.assessmentTemplate.findUniqueOrThrow({
    where: { id: template.id },
    include: {
      groups: {
        include: { questions: true },
      },
    },
  });

  const existingAssessment = await prisma.assessment.findFirst({
    where: {
      cycleId: pastCycle.id,
      revieweeId: alice.id,
      type: 'MANAGER',
    },
  });

  if (!existingAssessment) {
    const questions = fullTemplate.groups.flatMap((g) => g.questions);
    const answersData = questions.map((q, idx) => ({
      questionId: q.id,
      score: idx % 2 === 0 ? 9 : 8,
      comment: 'Thể hiện rất tốt yêu cầu chuyên môn và phối hợp nhóm.',
    }));

    await prisma.assessment.create({
      data: {
        cycleId: pastCycle.id,
        templateId: template.id,
        revieweeId: alice.id,
        reviewerId: companyAdmin.id,
        employmentId: 'demo-employment-0',
        type: 'MANAGER',
        status: 'APPROVED',
        mood: 'GREAT',
        highlights:
          'Chủ động đề xuất kiến trúc frontend cho hệ thống BĐS, dẫn dắt team vượt tiến độ sprint.',
        comment: 'Đánh giá xuất sắc, sẵn sàng cho vai trò Tech Lead.',
        totalScore: 8.8,
        contributionScore: 8.7,
        attitudeScore: 9.3,
        templateSnapshot: JSON.parse(JSON.stringify(fullTemplate)),
        submittedAt: new Date('2024-08-28'),
        approvedAt: new Date('2024-08-29'),
        approvedById: companyAdmin.id,
        answers: {
          create: answersData,
        },
      },
    });
  }

  // Update Alice user scores reflecting the approved assessment
  await prisma.user.update({
    where: { id: alice.id },
    data: {
      contributionScore: 8.7,
      attitudeScore: 9.3,
    },
  });

  console.log(
    '\nSeed complete. Demo login credentials (all use the same password):\n',
  );
  console.log(`  Password for every seeded user: ${DEMO_PASSWORD}\n`);
  console.log(`  SUPER_ADMIN   -> ${superAdmin.email}`);
  console.log(
    `  COMPANY_ADMIN -> ${companyAdmin.email}  (company: ${company.name})`,
  );
  for (const admin of limitedAdmins) {
    console.log(
      `  COMPANY_ADMIN -> ${admin.email} (${admin.adminPermissions.join(' + ')})`,
    );
  }
  console.log(`  HR            -> ${hrUser.email}`);
  console.log(`  BOD           -> ${bodUser.email}`);
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
