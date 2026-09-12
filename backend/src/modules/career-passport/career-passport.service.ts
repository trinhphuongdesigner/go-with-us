import { randomBytes } from 'crypto';
import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AssessmentStatus,
  CareerSummarySource,
  CareerSummaryStatus,
  EmploymentStatus,
  Prisma,
  Role,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AiChatService } from '../ai-chat/ai-chat.service';
import {
  asStringArray,
  parseJsonReplyOrThrow,
} from '../ai-chat/ai-reply.utils';
import {
  assertCanViewUser,
  resolveCompanyScope,
} from '../../common/access/user-scope';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import {
  CreateEmploymentDto,
  CreatePassportShareDto,
  GenerateCareerSummaryDto,
  RequestOffboardingSummaryDto,
  SaveCareerSummaryDto,
  UpdateEmploymentDto,
  UpdateOffboardingSummaryDto,
} from './dto/career-passport.dto';

export interface CareerSummaryProposal {
  content: string;
  strengths: string[];
  growthAreas: string[];
  summary: string;
}

/** Fixed 5-axis scores so passports compare across companies even though
 * each one's AssessmentTemplate is bespoke (docs/careermate-scope.md 7.2). */
export interface DimensionScores {
  attendance: number;
  proactiveness: number;
  knowledge: number;
  skill: number;
  activityParticipation: number;
}

interface OffboardingProposal {
  narrative: string;
  evaluation: string;
  dimensionScores: DimensionScores;
  strengths: string[];
  growthAreas: string[];
}

@Injectable()
export class CareerPassportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiChatService: AiChatService,
  ) {}

  // --- Employments ---------------------------------------------------------

  async listEmployments(caller: AuthenticatedUser, userId?: string) {
    const targetUserId = userId ?? caller.id;
    await assertCanViewUser(
      this.prisma,
      caller,
      targetUserId,
      'employment history',
    );
    return this.prisma.employment.findMany({
      where: { userId: targetUserId },
      include: { company: { select: { id: true, name: true } } },
      orderBy: { startDate: 'desc' },
    });
  }

  async createEmployment(dto: CreateEmploymentDto, caller: AuthenticatedUser) {
    const targetUserId = dto.userId ?? caller.id;
    if (targetUserId !== caller.id && caller.role === Role.EMPLOYEE) {
      throw new ForbiddenException(
        'Only an admin can record employment for someone else',
      );
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, companyId: true },
    });
    if (!target) {
      throw new NotFoundException(`User ${targetUserId} not found`);
    }

    const companyId = dto.companyId ?? target.companyId ?? caller.companyId;
    if (!companyId) {
      throw new BadRequestException(
        'companyId is required when the user has no current company',
      );
    }
    if (caller.role === Role.HR && companyId !== caller.companyId) {
      throw new ForbiddenException('Not allowed to write for another company');
    }

    return this.prisma.employment.create({
      data: {
        userId: targetUserId,
        companyId,
        jobTitle: dto.jobTitle,
        level: dto.level,
        department: dto.department,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        status: dto.endDate ? EmploymentStatus.ENDED : EmploymentStatus.ACTIVE,
      },
      include: { company: { select: { id: true, name: true } } },
    });
  }

  /**
   * Ending an employment also clears User.companyId — the person leaves the
   * company, but every assessment/project tied to this Employment stays put.
   */
  async updateEmployment(
    id: string,
    dto: UpdateEmploymentDto,
    caller: AuthenticatedUser,
  ) {
    const employment = await this.prisma.employment.findUnique({
      where: { id },
    });
    if (!employment) {
      throw new NotFoundException(`Employment ${id} not found`);
    }
    const isOwner = employment.userId === caller.id;
    const isCompanyHr =
      caller.role === Role.HR && caller.companyId === employment.companyId;
    if (!isOwner && !isCompanyHr && caller.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Not allowed to edit this employment');
    }

    const isEnding =
      dto.status === EmploymentStatus.ENDED ||
      (dto.endDate !== undefined &&
        employment.status === EmploymentStatus.ACTIVE);

    const updated = await this.prisma.employment.update({
      where: { id },
      data: {
        jobTitle: dto.jobTitle,
        level: dto.level,
        department: dto.department,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        status: dto.status ?? (isEnding ? EmploymentStatus.ENDED : undefined),
      },
      include: { company: { select: { id: true, name: true } } },
    });

    if (isEnding) {
      const stillEmployed = await this.prisma.employment.count({
        where: {
          userId: employment.userId,
          companyId: employment.companyId,
          status: EmploymentStatus.ACTIVE,
        },
      });
      if (stillEmployed === 0) {
        await this.prisma.user.updateMany({
          where: { id: employment.userId, companyId: employment.companyId },
          data: { companyId: null },
        });
      }
    }

    return updated;
  }

  // --- Passport ------------------------------------------------------------

  /**
   * The whole career record for one person: every employment period with the
   * approved assessments, projects and AI summary that belong to it. This is
   * what a new employer sees via a share link.
   */
  async getPassport(caller: AuthenticatedUser, userId?: string) {
    const targetUserId = userId ?? caller.id;
    await assertCanViewUser(
      this.prisma,
      caller,
      targetUserId,
      'career passport',
    );
    return this.buildPassport(targetUserId);
  }

  /** Public read via share token — no auth, so it validates the token hard. */
  async getSharedPassport(token: string) {
    const share = await this.prisma.careerPassportShare.findUnique({
      where: { token },
    });
    if (!share || share.revokedAt) {
      throw new NotFoundException('This share link is no longer valid');
    }
    if (share.expiresAt && share.expiresAt.getTime() < Date.now()) {
      throw new NotFoundException('This share link has expired');
    }

    await this.prisma.careerPassportShare.update({
      where: { id: share.id },
      data: { viewCount: { increment: 1 } },
    });

    const passport = await this.buildPassport(share.userId);
    return {
      ...passport,
      share: { label: share.label, viewCount: share.viewCount + 1 },
    };
  }

  private async buildPassport(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        jobTitle: true,
        avatarUrl: true,
        contributionScore: true,
        attitudeScore: true,
        company: { select: { id: true, name: true } },
      },
    });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const [employments, summaries, skills, certifications, awards] =
      await Promise.all([
        this.prisma.employment.findMany({
          where: { userId },
          include: {
            company: { select: { id: true, name: true } },
            projectExperiences: { orderBy: { startDate: 'desc' } },
            // Only APPROVED assessments travel with the person — drafts and
            // rejected ones are internal to the company that ran them.
            assessments: {
              where: { status: AssessmentStatus.APPROVED },
              select: {
                id: true,
                type: true,
                totalScore: true,
                mood: true,
                highlights: true,
                approvedAt: true,
                cycle: { select: { period: true, name: true } },
              },
              orderBy: { approvedAt: 'desc' },
            },
          },
          orderBy: { startDate: 'desc' },
        }),
        this.prisma.careerSummary.findMany({
          // Only APPROVED summaries travel with the passport — a DRAFT
          // ORGANIZATION_OFFBOARDING row (requested, maybe generated, not
          // yet reviewed) stays internal until an admin approves it.
          where: { userId, status: CareerSummaryStatus.APPROVED },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.employeeSkill.findMany({
          where: { userId },
          include: { skill: true },
          orderBy: { level: 'desc' },
        }),
        this.prisma.certification.findMany({
          where: { userId },
          orderBy: [{ issuedAt: 'desc' }, { createdAt: 'desc' }],
        }),
        this.prisma.award.findMany({
          where: { userId },
          orderBy: [{ awardedAt: 'desc' }, { createdAt: 'desc' }],
        }),
      ]);

    const summaryByEmployment = new Map(
      summaries
        .filter((s) => s.employmentId)
        .map((s) => [s.employmentId as string, s]),
    );

    return {
      user,
      periods: employments.map((employment) => {
        const scores = employment.assessments
          .map((a) => a.totalScore)
          .filter((s): s is number => s !== null);
        return {
          ...employment,
          summary: summaryByEmployment.get(employment.id) ?? null,
          averageScore: scores.length
            ? Math.round(
                (scores.reduce((sum, s) => sum + s, 0) / scores.length) * 100,
              ) / 100
            : null,
        };
      }),
      overallSummary: summaries.find((s) => !s.employmentId) ?? null,
      skills,
      certifications,
      awards,
    };
  }

  // --- AI career summary ---------------------------------------------------

  listSummaries(caller: AuthenticatedUser) {
    return this.prisma.careerSummary.findMany({
      where: { userId: caller.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * The AI skill (proposal only — nothing is written here). Reads the
   * approved assessments, projects, skills and goals of one employment
   * period and writes the recap a future employer would want to read.
   */
  async generateSummary(
    dto: GenerateCareerSummaryDto,
    caller: AuthenticatedUser,
  ): Promise<CareerSummaryProposal> {
    const targetUserId = dto.userId ?? caller.id;
    await assertCanViewUser(
      this.prisma,
      caller,
      targetUserId,
      'career passport',
    );

    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, name: true, jobTitle: true },
    });
    if (!user) {
      throw new NotFoundException(`User ${targetUserId} not found`);
    }

    const employment = dto.employmentId
      ? await this.prisma.employment.findUnique({
          where: { id: dto.employmentId },
          include: { company: { select: { name: true } } },
        })
      : null;
    if (
      dto.employmentId &&
      (!employment || employment.userId !== targetUserId)
    ) {
      throw new NotFoundException(`Employment ${dto.employmentId} not found`);
    }

    const [assessments, projects, skills, goals] = await Promise.all([
      this.prisma.assessment.findMany({
        where: {
          revieweeId: targetUserId,
          status: AssessmentStatus.APPROVED,
          ...(employment ? { employmentId: employment.id } : {}),
        },
        include: {
          cycle: { select: { period: true } },
          answers: {
            include: { question: { select: { text: true, maxScore: true } } },
          },
        },
        orderBy: { approvedAt: 'asc' },
      }),
      this.prisma.projectExperience.findMany({
        where: {
          userId: targetUserId,
          ...(employment ? { employmentId: employment.id } : {}),
        },
        orderBy: { startDate: 'asc' },
      }),
      this.prisma.employeeSkill.findMany({
        where: { userId: targetUserId },
        include: { skill: true },
        orderBy: { level: 'desc' },
        take: 20,
      }),
      this.prisma.developmentGoal.findMany({
        where: { userId: targetUserId },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      }),
    ]);

    if (assessments.length === 0 && projects.length === 0) {
      throw new BadRequestException(
        'Not enough history yet — record some projects or approved assessments first',
      );
    }

    const { content } = await this.aiChatService.send({
      systemPrompt: this.buildSummaryPrompt(),
      messages: [
        {
          role: 'user',
          content: this.buildSummaryContext(
            user,
            employment,
            assessments,
            projects,
            skills,
            goals,
          ),
        },
      ],
    });

    return this.parseSummaryReply(content);
  }

  /** Explicit save — the user/admin keeps or edits the proposal first. */
  async saveSummary(dto: SaveCareerSummaryDto, caller: AuthenticatedUser) {
    if (dto.employmentId) {
      const employment = await this.prisma.employment.findUnique({
        where: { id: dto.employmentId },
      });
      if (!employment || employment.userId !== caller.id) {
        throw new NotFoundException(`Employment ${dto.employmentId} not found`);
      }
      return this.prisma.careerSummary.create({
        data: {
          userId: caller.id,
          employmentId: employment.id,
          content: dto.content,
          strengths: dto.strengths ?? [],
          growthAreas: dto.growthAreas ?? [],
          periodStart: employment.startDate,
          periodEnd: employment.endDate,
        },
      });
    }

    return this.prisma.careerSummary.create({
      data: {
        userId: caller.id,
        content: dto.content,
        strengths: dto.strengths ?? [],
        growthAreas: dto.growthAreas ?? [],
      },
    });
  }

  // --- Offboarding summary (ORGANIZATION_OFFBOARDING) -----------------------
  // Request -> trigger -> (admin edits narrative only) -> approve. See the
  // CareerSummary model doc for why this shares a table with the self-serve
  // flow above instead of being a separate model.

  /**
   * Owner requests a summary for one of their own employments — this just
   * creates the empty DRAFT row; no AI runs yet. Only an admin can trigger
   * generation (assertAdminForEmployment below), which is what makes the
   * eventual result an org judgement rather than something the employee
   * wrote about themselves.
   */
  async requestOffboardingSummary(
    dto: RequestOffboardingSummaryDto,
    caller: AuthenticatedUser,
  ) {
    const employment = await this.prisma.employment.findUnique({
      where: { id: dto.employmentId },
    });
    if (!employment || employment.userId !== caller.id) {
      throw new NotFoundException(`Employment ${dto.employmentId} not found`);
    }

    const existing = await this.prisma.careerSummary.findFirst({
      where: {
        employmentId: employment.id,
        source: CareerSummarySource.ORGANIZATION_OFFBOARDING,
        status: CareerSummaryStatus.DRAFT,
      },
    });
    if (existing) return existing;

    return this.prisma.careerSummary.create({
      data: {
        userId: caller.id,
        employmentId: employment.id,
        content: '',
        source: CareerSummarySource.ORGANIZATION_OFFBOARDING,
        status: CareerSummaryStatus.DRAFT,
        requestedById: caller.id,
        requestedAt: new Date(),
        periodStart: employment.startDate,
        periodEnd: employment.endDate,
      },
    });
  }

  /** Everything waiting on this admin — requested-not-generated and
   * generated-not-approved both show up here; the FE tells them apart by
   * `generatedAt`. */
  listPendingOffboardingSummaries(
    caller: AuthenticatedUser,
    companyId?: string,
  ) {
    const scope =
      caller.role === Role.SUPER_ADMIN
        ? companyId
        : resolveCompanyScope(caller);
    return this.prisma.careerSummary.findMany({
      where: {
        source: CareerSummarySource.ORGANIZATION_OFFBOARDING,
        status: CareerSummaryStatus.DRAFT,
        ...(scope ? { employment: { companyId: scope } } : {}),
      },
      include: {
        user: { select: { id: true, name: true, jobTitle: true } },
        employment: {
          select: {
            id: true,
            jobTitle: true,
            startDate: true,
            endDate: true,
            company: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { requestedAt: 'asc' },
    });
  }

  /**
   * Admin-triggered AI generation — the only place `evaluation` and
   * `dimensionScores` are ever written, straight from approved Assessment
   * data. The narrative is written redacted (no exact project/client
   * names) so what an admin might still need to fix by hand is minimal.
   */
  async triggerOffboardingSummary(id: string, caller: AuthenticatedUser) {
    const summary = await this.loadOffboardingDraft(id, caller);
    if (summary.generatedAt) {
      throw new BadRequestException(
        'This summary has already been generated; its evaluation is locked',
      );
    }
    if (!summary.employmentId) {
      throw new BadRequestException(
        'Offboarding requires an employment period',
      );
    }

    const [assessments, projects, skills, goals] = await Promise.all([
      this.prisma.assessment.findMany({
        where: {
          revieweeId: summary.userId,
          status: AssessmentStatus.APPROVED,
          employmentId: summary.employmentId ?? undefined,
        },
        include: {
          cycle: { select: { period: true } },
          answers: {
            include: { question: { select: { text: true, maxScore: true } } },
          },
        },
        orderBy: { approvedAt: 'asc' },
      }),
      this.prisma.projectExperience.findMany({
        where: {
          userId: summary.userId,
          employmentId: summary.employmentId ?? undefined,
        },
        orderBy: { startDate: 'asc' },
      }),
      this.prisma.employeeSkill.findMany({
        where: { userId: summary.userId },
        include: { skill: true },
        orderBy: { level: 'desc' },
        take: 20,
      }),
      this.prisma.developmentGoal.findMany({
        where: { userId: summary.userId },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      }),
    ]);

    if (assessments.length === 0) {
      throw new BadRequestException(
        'An offboarding evaluation requires approved assessments for this employment period',
      );
    }

    const redact = this.offboardingRedactor(
      summary.employment?.company.name,
      projects,
    );
    const { content } = await this.aiChatService.send({
      systemPrompt: this.buildOffboardingPrompt(),
      messages: [
        {
          role: 'user',
          content: redact(
            this.buildSummaryContext(
              { name: summary.user.name, jobTitle: summary.user.jobTitle },
              summary.employment,
              assessments,
              projects,
              skills,
              goals,
            ),
          ),
        },
      ],
    });

    const proposal = this.parseOffboardingReply(content);

    const saved = await this.prisma.careerSummary.updateMany({
      where: {
        id: summary.id,
        status: CareerSummaryStatus.DRAFT,
        generatedAt: null,
      },
      data: {
        content: redact(proposal.narrative),
        evaluation: redact(proposal.evaluation),
        dimensionScores:
          proposal.dimensionScores as unknown as Prisma.InputJsonValue,
        strengths: proposal.strengths.map(redact),
        growthAreas: proposal.growthAreas.map(redact),
        aiGenerated: true,
        generatedAt: new Date(),
      },
    });
    if (saved.count !== 1) {
      throw new BadRequestException(
        'This summary has already been generated or approved',
      );
    }
    return this.prisma.careerSummary.findUniqueOrThrow({
      where: { id: summary.id },
    });
  }

  /** Admin edits the narrative only — `evaluation`/`dimensionScores` have
   * no path to mutation here, by construction (DTO only carries `content`). */
  async updateOffboardingSummary(
    id: string,
    dto: UpdateOffboardingSummaryDto,
    caller: AuthenticatedUser,
  ) {
    const summary = await this.loadOffboardingDraft(id, caller);
    if (!summary.generatedAt) {
      throw new BadRequestException('Trigger the AI summary before editing it');
    }
    const saved = await this.prisma.careerSummary.updateMany({
      where: {
        id: summary.id,
        status: CareerSummaryStatus.DRAFT,
        generatedAt: { not: null },
      },
      data: { content: dto.content },
    });
    if (saved.count !== 1)
      throw new BadRequestException('This summary is no longer editable');
    return this.prisma.careerSummary.findUniqueOrThrow({
      where: { id: summary.id },
    });
  }

  async approveOffboardingSummary(id: string, caller: AuthenticatedUser) {
    const summary = await this.loadOffboardingDraft(id, caller);
    if (!summary.generatedAt) {
      throw new BadRequestException(
        'Trigger the AI summary before approving it',
      );
    }
    const saved = await this.prisma.careerSummary.updateMany({
      where: {
        id: summary.id,
        status: CareerSummaryStatus.DRAFT,
        generatedAt: { not: null },
      },
      data: {
        status: CareerSummaryStatus.APPROVED,
        approvedById: caller.id,
        approvedAt: new Date(),
      },
    });
    if (saved.count !== 1)
      throw new BadRequestException('This summary has already been approved');
    return this.prisma.careerSummary.findUniqueOrThrow({
      where: { id: summary.id },
    });
  }

  private async loadOffboardingDraft(id: string, caller: AuthenticatedUser) {
    const summary = await this.prisma.careerSummary.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, jobTitle: true } },
        employment: {
          include: { company: { select: { id: true, name: true } } },
        },
      },
    });
    if (
      !summary ||
      summary.source !== CareerSummarySource.ORGANIZATION_OFFBOARDING
    ) {
      throw new NotFoundException(`Offboarding summary ${id} not found`);
    }
    if (summary.status !== CareerSummaryStatus.DRAFT) {
      throw new BadRequestException('This summary has already been approved');
    }

    // Which of HR/BOD may call this is already narrowed per-endpoint by the
    // controller's @Roles — trigger/approve are BOD, the narrative edit is
    // HR — so this only needs to confirm same-company scope.
    const companyId = summary.employment?.companyId;
    if (caller.role === Role.SUPER_ADMIN) {
      // allowed
    } else if (caller.role === Role.HR || caller.role === Role.BOD) {
      if (!companyId || caller.companyId !== companyId) {
        throw new ForbiddenException(
          'Not allowed to manage this offboarding summary',
        );
      }
    } else {
      throw new ForbiddenException(
        'Not allowed to manage this offboarding summary',
      );
    }

    return summary;
  }

  /** Replace known identifiers before sending context, and again before saving AI output. */
  private offboardingRedactor(
    companyName: string | undefined,
    projects: { name: string }[],
  ) {
    const labels = new Map<string, string>();
    if (companyName?.trim())
      labels.set(companyName.trim().toLowerCase(), '[Organization]');
    projects.forEach((project, index) => {
      if (project.name.trim())
        labels.set(project.name.trim().toLowerCase(), `[Project ${index + 1}]`);
    });
    const names = [...labels.keys()].sort((a, b) => b.length - a.length);
    if (!names.length) return (text: string) => text;
    const escaped = names.map((name) =>
      name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    );
    const pattern = new RegExp(escaped.join('|'), 'gi');
    return (text: string) =>
      text.replace(
        pattern,
        (match) => labels.get(match.toLowerCase()) ?? '[Redacted]',
      );
  }

  private buildOffboardingPrompt(): string {
    return `You write the ORGANIZATION-VERIFIED career recap that follows a person after they leave — this is not self-reported, it is the company's own judgement of their time there, grounded strictly in approved assessment data.

Reply with ONLY a JSON object of this exact shape, no prose, no markdown code fences:
{
  "narrative": "<markdown, 2-4 short paragraphs: what they worked on and how they grew, written for a FUTURE employer>",
  "evaluation": "<markdown, 1-3 short paragraphs: attitude, competency and growth, grounded only in the assessment data given>",
  "dimensionScores": {"attendance": <0-10>, "proactiveness": <0-10>, "knowledge": <0-10>, "skill": <0-10>, "activityParticipation": <0-10>},
  "strengths": ["<short phrase>"],
  "growthAreas": ["<short phrase>"]
}

CRITICAL redaction rule for ALL text fields: NEVER mention an exact project name or client/customer name. Describe them generically instead — e.g. "a retail client's inventory platform" instead of the actual project name, "a fintech client" instead of the actual company name. Preserve anonymized project/organization labels. Describe unnamed clients generically. Never reintroduce identifying names in evaluation, strengths or growthAreas.

Other rules:
- Ground every claim in the data provided. Never invent a project, score or achievement.
- dimensionScores are your best-grounded estimate from the assessment scores/comments given — if a dimension truly isn't covered by the data, use 5 (neutral), never leave it out.
- Be factual and balanced — this record follows the person for life, so no marketing language and no unearned praise.
- Write in the same language as the input data.`;
  }

  private parseOffboardingReply(raw: string): OffboardingProposal {
    const parsed = parseJsonReplyOrThrow<Record<string, unknown>>(
      raw,
      'offboarding summary',
    );

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new BadGatewayException(
        'AI provider returned an invalid offboarding summary',
      );
    }

    const narrative =
      typeof parsed.narrative === 'string' && parsed.narrative.trim().length > 0
        ? parsed.narrative.trim()
        : '';
    const evaluation =
      typeof parsed.evaluation === 'string' &&
      parsed.evaluation.trim().length > 0
        ? parsed.evaluation.trim()
        : '';
    if (!narrative || !evaluation) {
      throw new BadGatewayException(
        'AI provider returned an empty offboarding summary',
      );
    }

    const rawScores = (parsed.dimensionScores ?? {}) as Record<string, unknown>;
    const clampScore = (value: unknown): number => {
      const num = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(num)) return 5;
      return Math.max(0, Math.min(10, Math.round(num * 10) / 10));
    };
    const dimensionScores: DimensionScores = {
      attendance: clampScore(rawScores.attendance),
      proactiveness: clampScore(rawScores.proactiveness),
      knowledge: clampScore(rawScores.knowledge),
      skill: clampScore(rawScores.skill),
      activityParticipation: clampScore(rawScores.activityParticipation),
    };

    return {
      narrative,
      evaluation,
      dimensionScores,
      strengths: asStringArray(parsed.strengths),
      growthAreas: asStringArray(parsed.growthAreas),
    };
  }

  // --- Share links ---------------------------------------------------------

  listShares(caller: AuthenticatedUser) {
    return this.prisma.careerPassportShare.findMany({
      where: { userId: caller.id },
      include: { company: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  createShare(dto: CreatePassportShareDto, caller: AuthenticatedUser) {
    return this.prisma.careerPassportShare.create({
      data: {
        userId: caller.id,
        token: randomBytes(24).toString('base64url'),
        label: dto.label,
        companyId: dto.companyId,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });
  }

  async revokeShare(id: string, caller: AuthenticatedUser) {
    const share = await this.prisma.careerPassportShare.findUnique({
      where: { id },
    });
    if (!share || share.userId !== caller.id) {
      throw new NotFoundException(`Share ${id} not found`);
    }
    return this.prisma.careerPassportShare.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  // --- AI plumbing ---------------------------------------------------------

  private buildSummaryPrompt(): string {
    return `You write the career recap that follows a person between employers.

Reply with ONLY a JSON object of this exact shape, no prose, no markdown code fences:
{
  "content": "<markdown recap, 3-5 short paragraphs: what they did, how they worked (attitude), competency level at that position, and how they grew over the period>",
  "strengths": ["<short phrase>"],
  "growthAreas": ["<short phrase>"],
  "summary": "<one sentence a hiring manager could skim>"
}

Rules:
- Ground every claim in the data provided. Never invent a project, score or achievement.
- Be factual and balanced — this record follows the person for life, so no marketing language and no unearned praise.
- If assessment scores exist, describe the trend over time rather than quoting every number.
- Write in the same language as the input data.`;
  }

  private buildSummaryContext(
    user: { name: string; jobTitle: string | null },
    employment: {
      jobTitle: string;
      level: string | null;
      startDate: Date;
      endDate: Date | null;
      company: { name: string };
    } | null,
    assessments: {
      type: string;
      totalScore: number | null;
      mood: string | null;
      highlights: string | null;
      cycle: { period: string } | null;
      answers: {
        score: number;
        comment: string | null;
        question: { text: string; maxScore?: number };
      }[];
    }[],
    projects: {
      name: string;
      role: string;
      domain: string | null;
      techStack: string[];
      contribution: string | null;
    }[],
    skills: { level: number; skill: { name: string } }[],
    goals: { title: string; status: string; progress: number }[],
  ): string {
    const period = employment
      ? `${employment.jobTitle}${employment.level ? ` (${employment.level})` : ''} at ${employment.company.name}, ${employment.startDate.toISOString().slice(0, 10)} → ${employment.endDate?.toISOString().slice(0, 10) ?? 'present'}`
      : 'Whole career on record';

    const assessmentLines = assessments.length
      ? assessments
          .map((a) => {
            const answerText = a.answers
              .map(
                (ans) =>
                  `${ans.question.text}: ${ans.score}/${ans.question.maxScore ?? 10}${ans.comment ? ` — ${ans.comment}` : ''}`,
              )
              .join('; ');
            return `- ${a.cycle?.period ?? 'n/a'} [${a.type}] overall ${a.totalScore ?? 'n/a'}/10${a.mood ? `, mood: ${a.mood}` : ''}${a.highlights ? `, highlights: ${a.highlights}` : ''}${answerText ? `\n    ${answerText}` : ''}`;
          })
          .join('\n')
      : '- none on record';

    const projectLines = projects.length
      ? projects
          .map(
            (p) =>
              `- ${p.name} as ${p.role}${p.domain ? ` (domain: ${p.domain})` : ''}${p.techStack.length ? `, stack: ${p.techStack.join(', ')}` : ''}${p.contribution ? `\n    contribution: ${p.contribution}` : ''}`,
          )
          .join('\n')
      : '- none on record';

    const skillLines = skills.length
      ? skills.map((s) => `${s.skill.name} (level ${s.level}/5)`).join(', ')
      : 'none on record';

    const goalLines = goals.length
      ? goals
          .map((g) => `- ${g.title} [${g.status}, ${g.progress}%]`)
          .join('\n')
      : '- none on record';

    return `Person: ${user.name}${user.jobTitle ? ` — ${user.jobTitle}` : ''}
Period: ${period}

Approved assessments:
${assessmentLines}

Projects:
${projectLines}

Skills: ${skillLines}

Development goals:
${goalLines}

Write the career recap JSON for this period now.`;
  }

  private parseSummaryReply(raw: string): CareerSummaryProposal {
    const parsed = parseJsonReplyOrThrow<Record<string, unknown>>(
      raw,
      'career summary',
    );

    const content =
      typeof parsed.content === 'string' && parsed.content.trim().length > 0
        ? parsed.content.trim()
        : '';
    if (!content) {
      throw new BadGatewayException(
        'AI provider returned an empty career summary',
      );
    }

    return {
      content,
      strengths: asStringArray(parsed.strengths),
      growthAreas: asStringArray(parsed.growthAreas),
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
    };
  }
}
