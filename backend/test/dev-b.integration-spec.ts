import { randomUUID } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import {
  AdminPermission,
  AssessmentScoreDimension,
  AssessmentStatus,
  CareerSummarySource,
  CareerSummaryStatus,
  Role,
} from '@prisma/client';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AiChatService } from '../src/modules/ai-chat/ai-chat.service';

function objectBody(response: { body: unknown }) {
  return response.body as {
    id: string;
    version: number;
    status: string;
    adminPermissions: string[];
    user: unknown;
    templateSnapshot: { groups: { questions: unknown[] }[] };
  };
}

// This suite only runs against an explicitly supplied disposable local DB.
const testDatabaseUrl = process.env.DEV_B_TEST_DATABASE_URL;
if (!testDatabaseUrl) throw new Error('DEV_B_TEST_DATABASE_URL is required');
const parsedUrl = new URL(testDatabaseUrl);
if (
  !['localhost', '127.0.0.1'].includes(parsedUrl.hostname) ||
  parsedUrl.pathname !== '/dev_b_test'
) {
  throw new Error(
    'Dev B integration tests require a local dev_b_test database',
  );
}
process.env.DATABASE_URL = testDatabaseUrl;
process.env.JWT_SECRET = 'dev-b-isolated-integration-test';
process.env.ENCRYPTION_KEY = '0'.repeat(64);

describe('Dev B permissions, approval and offboarding (PostgreSQL + HTTP)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwt: JwtService;
  let companyId: string;
  let otherCompanyId: string;
  let actors: Record<string, { id: string; token: string }>;
  let template: Awaited<ReturnType<typeof makeTemplate>>;
  let cycleId: string;
  let employmentId: string;
  const ai = { send: jest.fn() };

  async function makeTemplate() {
    return prisma.assessmentTemplate.create({
      data: {
        companyId,
        createdById: actors.full.id,
        name: 'Weighted scale',
        status: 'ACTIVE',
        groups: {
          create: [
            {
              name: 'Delivery',
              weight: 3,
              order: 0,
              scoreDimension: 'CONTRIBUTION',
              questions: {
                create: [
                  {
                    text: 'Delivery quality',
                    weight: 2,
                    maxScore: 20,
                    order: 0,
                  },
                  {
                    text: 'Problem solving',
                    weight: 1,
                    maxScore: 10,
                    order: 1,
                  },
                ],
              },
            },
            {
              name: 'Collaboration',
              weight: 1,
              order: 1,
              scoreDimension: 'ATTITUDE',
              questions: {
                create: [
                  { text: 'Teamwork', weight: 1, maxScore: 10, order: 0 },
                ],
              },
            },
          ],
        },
      },
      include: {
        groups: {
          orderBy: { order: 'asc' },
          include: { questions: { orderBy: { order: 'asc' } } },
        },
      },
    });
  }

  const api = (actor: string) => ({
    get: (path: string) =>
      request(app.getHttpServer())
        .get(`/api${path}`)
        .auth(actors[actor].token, { type: 'bearer' }),
    post: (path: string) =>
      request(app.getHttpServer())
        .post(`/api${path}`)
        .auth(actors[actor].token, { type: 'bearer' }),
    patch: (path: string) =>
      request(app.getHttpServer())
        .patch(`/api${path}`)
        .auth(actors[actor].token, { type: 'bearer' }),
  });

  function answerData(scores = [10, 10, 8]) {
    return template.groups
      .flatMap((g) => g.questions)
      .map((q, i) => ({ questionId: q.id, score: scores[i] }));
  }

  async function assessment(
    status: AssessmentStatus = AssessmentStatus.SUBMITTED,
    scores?: number[],
  ) {
    return prisma.assessment.create({
      data: {
        templateId: template.id,
        cycleId,
        employmentId,
        revieweeId: actors.employee.id,
        reviewerId: actors.peer.id,
        type: 'PEER',
        status,
        totalScore: 0,
        answers: { create: answerData(scores) },
      },
    });
  }

  async function offboarding(generated = false) {
    return prisma.careerSummary.create({
      data: {
        userId: actors.employee.id,
        employmentId,
        source: CareerSummarySource.ORGANIZATION_OFFBOARDING,
        status: CareerSummaryStatus.DRAFT,
        content: generated ? 'Worked on a retail platform.' : '',
        evaluation: generated ? 'Consistent and collaborative.' : null,
        dimensionScores: generated ? { skill: 8 } : undefined,
        generatedAt: generated ? new Date() : null,
        requestedById: actors.employee.id,
        requestedAt: new Date(),
      },
    });
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AiChatService)
      .useValue(ai)
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
  });

  beforeEach(async () => {
    ai.send.mockReset().mockResolvedValue({
      content: JSON.stringify({
        narrative: 'Worked on a retail platform.',
        evaluation: 'Consistent and collaborative.',
        dimensionScores: {
          attendance: 8,
          proactiveness: 7,
          knowledge: 8,
          skill: 8,
          activityParticipation: 7,
        },
        strengths: ['Teamwork'],
        growthAreas: ['Mentoring'],
      }),
    });
    companyId = (
      await prisma.company.create({ data: { name: `Dev B ${randomUUID()}` } })
    ).id;
    otherCompanyId = (
      await prisma.company.create({ data: { name: `Other ${randomUUID()}` } })
    ).id;
    const definitions: [string, Role, AdminPermission[], string | null][] = [
      ['full', Role.COMPANY_ADMIN, [AdminPermission.FULL], companyId],
      ['view', Role.COMPANY_ADMIN, [AdminPermission.VIEW], companyId],
      ['approve', Role.COMPANY_ADMIN, [AdminPermission.APPROVE], companyId],
      ['edit', Role.COMPANY_ADMIN, [AdminPermission.EDIT], companyId],
      ['collect', Role.COMPANY_ADMIN, [AdminPermission.COLLECT], companyId],
      ['cross', Role.COMPANY_ADMIN, [AdminPermission.CROSS_ASSESS], companyId],
      ['employee', Role.EMPLOYEE, [AdminPermission.FULL], companyId],
      ['peer', Role.EMPLOYEE, [], companyId],
      ['other', Role.COMPANY_ADMIN, [AdminPermission.FULL], otherCompanyId],
      ['super', Role.SUPER_ADMIN, [], null],
    ];
    actors = Object.fromEntries(
      await Promise.all(
        definitions.map(async ([name, role, adminPermissions, scope]) => {
          const user = await prisma.user.create({
            data: {
              email: `${name}-${randomUUID()}@dev-b.test`,
              name,
              passwordHash: 'unused-test-hash',
              role,
              companyId: scope,
              adminPermissions,
            },
          });
          return [
            name,
            { id: user.id, token: jwt.sign({ sub: user.id }) },
          ] as const;
        }),
      ),
    );
    template = await makeTemplate();
    cycleId = (
      await prisma.assessmentCycle.create({
        data: {
          companyId,
          templateId: template.id,
          name: 'September',
          period: '2026-09',
        },
      })
    ).id;
    employmentId = (
      await prisma.employment.create({
        data: {
          userId: actors.employee.id,
          companyId,
          jobTitle: 'Engineer',
          startDate: new Date('2025-01-01'),
        },
      })
    ).id;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('returns current DB permissions from /auth/me and applies revocation to an existing token', async () => {
    const me = await api('full').get('/auth/me').expect(200);
    expect(objectBody(me).adminPermissions).toEqual(['FULL']);
    await prisma.user.update({
      where: { id: actors.full.id },
      data: { adminPermissions: ['VIEW'] },
    });
    const row = await assessment();
    await api('full').post(`/assessments/${row.id}/approve`).expect(403);
  });

  it.each(['view', 'employee', 'collect', 'cross'])(
    '%s cannot approve or reject assessments',
    async (actor) => {
      const row = await assessment();
      await api(actor).post(`/assessments/${row.id}/approve`).expect(403);
      await api(actor)
        .post(`/assessments/${row.id}/reject`)
        .send({ comment: 'No' })
        .expect(403);
      expect(
        (await prisma.assessment.findUniqueOrThrow({ where: { id: row.id } }))
          .status,
      ).toBe('SUBMITTED');
    },
  );

  it('VIEW grants profile/passport/insight reads without granting COLLECT', async () => {
    await api('view')
      .get(`/competency-profile?userId=${actors.employee.id}`)
      .expect(200);
    await api('view')
      .get(`/career-passport?userId=${actors.employee.id}`)
      .expect(200);
    await api('view')
      .get(`/skills-competency/insight/${actors.employee.id}`)
      .expect(200);
    await api('view')
      .patch(`/users/${actors.employee.id}`)
      .send({ jobTitle: 'Changed' })
      .expect(403);
    await api('collect')
      .patch(`/users/${actors.employee.id}`)
      .send({ jobTitle: 'Recorded' })
      .expect(200);
  });

  it('company admins without VIEW cannot obtain employee data through roster, profile, passport or insight', async () => {
    await api('cross').get('/users').expect(403);
    await api('cross')
      .get(`/competency-profile?userId=${actors.employee.id}`)
      .expect(403);
    await api('cross')
      .get(`/career-passport?userId=${actors.employee.id}`)
      .expect(403);
    await api('cross')
      .get(`/skills-competency/insight/${actors.employee.id}`)
      .expect(403);
    await api('employee').get('/competency-profile').expect(200);
  });

  it('requires CROSS_ASSESS for template/cycle management', async () => {
    await api('view')
      .patch(`/assessments/cycles/${cycleId}`)
      .send({ name: 'Denied' })
      .expect(403);
    await api('cross')
      .patch(`/assessments/cycles/${cycleId}`)
      .send({ name: 'Allowed' })
      .expect(200);
    await api('view')
      .post('/assessments/templates')
      .send({
        name: 'Denied',
        groups: [{ name: 'One', questions: [{ text: 'One' }] }],
      })
      .expect(403);
  });

  it('recomputes weighted normalized scores, snapshots and updates the profile on approval', async () => {
    const row = await assessment();
    const approved = await api('approve')
      .post(`/assessments/${row.id}/approve`)
      .expect(201);
    expect(approved.body).toMatchObject({
      status: 'APPROVED',
      totalScore: 7,
      contributionScore: 6.67,
      attitudeScore: 8,
    });
    expect(
      objectBody(approved).templateSnapshot.groups[0].questions[0],
    ).toMatchObject({ maxScore: 20, weight: 2 });
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: actors.employee.id },
    });
    expect(user).toMatchObject({ contributionScore: 6.67, attitudeScore: 8 });
    const profile = await api('employee')
      .get('/competency-profile')
      .expect(200);
    expect(objectBody(profile).user).toMatchObject({
      contributionScore: 6.67,
      attitudeScore: 8,
    });
  });

  it('averages only approved assessments and handles simultaneous approvals without lost scores', async () => {
    const first = await assessment();
    const second = await assessment(AssessmentStatus.SUBMITTED, [20, 10, 4]);
    await assessment(AssessmentStatus.DRAFT, [1, 1, 1]);
    const responses = await Promise.all([
      api('approve').post(`/assessments/${first.id}/approve`),
      api('approve').post(`/assessments/${second.id}/approve`),
    ]);
    expect(responses.map((r) => r.status)).toEqual([201, 201]);
    expect(
      await prisma.user.findUniqueOrThrow({
        where: { id: actors.employee.id },
      }),
    ).toMatchObject({ contributionScore: 8.34, attitudeScore: 6 });
    await api('approve').post(`/assessments/${first.id}/approve`).expect(400);
  });

  it('keeps approval and profile update atomic if the stored answers are invalid', async () => {
    const row = await assessment(AssessmentStatus.SUBMITTED, [21, 10, 8]);
    await api('approve').post(`/assessments/${row.id}/approve`).expect(400);
    expect(
      await prisma.assessment.findUniqueOrThrow({ where: { id: row.id } }),
    ).toMatchObject({ status: 'SUBMITTED', templateSnapshot: null });
    expect(
      await prisma.user.findUniqueOrThrow({
        where: { id: actors.employee.id },
      }),
    ).toMatchObject({ contributionScore: null, attitudeScore: null });
  });

  it('preserves approved questions, answers and snapshot when a used template is edited', async () => {
    const row = await assessment();
    const approved = await api('approve')
      .post(`/assessments/${row.id}/approve`)
      .expect(201);
    const changed = await api('cross')
      .patch(`/assessments/templates/${template.id}`)
      .send({
        name: 'Next version',
        groups: [
          {
            name: 'New group',
            scoreDimension: AssessmentScoreDimension.ATTITUDE,
            questions: [{ text: 'New question' }],
          },
        ],
      })
      .expect(200);
    expect(objectBody(changed).id).not.toBe(template.id);
    expect(objectBody(changed).version).toBe(2);
    const stored = await prisma.assessment.findUniqueOrThrow({
      where: { id: row.id },
      include: { answers: true },
    });
    expect(stored.answers).toHaveLength(3);
    expect(stored.templateSnapshot).toEqual(
      objectBody(approved).templateSnapshot,
    );
    expect(
      (
        await prisma.assessmentCycle.findUniqueOrThrow({
          where: { id: cycleId },
        })
      ).templateId,
    ).toBe(template.id);
  });

  it('requires EDIT for submitted answers and never allows approved records to be edited', async () => {
    const row = await assessment();
    await api('view')
      .patch(`/assessments/${row.id}`)
      .send({ answers: answerData([20, 10, 4]) })
      .expect(403);
    await api('peer')
      .patch(`/assessments/${row.id}`)
      .send({ comment: 'No longer editable' })
      .expect(403);
    const updated = await api('edit')
      .patch(`/assessments/${row.id}`)
      .send({ answers: answerData([20, 10, 4]) })
      .expect(200);
    expect(updated.body).toMatchObject({
      status: 'SUBMITTED',
      totalScore: 8.5,
    });
    await api('approve').post(`/assessments/${row.id}/approve`).expect(201);
    await api('full')
      .patch(`/assessments/${row.id}`)
      .send({ comment: 'Must remain frozen' })
      .expect(400);
  });

  it('rejects foreign questions and preserves prior answers on failed submit', async () => {
    const row = await assessment(AssessmentStatus.DRAFT);
    const otherTemplate = await makeTemplate();
    await api('peer')
      .post(`/assessments/${row.id}/submit`)
      .send({
        answers: [
          { questionId: otherTemplate.groups[0].questions[0].id, score: 10 },
        ],
      })
      .expect(400);
    expect(
      await prisma.assessmentAnswer.count({ where: { assessmentId: row.id } }),
    ).toBe(3);
  });

  it('keeps company boundaries even for FULL and permits SUPER_ADMIN without explicit grants', async () => {
    const row = await assessment();
    await api('other').post(`/assessments/${row.id}/approve`).expect(403);
    await api('other')
      .get(`/competency-profile?userId=${actors.employee.id}`)
      .expect(403);
    await api('super').post(`/assessments/${row.id}/approve`).expect(201);
  });

  it('uses employment company for approval after the employee has left', async () => {
    const row = await assessment();
    await prisma.user.update({
      where: { id: actors.employee.id },
      data: { companyId: null },
    });
    await api('approve').post(`/assessments/${row.id}/approve`).expect(201);
  });

  it('employees request offboarding without invoking AI and cannot trigger or approve', async () => {
    const requested = await api('employee')
      .post('/career-passport/summaries/request')
      .send({ employmentId })
      .expect(201);
    expect(requested.body).toMatchObject({
      source: 'ORGANIZATION_OFFBOARDING',
      status: 'DRAFT',
      generatedAt: null,
    });
    expect(ai.send).not.toHaveBeenCalled();
    await api('employee')
      .post(`/career-passport/summaries/${objectBody(requested).id}/trigger`)
      .expect(403);
    await api('employee')
      .post(`/career-passport/summaries/${objectBody(requested).id}/approve`)
      .expect(403);
  });

  it('offboarding requires APPROVE for trigger/approval and EDIT for narrative changes', async () => {
    const row = await offboarding(true);
    await api('view').get('/career-passport/summaries/pending').expect(403);
    await api('view')
      .post(`/career-passport/summaries/${row.id}/trigger`)
      .expect(403);
    await api('view')
      .post(`/career-passport/summaries/${row.id}/approve`)
      .expect(403);
    await api('approve')
      .patch(`/career-passport/summaries/${row.id}`)
      .send({ content: 'A retail project.' })
      .expect(403);
    await api('edit')
      .patch(`/career-passport/summaries/${row.id}`)
      .send({
        content: 'A retail project.',
        evaluation: 'Forged',
        dimensionScores: { skill: 10 },
      })
      .expect(200);
    expect(
      await prisma.careerSummary.findUniqueOrThrow({ where: { id: row.id } }),
    ).toMatchObject({
      content: 'A retail project.',
      evaluation: 'Consistent and collaborative.',
      dimensionScores: { skill: 8 },
    });
    await api('approve')
      .post(`/career-passport/summaries/${row.id}/approve`)
      .expect(201);
  });

  it('allows one Admin generation, freezes evaluation against regeneration and approves explicitly', async () => {
    const approvedAssessment = await assessment();
    await api('approve')
      .post(`/assessments/${approvedAssessment.id}/approve`)
      .expect(201);
    const row = await offboarding();
    await api('approve')
      .post(`/career-passport/summaries/${row.id}/approve`)
      .expect(400);
    await api('other')
      .post(`/career-passport/summaries/${row.id}/trigger`)
      .expect(403);
    const generated = await api('approve')
      .post(`/career-passport/summaries/${row.id}/trigger`)
      .expect(201);
    expect(objectBody(generated).status).toBe('DRAFT');
    expect(ai.send).toHaveBeenCalledTimes(1);
    await api('approve')
      .post(`/career-passport/summaries/${row.id}/trigger`)
      .expect(400);
    expect(ai.send).toHaveBeenCalledTimes(1);
    await api('approve')
      .post(`/career-passport/summaries/${row.id}/approve`)
      .expect(201);
    await api('edit')
      .patch(`/career-passport/summaries/${row.id}`)
      .send({ content: 'Late edit' })
      .expect(400);
  });
  it('redacts known project and organization names before AI and from every generated text field', async () => {
    const row = await assessment(AssessmentStatus.APPROVED);
    await prisma.assessment.update({
      where: { id: row.id },
      data: { highlights: 'Delivered Secret Orchid for Private Client Ltd' },
    });
    await prisma.company.update({
      where: { id: companyId },
      data: { name: 'Private Client Ltd' },
    });
    await prisma.projectExperience.create({
      data: {
        userId: actors.employee.id,
        employmentId,
        companyId,
        name: 'Secret Orchid',
        role: 'Developer',
        startDate: new Date(),
        contribution: 'Built Secret Orchid for Private Client Ltd',
        techStack: ['TypeScript'],
      },
    });
    ai.send.mockResolvedValueOnce({
      content: JSON.stringify({
        narrative: 'Delivered Secret Orchid for Private Client Ltd.',
        evaluation: 'Strong delivery on Secret Orchid.',
        dimensionScores: { skill: 8 },
        strengths: ['Secret Orchid expertise'],
        growthAreas: ['Mentoring at Private Client Ltd'],
      }),
    });
    const summary = await offboarding();
    const result = await api('approve')
      .post(`/career-passport/summaries/${summary.id}/trigger`)
      .expect(201);
    const prompt = JSON.stringify(ai.send.mock.calls[0]);
    expect(prompt).not.toContain('Secret Orchid');
    expect(prompt).not.toContain('Private Client Ltd');
    const text = JSON.stringify(result.body);
    expect(text).not.toContain('Secret Orchid');
    expect(text).not.toContain('Private Client Ltd');
  });

  it('requires approved assessments as the basis of organization evaluation', async () => {
    await prisma.projectExperience.create({
      data: {
        userId: actors.employee.id,
        employmentId,
        name: 'Self reported project',
        role: 'Developer',
        startDate: new Date(),
        techStack: [],
      },
    });
    const summary = await offboarding();
    await api('approve')
      .post(`/career-passport/summaries/${summary.id}/trigger`)
      .expect(400);
    expect(ai.send).not.toHaveBeenCalled();
  });

  it('rejects a null AI reply without persisting an offboarding draft', async () => {
    await assessment(AssessmentStatus.APPROVED);
    const summary = await offboarding();
    ai.send.mockResolvedValueOnce({ content: 'null' });
    await api('approve')
      .post(`/career-passport/summaries/${summary.id}/trigger`)
      .expect(502);
    expect(
      (
        await prisma.careerSummary.findUniqueOrThrow({
          where: { id: summary.id },
        })
      ).generatedAt,
    ).toBeNull();
  });

  it('does not let employees overwrite organization scores on their own profile', async () => {
    await api('employee')
      .patch(`/users/${actors.employee.id}`)
      .send({ contributionScore: 10, attitudeScore: 10 })
      .expect(403);
  });

  it('requires VIEW on alternative employee-data readers including matching and assistant', async () => {
    const job = await prisma.jobRequirement.create({
      data: {
        companyId,
        createdById: actors.full.id,
        title: 'A project',
        description: 'Test requirement',
        requiredSkills: [],
      },
    });
    await api('cross')
      .get(`/activity-logs?userId=${actors.employee.id}`)
      .expect(403);
    await api('cross')
      .get(`/skills-competency/users/${actors.employee.id}`)
      .expect(403);
    await api('cross').post(`/job-requirements/${job.id}/match`).expect(403);
    await api('cross')
      .post('/assistant/query')
      .send({ question: 'Find engineers' })
      .expect(403);
    expect(ai.send).not.toHaveBeenCalled();
  });

  it('rejects incomplete, duplicate, zero and oversized answers without losing the draft', async () => {
    const row = await assessment(AssessmentStatus.DRAFT);
    const valid = answerData();
    for (const answers of [
      [valid[0]],
      [valid[0], valid[0]],
      answerData([0, 10, 8]),
      answerData([21, 10, 8]),
    ]) {
      await api('peer')
        .post(`/assessments/${row.id}/submit`)
        .send({ answers })
        .expect(400);
      expect(
        await prisma.assessmentAnswer.count({
          where: { assessmentId: row.id },
        }),
      ).toBe(3);
    }
    expect(
      (await prisma.assessment.findUniqueOrThrow({ where: { id: row.id } }))
        .status,
    ).toBe('DRAFT');
  });

  it('does not let a VIEW-only admin write organization job requirements', async () => {
    const job = await prisma.jobRequirement.create({
      data: {
        companyId,
        createdById: actors.full.id,
        title: 'A project',
        description: 'Test requirement',
        requiredSkills: ['React'],
      },
    });
    await api('view')
      .post('/job-requirements')
      .send({
        title: 'New project',
        description: 'Needs people',
        requiredSkills: ['React'],
      })
      .expect(403);
    await api('view')
      .patch(`/job-requirements/${job.id}`)
      .send({ title: 'Changed' })
      .expect(403);
    await api('collect')
      .patch(`/job-requirements/${job.id}`)
      .send({ title: 'Recorded' })
      .expect(200);
  });

  it('revoking VIEW also hides existing roster conversation content', async () => {
    const conversation = await prisma.assistantConversation.create({
      data: {
        userId: actors.cross.id,
        focus: 'GENERAL',
        title: 'Staffing history',
        messages: {
          create: [
            {
              role: 'assistant',
              content: 'Private employee context',
              referencedUserIds: [actors.employee.id],
            },
          ],
        },
      },
    });
    await api('cross')
      .get(`/assistant/conversations/${conversation.id}`)
      .expect(403);
    const list = await api('cross').get('/assistant/conversations').expect(200);
    expect(
      (list.body as { id: string }[]).some(
        (c: { id: string }) => c.id === conversation.id,
      ),
    ).toBe(false);
  });
});
