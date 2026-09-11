import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AssessmentStatus,
  AssessmentType,
  CycleStatus,
  Prisma,
  Role,
  TemplateStatus,
} from '@prisma/client';
import {
  computeAssessmentScores,
  roundScore,
  validateAnswers,
} from './assessment-scoring';
import { PrismaService } from '../../prisma/prisma.service';
import {
  assertCanViewUser,
  resolveCompanyScope,
} from '../../common/access/user-scope';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import {
  CreateAssessmentTemplateDto,
  GroupDto,
  UpdateAssessmentTemplateDto,
} from './dto/assessment-template.dto';
import {
  AnswerDto,
  CreateAssessmentCycleDto,
  CreateAssessmentDto,
  ReviewAssessmentDto,
  UpdateAssessmentCycleDto,
  UpdateAssessmentDto,
} from './dto/assessment.dto';

const TEMPLATE_INCLUDE = {
  groups: {
    orderBy: { order: 'asc' as const },
    include: { questions: { orderBy: { order: 'asc' as const } } },
  },
};

@Injectable()
export class AssessmentsService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Templates -----------------------------------------------------------

  listTemplates(caller: AuthenticatedUser, companyId?: string) {
    const scope = resolveCompanyScope(caller, companyId);
    return this.prisma.assessmentTemplate.findMany({
      where: { companyId: scope },
      include: TEMPLATE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTemplate(
    id: string,
    caller: AuthenticatedUser,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    const template = await db.assessmentTemplate.findUnique({
      where: { id },
      include: TEMPLATE_INCLUDE,
    });
    if (!template) {
      throw new NotFoundException(`Assessment template ${id} not found`);
    }
    if (
      caller.role !== Role.SUPER_ADMIN &&
      caller.companyId !== template.companyId
    ) {
      throw new ForbiddenException('Not allowed to view this template');
    }
    return template;
  }

  /**
   * Each company builds its own scale — groups carry a weight, questions
   * carry a weight and a max score (default 10), per the idea doc's
   * "nhóm tiêu chí, trọng số, câu hỏi, thang điểm 1-10".
   */
  async createTemplate(
    dto: CreateAssessmentTemplateDto,
    caller: AuthenticatedUser,
  ) {
    const companyId = resolveCompanyScope(caller, dto.companyId);
    if (dto.groups.length === 0) {
      throw new BadRequestException('A template needs at least one group');
    }

    return this.prisma.assessmentTemplate.create({
      data: {
        companyId,
        createdById: caller.id,
        name: dto.name,
        description: dto.description,
        groups: { create: this.buildGroupCreateInput(dto.groups) },
      },
      include: TEMPLATE_INCLUDE,
    });
  }

  async updateTemplate(
    id: string,
    dto: UpdateAssessmentTemplateDto,
    caller: AuthenticatedUser,
  ) {
    // Replacing the tree bumps the version; approved assessments are
    // unaffected because they hold their own templateSnapshot.
    return this.transaction(async (tx) => {
      const template = await this.getTemplate(id, caller, tx);
      this.assertCanManageTemplates(caller, template.companyId);
      const usage = await tx.assessmentTemplate.findUniqueOrThrow({
        where: { id },
        select: { _count: { select: { cycles: true, assessments: true } } },
      });
      const changesCriteria =
        dto.groups !== undefined ||
        dto.name !== undefined ||
        dto.description !== undefined;
      // A cycle pins its scale. Copy used templates instead of deleting the
      // questions (which would cascade-delete historical answers).
      if (
        changesCriteria &&
        (usage._count.cycles > 0 || usage._count.assessments > 0)
      ) {
        await tx.assessmentTemplate.update({
          where: { id },
          data: { status: TemplateStatus.ARCHIVED },
        });
        return tx.assessmentTemplate.create({
          data: {
            companyId: template.companyId,
            createdById: caller.id,
            name: dto.name ?? template.name,
            description: dto.description ?? template.description,
            status: dto.status ?? TemplateStatus.DRAFT,
            version: template.version + 1,
            groups: {
              create: this.buildGroupCreateInput(
                dto.groups ??
                  template.groups.map((group) => ({
                    ...group,
                    description: group.description ?? undefined,
                    questions: group.questions.map((question) => ({
                      ...question,
                      guidance: question.guidance ?? undefined,
                    })),
                  })),
              ),
            },
          },
          include: TEMPLATE_INCLUDE,
        });
      }
      if (dto.groups) {
        await tx.assessmentGroup.deleteMany({ where: { templateId: id } });
      }
      return tx.assessmentTemplate.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description,
          status: dto.status,
          ...(dto.groups
            ? {
                version: { increment: 1 },
                groups: { create: this.buildGroupCreateInput(dto.groups) },
              }
            : {}),
        },
        include: TEMPLATE_INCLUDE,
      });
    });
  }

  async removeTemplate(id: string, caller: AuthenticatedUser) {
    return this.transaction(async (tx) => {
      const template = await this.getTemplate(id, caller, tx);
      this.assertCanManageTemplates(caller, template.companyId);
      const usage = await tx.assessmentTemplate.findUniqueOrThrow({
        where: { id },
        select: { _count: { select: { assessments: true, cycles: true } } },
      });
      if (usage._count.assessments > 0 || usage._count.cycles > 0) {
        await tx.assessmentTemplate.update({
          where: { id },
          data: { status: TemplateStatus.ARCHIVED },
        });
        return { id, archived: true };
      }
      await tx.assessmentTemplate.delete({ where: { id } });
      return { id, archived: false };
    });
  }

  // --- Cycles --------------------------------------------------------------

  listCycles(caller: AuthenticatedUser, companyId?: string) {
    const scope = resolveCompanyScope(caller, companyId);
    return this.prisma.assessmentCycle.findMany({
      where: { companyId: scope },
      include: {
        template: { select: { id: true, name: true } },
        _count: { select: { assessments: true } },
      },
      orderBy: { period: 'desc' },
    });
  }

  async createCycle(dto: CreateAssessmentCycleDto, caller: AuthenticatedUser) {
    const companyId = resolveCompanyScope(caller, dto.companyId);
    const template = await this.getTemplate(dto.templateId, caller);
    if (template.companyId !== companyId) {
      throw new BadRequestException('Template belongs to another company');
    }

    const clash = await this.prisma.assessmentCycle.findUnique({
      where: { companyId_period: { companyId, period: dto.period } },
    });
    if (clash) {
      throw new BadRequestException(
        `A cycle for ${dto.period} already exists in this company`,
      );
    }

    return this.prisma.assessmentCycle.create({
      data: {
        companyId,
        templateId: template.id,
        name: dto.name,
        period: dto.period,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
      include: { template: { select: { id: true, name: true } } },
    });
  }

  async updateCycle(
    id: string,
    dto: UpdateAssessmentCycleDto,
    caller: AuthenticatedUser,
  ) {
    const cycle = await this.prisma.assessmentCycle.findUnique({
      where: { id },
    });
    if (!cycle) {
      throw new NotFoundException(`Assessment cycle ${id} not found`);
    }
    this.assertCanManageTemplates(caller, cycle.companyId);

    return this.prisma.assessmentCycle.update({
      where: { id },
      data: {
        name: dto.name,
        status: dto.status,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
    });
  }

  /** The open cycle an employee should be filling in right now, if any. */
  async getActiveCycle(caller: AuthenticatedUser) {
    if (!caller.companyId) return null;
    return this.prisma.assessmentCycle.findFirst({
      where: { companyId: caller.companyId, status: CycleStatus.OPEN },
      include: { template: { include: TEMPLATE_INCLUDE } },
      orderBy: { period: 'desc' },
    });
  }

  // --- Assessments ---------------------------------------------------------

  /**
   * `mine` = what I wrote, `received` = what was written about me. Admins can
   * pass a userId to read someone else's received list.
   */
  async listAssessments(
    caller: AuthenticatedUser,
    scope: 'mine' | 'received' = 'received',
    userId?: string,
  ) {
    const targetUserId = userId ?? caller.id;
    if (scope === 'received') {
      await assertCanViewUser(this.prisma, caller, targetUserId, 'assessments');
    }

    return this.prisma.assessment.findMany({
      where:
        scope === 'mine'
          ? { reviewerId: caller.id }
          : { revieweeId: targetUserId },
      include: {
        reviewee: { select: { id: true, name: true, jobTitle: true } },
        reviewer: { select: { id: true, name: true } },
        cycle: { select: { id: true, name: true, period: true } },
        _count: { select: { answers: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Everything waiting for this admin to approve. */
  listPendingApproval(caller: AuthenticatedUser, companyId?: string) {
    const scope =
      caller.role === Role.SUPER_ADMIN
        ? companyId
        : resolveCompanyScope(caller);
    return this.prisma.assessment.findMany({
      where: {
        status: AssessmentStatus.SUBMITTED,
        ...(scope ? { template: { companyId: scope } } : {}),
      },
      include: {
        reviewee: { select: { id: true, name: true, jobTitle: true } },
        reviewer: { select: { id: true, name: true } },
        cycle: { select: { id: true, name: true, period: true } },
      },
      orderBy: { submittedAt: 'asc' },
    });
  }

  async getAssessment(id: string, caller: AuthenticatedUser) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id },
      include: {
        reviewee: { select: { id: true, name: true, jobTitle: true } },
        reviewer: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
        cycle: { select: { id: true, name: true, period: true } },
        template: { include: TEMPLATE_INCLUDE },
        answers: true,
      },
    });
    if (!assessment) {
      throw new NotFoundException(`Assessment ${id} not found`);
    }

    const isParticipant =
      assessment.reviewerId === caller.id ||
      assessment.revieweeId === caller.id;
    if (!isParticipant) {
      const canManage =
        caller.role === Role.SUPER_ADMIN ||
        (caller.role !== Role.EMPLOYEE &&
          caller.companyId === assessment.template.companyId);
      if (!canManage) {
        throw new ForbiddenException('Not allowed to view this assessment');
      }
    }

    return assessment;
  }

  async createAssessment(dto: CreateAssessmentDto, caller: AuthenticatedUser) {
    const revieweeId =
      dto.type === AssessmentType.SELF ? caller.id : dto.revieweeId;
    if (!revieweeId) {
      throw new BadRequestException('revieweeId is required for this type');
    }
    if (dto.type !== AssessmentType.SELF && revieweeId === caller.id) {
      throw new BadRequestException('Use type SELF to assess yourself');
    }

    const reviewee = await this.prisma.user.findUnique({
      where: { id: revieweeId },
      select: { id: true, companyId: true },
    });
    if (!reviewee) {
      throw new NotFoundException(`User ${revieweeId} not found`);
    }
    if (
      caller.role !== Role.SUPER_ADMIN &&
      reviewee.companyId !== caller.companyId
    ) {
      throw new ForbiddenException(
        'You can only assess people in your own company',
      );
    }

    const cycle = dto.cycleId
      ? await this.prisma.assessmentCycle.findUnique({
          where: { id: dto.cycleId },
        })
      : await this.prisma.assessmentCycle.findFirst({
          where: {
            companyId: reviewee.companyId ?? '',
            status: CycleStatus.OPEN,
          },
          orderBy: { period: 'desc' },
        });
    if (!cycle) {
      throw new BadRequestException(
        'No open assessment cycle — ask an admin to open one first',
      );
    }
    if (cycle.status === CycleStatus.CLOSED) {
      throw new BadRequestException('This assessment cycle is closed');
    }

    if (cycle.companyId !== reviewee.companyId) {
      throw new ForbiddenException(
        'The assessment cycle must belong to the reviewee company',
      );
    }
    if (dto.type === AssessmentType.MANAGER && caller.role === Role.EMPLOYEE) {
      throw new ForbiddenException(
        'Only an admin can create a manager assessment',
      );
    }
    const template = await this.getTemplate(cycle.templateId, caller);
    validateAnswers(template, dto.answers ?? []);

    // Tie the record to the employment period so it keeps its context after
    // the person leaves the company (docs/careermate-scope.md section 2.3).
    const employment = await this.prisma.employment.findFirst({
      where: { userId: revieweeId, companyId: cycle.companyId },
      orderBy: { startDate: 'desc' },
    });

    return this.prisma.assessment.create({
      data: {
        cycleId: cycle.id,
        templateId: cycle.templateId,
        revieweeId,
        reviewerId: caller.id,
        employmentId: employment?.id,
        type: dto.type,
        mood: dto.mood,
        highlights: dto.highlights,
        comment: dto.comment,
        status: AssessmentStatus.DRAFT,
        ...(dto.answers?.length
          ? {
              answers: {
                create: dto.answers.map((a) => ({
                  questionId: a.questionId,
                  score: a.score,
                  comment: a.comment,
                })),
              },
            }
          : {}),
      },
      include: { answers: true, template: { include: TEMPLATE_INCLUDE } },
    });
  }

  async updateAssessment(
    id: string,
    dto: UpdateAssessmentDto,
    caller: AuthenticatedUser,
  ) {
    return this.transaction(async (tx) => {
      const assessment = await this.findEditable(id, caller, tx, true);
      const template = await this.getTemplate(
        assessment.templateId,
        caller,
        tx,
      );
      if (dto.answers) {
        validateAnswers(template, dto.answers);
        await this.replaceAnswers(tx, assessment.id, dto.answers);
      }
      const answers = await tx.assessmentAnswer.findMany({
        where: { assessmentId: id },
      });
      const scores =
        assessment.status === AssessmentStatus.SUBMITTED
          ? computeAssessmentScores(template, answers)
          : { totalScore: null, contributionScore: null, attitudeScore: null };
      return tx.assessment.update({
        where: { id },
        data: {
          mood: dto.mood,
          highlights: dto.highlights,
          comment: dto.comment,
          ...scores,
        },
        include: { answers: true, template: { include: TEMPLATE_INCLUDE } },
      });
    });
  }

  /** Only the author submits; score and answer changes are one transaction. */
  async submitAssessment(
    id: string,
    dto: UpdateAssessmentDto,
    caller: AuthenticatedUser,
  ) {
    return this.transaction(async (tx) => {
      const assessment = await this.findEditable(id, caller, tx);
      const template = await this.getTemplate(
        assessment.templateId,
        caller,
        tx,
      );
      if (dto.answers) {
        validateAnswers(template, dto.answers, true);
        await this.replaceAnswers(tx, id, dto.answers);
      }
      const answers = await tx.assessmentAnswer.findMany({
        where: { assessmentId: id },
      });
      return tx.assessment.update({
        where: { id },
        data: {
          mood: dto.mood,
          highlights: dto.highlights,
          comment: dto.comment,
          status: AssessmentStatus.SUBMITTED,
          submittedAt: new Date(),
          ...computeAssessmentScores(template, answers),
        },
        include: { answers: true },
      });
    });
  }

  /** Freeze criteria, recompute scores and update the profile atomically. */
  async approveAssessment(id: string, caller: AuthenticatedUser) {
    return this.transaction(async (tx) => {
      const assessment = await this.loadForApproval(id, caller, tx);
      const template = await this.getTemplate(
        assessment.templateId,
        caller,
        tx,
      );
      const answers = await tx.assessmentAnswer.findMany({
        where: { assessmentId: id },
      });
      const approved = await tx.assessment.update({
        where: { id },
        data: {
          ...computeAssessmentScores(template, answers),
          status: AssessmentStatus.APPROVED,
          approvedById: caller.id,
          approvedAt: new Date(),
          templateSnapshot: JSON.parse(
            JSON.stringify(template),
          ) as Prisma.InputJsonValue,
        },
        include: { answers: true },
      });
      const average = await tx.assessment.aggregate({
        where: {
          revieweeId: assessment.revieweeId,
          status: AssessmentStatus.APPROVED,
        },
        _avg: { contributionScore: true, attitudeScore: true },
      });
      await tx.user.update({
        where: { id: assessment.revieweeId },
        data: {
          contributionScore:
            average._avg.contributionScore === null
              ? null
              : roundScore(average._avg.contributionScore),
          attitudeScore:
            average._avg.attitudeScore === null
              ? null
              : roundScore(average._avg.attitudeScore),
        },
      });
      return approved;
    });
  }

  async rejectAssessment(
    id: string,
    dto: ReviewAssessmentDto,
    caller: AuthenticatedUser,
  ) {
    return this.transaction(async (tx) => {
      const assessment = await this.loadForApproval(id, caller, tx);
      return tx.assessment.update({
        where: { id },
        data: {
          status: AssessmentStatus.REJECTED,
          approvedById: caller.id,
          approvedAt: new Date(),
          comment: dto.comment ?? assessment.comment,
        },
      });
    });
  }

  // --- Helpers -------------------------------------------------------------

  private buildGroupCreateInput(groups: GroupDto[]) {
    if (
      !groups.length ||
      !groups.some((g) => (g.weight ?? 1) > 0) ||
      groups.some(
        (g) =>
          !g.questions.length || !g.questions.some((q) => (q.weight ?? 1) > 0),
      )
    ) {
      throw new BadRequestException(
        'A template needs groups with positively weighted questions',
      );
    }
    return groups.map((group, groupIndex) => ({
      name: group.name,
      description: group.description,
      weight: group.weight ?? 1,
      scoreDimension: group.scoreDimension ?? 'CONTRIBUTION',
      order: groupIndex,
      questions: {
        create: group.questions.map((question, questionIndex) => ({
          text: question.text,
          guidance: question.guidance,
          weight: question.weight ?? 1,
          maxScore: question.maxScore ?? 10,
          order: questionIndex,
        })),
      },
    }));
  }

  /** HR builds/owns the scale — templates and cycles are their tool. */
  private assertCanManageTemplates(caller: AuthenticatedUser, companyId: string) {
    if (caller.role === Role.SUPER_ADMIN) return;
    if (caller.role === Role.HR && caller.companyId === companyId) {
      return;
    }
    throw new ForbiddenException(
      'Not allowed to manage assessment settings for this company',
    );
  }

  /** BOD does the final review/approve sign-off on a submitted assessment. */
  private assertCanApprove(caller: AuthenticatedUser, companyId: string) {
    if (caller.role === Role.SUPER_ADMIN) return;
    if (caller.role === Role.BOD && caller.companyId === companyId) {
      return;
    }
    throw new ForbiddenException('Not allowed to approve this assessment');
  }

  /** Drafts belong to their author. Submitted edits require HR; approved history is immutable. */
  private async findEditable(
    id: string,
    caller: AuthenticatedUser,
    tx: Prisma.TransactionClient,
    allowSubmitted = false,
  ) {
    const assessment = await tx.assessment.findUnique({
      where: { id },
      include: { template: { select: { companyId: true } } },
    });
    if (!assessment) throw new NotFoundException(`Assessment ${id} not found`);
    if (assessment.status === AssessmentStatus.SUBMITTED && allowSubmitted) {
      this.assertCanManageTemplates(caller, assessment.template.companyId);
      return assessment;
    }
    if (
      assessment.status === AssessmentStatus.APPROVED ||
      assessment.status === AssessmentStatus.SUBMITTED
    ) {
      throw new BadRequestException(
        'This assessment has already been submitted or approved',
      );
    }
    if (assessment.reviewerId !== caller.id)
      throw new NotFoundException(`Assessment ${id} not found`);
    return assessment;
  }

  private async loadForApproval(
    id: string,
    caller: AuthenticatedUser,
    tx: Prisma.TransactionClient,
  ) {
    const assessment = await tx.assessment.findUnique({
      where: { id },
      include: { template: { select: { companyId: true } } },
    });
    if (!assessment) throw new NotFoundException(`Assessment ${id} not found`);
    if (assessment.status !== AssessmentStatus.SUBMITTED) {
      throw new BadRequestException(
        'Only a submitted assessment can be approved or rejected',
      );
    }
    this.assertCanApprove(caller, assessment.template.companyId);
    return assessment;
  }

  private async replaceAnswers(
    tx: Prisma.TransactionClient,
    assessmentId: string,
    answers: AnswerDto[],
  ) {
    await tx.assessmentAnswer.deleteMany({ where: { assessmentId } });
    if (!answers.length) return;
    await tx.assessmentAnswer.createMany({
      data: answers.map((a) => ({
        assessmentId,
        questionId: a.questionId,
        score: a.score,
        comment: a.comment,
      })),
    });
  }

  /** Serializable retries prevent two approvals from losing each other's profile scores. */
  private async transaction<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.prisma.$transaction(work, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== 'P2034' ||
          attempt >= 3
        )
          throw error;
      }
    }
  }
}
