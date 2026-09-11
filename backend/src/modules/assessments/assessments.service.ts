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

type TemplateWithGroups = Prisma.AssessmentTemplateGetPayload<{
  include: typeof TEMPLATE_INCLUDE;
}>;

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

  async getTemplate(id: string, caller: AuthenticatedUser) {
    const template = await this.prisma.assessmentTemplate.findUnique({
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
    const template = await this.getTemplate(id, caller);
    this.assertCanManageTemplates(caller, template.companyId);

    // Replacing the tree bumps the version; approved assessments are
    // unaffected because they hold their own templateSnapshot.
    if (dto.groups) {
      await this.prisma.assessmentGroup.deleteMany({
        where: { templateId: template.id },
      });
    }

    return this.prisma.assessmentTemplate.update({
      where: { id: template.id },
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
  }

  async removeTemplate(id: string, caller: AuthenticatedUser) {
    const template = await this.getTemplate(id, caller);
    this.assertCanManageTemplates(caller, template.companyId);

    const usage = await this.prisma.assessment.count({
      where: { templateId: template.id },
    });
    if (usage > 0) {
      // History must stay readable, so a used template is archived, never
      // deleted.
      await this.prisma.assessmentTemplate.update({
        where: { id: template.id },
        data: { status: TemplateStatus.ARCHIVED },
      });
      return { id: template.id, archived: true };
    }

    await this.prisma.assessmentTemplate.delete({ where: { id: template.id } });
    return { id: template.id, archived: false };
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
  listPendingApproval(caller: AuthenticatedUser) {
    const companyId = resolveCompanyScope(caller);
    return this.prisma.assessment.findMany({
      where: {
        status: AssessmentStatus.SUBMITTED,
        reviewee: { companyId },
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
      await assertCanViewUser(
        this.prisma,
        caller,
        assessment.revieweeId,
        'assessments',
      );
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
    const assessment = await this.findEditable(id, caller);

    if (dto.answers) {
      await this.replaceAnswers(assessment.id, dto.answers);
    }

    return this.prisma.assessment.update({
      where: { id: assessment.id },
      data: {
        mood: dto.mood,
        highlights: dto.highlights,
        comment: dto.comment,
      },
      include: { answers: true, template: { include: TEMPLATE_INCLUDE } },
    });
  }

  /** Locks the record for review and computes the weighted total. */
  async submitAssessment(
    id: string,
    dto: UpdateAssessmentDto,
    caller: AuthenticatedUser,
  ) {
    const assessment = await this.findEditable(id, caller);

    if (dto.answers) {
      await this.replaceAnswers(assessment.id, dto.answers);
    }

    const [template, answers] = await Promise.all([
      this.prisma.assessmentTemplate.findUnique({
        where: { id: assessment.templateId },
        include: TEMPLATE_INCLUDE,
      }),
      this.prisma.assessmentAnswer.findMany({
        where: { assessmentId: assessment.id },
      }),
    ]);
    if (!template) {
      throw new NotFoundException('The template for this assessment is gone');
    }
    if (answers.length === 0) {
      throw new BadRequestException('Answer at least one question first');
    }

    return this.prisma.assessment.update({
      where: { id: assessment.id },
      data: {
        mood: dto.mood,
        highlights: dto.highlights,
        comment: dto.comment,
        status: AssessmentStatus.SUBMITTED,
        submittedAt: new Date(),
        totalScore: this.computeWeightedScore(template, answers),
      },
      include: { answers: true },
    });
  }

  /**
   * Approval is what makes the record permanent — it freezes a copy of the
   * template so later edits to the company's scale never rewrite what was
   * agreed here.
   */
  async approveAssessment(id: string, caller: AuthenticatedUser) {
    const assessment = await this.loadForApproval(id, caller);

    const template = await this.prisma.assessmentTemplate.findUnique({
      where: { id: assessment.templateId },
      include: TEMPLATE_INCLUDE,
    });

    return this.prisma.assessment.update({
      where: { id: assessment.id },
      data: {
        status: AssessmentStatus.APPROVED,
        approvedById: caller.id,
        approvedAt: new Date(),
        templateSnapshot: template
          ? (JSON.parse(JSON.stringify(template)) as Prisma.InputJsonValue)
          : undefined,
      },
      include: { answers: true },
    });
  }

  async rejectAssessment(
    id: string,
    dto: ReviewAssessmentDto,
    caller: AuthenticatedUser,
  ) {
    const assessment = await this.loadForApproval(id, caller);

    return this.prisma.assessment.update({
      where: { id: assessment.id },
      data: {
        status: AssessmentStatus.REJECTED,
        approvedById: caller.id,
        approvedAt: new Date(),
        comment: dto.comment ?? assessment.comment,
      },
    });
  }

  // --- Helpers -------------------------------------------------------------

  private buildGroupCreateInput(groups: GroupDto[]) {
    return groups.map((group, groupIndex) => ({
      name: group.name,
      description: group.description,
      weight: group.weight ?? 1,
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

  /** Only the author can edit, and only before it is submitted. */
  private async findEditable(id: string, caller: AuthenticatedUser) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id },
    });
    if (!assessment || assessment.reviewerId !== caller.id) {
      throw new NotFoundException(`Assessment ${id} not found`);
    }
    if (
      assessment.status === AssessmentStatus.APPROVED ||
      assessment.status === AssessmentStatus.SUBMITTED
    ) {
      throw new BadRequestException(
        'This assessment has already been submitted',
      );
    }
    return assessment;
  }

  private async loadForApproval(id: string, caller: AuthenticatedUser) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id },
      include: { reviewee: { select: { companyId: true } } },
    });
    if (!assessment) {
      throw new NotFoundException(`Assessment ${id} not found`);
    }
    if (assessment.status !== AssessmentStatus.SUBMITTED) {
      throw new BadRequestException(
        'Only a submitted assessment can be approved or rejected',
      );
    }
    if (assessment.reviewee.companyId) {
      this.assertCanApprove(caller, assessment.reviewee.companyId);
    } else if (caller.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Not allowed to approve this assessment');
    }
    return assessment;
  }

  private async replaceAnswers(assessmentId: string, answers: AnswerDto[]) {
    await this.prisma.assessmentAnswer.deleteMany({ where: { assessmentId } });
    if (answers.length === 0) return;
    await this.prisma.assessmentAnswer.createMany({
      data: answers.map((a) => ({
        assessmentId,
        questionId: a.questionId,
        score: a.score,
        comment: a.comment,
      })),
    });
  }

  /**
   * Weighted score on a 0-10 scale: each question is normalised against its
   * own maxScore, averaged within its group by question weight, then groups
   * are averaged by group weight.
   */
  private computeWeightedScore(
    template: TemplateWithGroups,
    answers: { questionId: string; score: number }[],
  ): number | null {
    const scoreByQuestion = new Map(
      answers.map((a) => [a.questionId, a.score]),
    );

    let weightedSum = 0;
    let totalGroupWeight = 0;

    for (const group of template.groups) {
      let groupSum = 0;
      let groupWeight = 0;

      for (const question of group.questions) {
        const raw = scoreByQuestion.get(question.id);
        if (raw === undefined) continue;
        const max = question.maxScore || 10;
        groupSum += (raw / max) * 10 * question.weight;
        groupWeight += question.weight;
      }

      if (groupWeight === 0) continue;
      weightedSum += (groupSum / groupWeight) * group.weight;
      totalGroupWeight += group.weight;
    }

    if (totalGroupWeight === 0) return null;
    return Math.round((weightedSum / totalGroupWeight) * 100) / 100;
  }
}
