import {
  BadGatewayException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LifeCategory, MilestoneStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AiChatService } from '../ai-chat/ai-chat.service';
import { asString, parseJsonReplyOrThrow } from '../ai-chat/ai-reply.utils';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { GeneratePlanDto } from './dto/generate-plan.dto';
import {
  CreateMilestoneDto,
  SaveRoadmapDto,
  UpdateMilestoneDto,
  UpdatePlanSettingsDto,
  UpdateTaskDto,
} from './dto/milestone.dto';

export interface GeneratePlanResult {
  planMd: string;
  summary: string;
}

/**
 * "Development Plan & Goals" — a personal roadmap slice. Follows the same
 * proposal-then-explicit-save skill shape used throughout Workflow Pro
 * (see D:\Coding\AI_Tool\docs\skills.md's intro and
 * D:\Coding\AI_Tool\docs\ba-workflow.md's "Version history is DOCS-only"
 * section) — `generate()` below never touches the DevelopmentPlan table,
 * only `saveMyPlan()` does, and unlike Workflow Pro's DOCS-only versioning
 * rule, every save here is versioned since a user only ever has one plan
 * document (see the class doc on saveMyPlan).
 */
@Injectable()
export class DevelopmentPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiChatService: AiChatService,
  ) {}

  // ---- Goals ----

  /** Optional `category` filter powers the Work/Personal split on the UI. */
  listGoals(caller: AuthenticatedUser, category?: LifeCategory) {
    return this.prisma.developmentGoal.findMany({
      where: { userId: caller.id, ...(category ? { category } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  createGoal(dto: CreateGoalDto, caller: AuthenticatedUser) {
    return this.prisma.developmentGoal.create({
      data: {
        userId: caller.id,
        title: dto.title,
        description: dto.description,
        category: dto.category,
        metric: dto.metric,
        targetValue: dto.targetValue,
        currentValue: dto.currentValue,
        progress: dto.progress,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        status: dto.status,
        aiSuggested: dto.aiSuggested,
      },
    });
  }

  async updateGoal(id: string, dto: UpdateGoalDto, caller: AuthenticatedUser) {
    await this.assertOwnGoal(id, caller);
    return this.prisma.developmentGoal.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        category: dto.category,
        metric: dto.metric,
        targetValue: dto.targetValue,
        currentValue: dto.currentValue,
        progress: dto.progress,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        status: dto.status,
      },
    });
  }

  async removeGoal(id: string, caller: AuthenticatedUser) {
    await this.assertOwnGoal(id, caller);
    await this.prisma.developmentGoal.delete({ where: { id } });
    return { id };
  }

  private async assertOwnGoal(id: string, caller: AuthenticatedUser) {
    const goal = await this.prisma.developmentGoal.findUnique({
      where: { id },
    });
    // Deliberately the same 404 whether the goal doesn't exist or belongs
    // to someone else — no need to leak which.
    if (!goal || goal.userId !== caller.id) {
      throw new NotFoundException(`Goal ${id} not found`);
    }
    return goal;
  }

  // ---- Plan: AI skill (proposal only) ----

  /**
   * The AI skill — reads the caller's own goals + skills + current plan
   * (if any) for context, calls AiChatService.send(), and returns a
   * proposal `{ planMd, summary }`. Never writes to DevelopmentPlan; only
   * saveMyPlan() (below) persists anything, on explicit user confirm.
   */
  async generate(
    dto: GeneratePlanDto,
    caller: AuthenticatedUser,
  ): Promise<GeneratePlanResult> {
    const [goals, employeeSkills, currentPlan] = await Promise.all([
      this.prisma.developmentGoal.findMany({ where: { userId: caller.id } }),
      this.prisma.employeeSkill.findMany({
        where: { userId: caller.id },
        include: { skill: true },
      }),
      this.prisma.developmentPlan.findFirst({ where: { userId: caller.id } }),
    ]);

    const systemPrompt = this.buildGeneratePlanSystemPrompt({
      goals,
      employeeSkills,
      currentPlanMd: currentPlan?.content ?? null,
    });

    const userMessage =
      dto.instruction && dto.instruction.trim().length > 0
        ? dto.instruction
        : currentPlan
          ? 'Regenerate the development plan using the latest goals and skills.'
          : 'Generate a development plan from the goals and skills above.';

    const { content } = await this.aiChatService.send({
      systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    return this.parseGeneratePlanReply(content);
  }

  private buildGeneratePlanSystemPrompt(context: {
    goals: Array<{
      title: string;
      metric: string | null;
      targetValue: number | null;
      currentValue: number | null;
      status: string;
    }>;
    employeeSkills: Array<{
      level: number;
      note: string | null;
      skill: { name: string; category: string | null };
    }>;
    currentPlanMd: string | null;
  }): string {
    const goalsText =
      context.goals.length > 0
        ? context.goals
            .map(
              (g) =>
                `- ${g.title}${g.metric ? ` (metric: ${g.metric})` : ''}${
                  g.targetValue !== null ? `, target: ${g.targetValue}` : ''
                }${
                  g.currentValue !== null ? `, current: ${g.currentValue}` : ''
                }, status: ${g.status}`,
            )
            .join('\n')
        : '(no goals recorded yet)';

    const skillsText =
      context.employeeSkills.length > 0
        ? context.employeeSkills
            .map(
              (s) =>
                `- ${s.skill.name}${s.skill.category ? ` (${s.skill.category})` : ''}: level ${s.level}${
                  s.note ? ` — ${s.note}` : ''
                }`,
            )
            .join('\n')
        : '(no skills recorded yet)';

    const currentPlanSection = context.currentPlanMd
      ? `\n\nThe user's current saved plan (revise/improve it, don't ignore it):\n${context.currentPlanMd}`
      : '';

    return `You are a career development coach helping an employee build a personalized development roadmap.

The user's current development goals:
${goalsText}

The user's current skills:
${skillsText}${currentPlanSection}

Write a personalized development plan in Markdown, grounded only in the goals and skills given above (never invent goals/skills that aren't listed). Use this section structure:
## Current Strengths
## Growth Areas
## Suggested Next Steps
## Timeline

Reply with ONLY a JSON object of the exact shape {"planMd": string, "summary": string} — no other text, no markdown code fences around the JSON itself. "planMd" is the full plan in Markdown. "summary" is one sentence describing what the plan focuses on.`;
  }

  private parseGeneratePlanReply(raw: string): GeneratePlanResult {
    const parsed = parseJsonReplyOrThrow<Record<string, unknown>>(
      raw,
      'development plan generation',
      { anchored: true },
    );

    const planMd = asString(parsed.planMd);
    if (!planMd) {
      throw new BadGatewayException(
        'AI provider returned an empty or malformed development plan',
      );
    }

    return { planMd, summary: asString(parsed.summary) ?? '' };
  }

  // ---- Plan: persistence ----

  /**
   * Explicit save — the only place a DevelopmentPlan row is ever written.
   * One plan per user (find-or-create by userId), and unlike Workflow
   * Pro's DOCS-only versioning rule (most of its documents don't need
   * history), every save here also inserts a DevelopmentPlanVersion row
   * since the single plan document always benefits from history.
   */
  async saveMyPlan(
    dto: { content: string; summary?: string; aiGenerated?: boolean },
    caller: AuthenticatedUser,
  ) {
    const existing = await this.prisma.developmentPlan.findFirst({
      where: { userId: caller.id },
    });

    const plan = existing
      ? await this.prisma.developmentPlan.update({
          where: { id: existing.id },
          data: {
            content: dto.content,
            aiGenerated: dto.aiGenerated ?? false,
          },
        })
      : await this.prisma.developmentPlan.create({
          data: {
            userId: caller.id,
            content: dto.content,
            aiGenerated: dto.aiGenerated ?? false,
          },
        });

    await this.prisma.developmentPlanVersion.create({
      data: {
        planId: plan.id,
        content: dto.content,
        changeSummary: dto.summary,
      },
    });

    return plan;
  }

  getMyPlan(caller: AuthenticatedUser) {
    return this.prisma.developmentPlan.findFirst({
      where: { userId: caller.id },
    });
  }

  // ---- Milestones & tasks ----------------------------------------------
  // These hang off the user's single DevelopmentPlan (find-or-create, same
  // as saveMyPlan) — the plan's markdown stays the narrative, milestones
  // are the "đo lường được" (measurable) part of it.

  async listMilestones(caller: AuthenticatedUser, category?: LifeCategory) {
    const plan = await this.prisma.developmentPlan.findFirst({
      where: { userId: caller.id },
    });
    if (!plan) return [];
    return this.prisma.developmentMilestone.findMany({
      where: { planId: plan.id, ...(category ? { category } : {}) },
      include: { tasks: { orderBy: { order: 'asc' } } },
      orderBy: { order: 'asc' },
    });
  }

  async createMilestone(dto: CreateMilestoneDto, caller: AuthenticatedUser) {
    const plan = await this.getOrCreatePlan(caller);
    const count = await this.prisma.developmentMilestone.count({
      where: { planId: plan.id },
    });
    return this.prisma.developmentMilestone.create({
      data: {
        planId: plan.id,
        title: dto.title,
        description: dto.description,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        order: count,
        tasks: dto.tasks?.length
          ? {
              create: dto.tasks.map((t, i) => ({
                title: t.title,
                metric: t.metric,
                order: i,
              })),
            }
          : undefined,
      },
      include: { tasks: true },
    });
  }

  async updateMilestone(
    id: string,
    dto: UpdateMilestoneDto,
    caller: AuthenticatedUser,
  ) {
    await this.assertOwnMilestone(id, caller);
    return this.prisma.developmentMilestone.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        status: dto.status,
        category: dto.category,
        order: dto.order,
      },
      include: { tasks: true },
    });
  }

  async removeMilestone(id: string, caller: AuthenticatedUser) {
    await this.assertOwnMilestone(id, caller);
    await this.prisma.developmentMilestone.delete({ where: { id } });
    return { id };
  }

  async createTask(
    milestoneId: string,
    title: string,
    metric: string | undefined,
    caller: AuthenticatedUser,
  ) {
    await this.assertOwnMilestone(milestoneId, caller);
    const count = await this.prisma.developmentTask.count({
      where: { milestoneId },
    });
    return this.prisma.developmentTask.create({
      data: { milestoneId, title, metric, order: count },
    });
  }

  async updateTask(id: string, dto: UpdateTaskDto, caller: AuthenticatedUser) {
    await this.assertOwnTask(id, caller);
    const task = await this.prisma.developmentTask.update({
      where: { id },
      data: { title: dto.title, metric: dto.metric, done: dto.done },
    });
    await this.syncMilestoneStatus(task.milestoneId);
    return task;
  }

  async removeTask(id: string, caller: AuthenticatedUser) {
    const task = await this.assertOwnTask(id, caller);
    await this.prisma.developmentTask.delete({ where: { id } });
    await this.syncMilestoneStatus(task.milestoneId);
    return { id };
  }

  /**
   * Explicit save of a roadmap the user has reviewed/edited — same
   * "proposal until confirmed" convention as the markdown plan. Replaces
   * the whole milestone/task tree rather than merging, since this is a
   * one-shot "here's my roadmap" commit, not an incremental edit.
   */
  async saveRoadmap(dto: SaveRoadmapDto, caller: AuthenticatedUser) {
    const plan = await this.getOrCreatePlan(caller);
    const category = dto.category ?? 'WORK';

    if (dto.durationWeeks !== undefined || dto.hoursPerWeek !== undefined) {
      await this.prisma.developmentPlan.update({
        where: { id: plan.id },
        data: {
          durationWeeks: dto.durationWeeks,
          hoursPerWeek: dto.hoursPerWeek,
        },
      });
    }

    // Only wipes this category's milestones — WORK and PERSONAL are
    // independent tracks on the same plan.
    await this.prisma.developmentMilestone.deleteMany({
      where: { planId: plan.id, category },
    });

    // Lưu category dưới dạng goal (context cho lộ trình)
    if (dto.milestones.length > 0) {
      const endGoal = dto.milestones[dto.milestones.length - 1];
      await this.prisma.developmentGoal.create({
        data: {
          userId: caller.id,
          title: endGoal.title,
          description: endGoal.description ?? undefined,
          category,
          dueDate: endGoal.dueDate ? new Date(endGoal.dueDate) : undefined,
          status: 'NOT_STARTED',
          progress: 0,
          aiSuggested: true,
        },
      });
    }

    for (const [index, milestone] of dto.milestones.entries()) {
      await this.prisma.developmentMilestone.create({
        data: {
          planId: plan.id,
          title: milestone.title,
          description: milestone.description,
          dueDate: milestone.dueDate ? new Date(milestone.dueDate) : undefined,
          category,
          order: index,
          tasks: {
            create: milestone.tasks.map((t, i) => ({
              title: t.title,
              metric: t.metric,
              order: i,
            })),
          },
        },
      });
    }

    return this.listMilestones(caller, category);
  }

  /**
   * Merges roadmap UI prefs into DevelopmentPlan.displaySettings JSON —
   * same get-or-create-plan pattern as saveRoadmap, but never touches
   * milestones/content.
   */
  async updatePlanSettings(dto: UpdatePlanSettingsDto, caller: AuthenticatedUser) {
    const plan = await this.getOrCreatePlan(caller);
    const existing =
      plan.displaySettings && typeof plan.displaySettings === 'object'
        ? (plan.displaySettings as Record<string, unknown>)
        : {};

    const updates = Object.fromEntries(
      Object.entries(dto).filter(([, v]) => v !== undefined),
    );
    const merged = { ...existing, ...updates };

    return this.prisma.developmentPlan.update({
      where: { id: plan.id },
      data: { displaySettings: merged },
    });
  }

  private async getOrCreatePlan(caller: AuthenticatedUser) {
    const existing = await this.prisma.developmentPlan.findFirst({
      where: { userId: caller.id },
    });
    if (existing) return existing;
    return this.prisma.developmentPlan.create({
      data: { userId: caller.id, content: '' },
    });
  }

  private async assertOwnMilestone(id: string, caller: AuthenticatedUser) {
    const milestone = await this.prisma.developmentMilestone.findUnique({
      where: { id },
      include: { plan: { select: { userId: true } } },
    });
    if (!milestone || milestone.plan.userId !== caller.id) {
      throw new NotFoundException(`Milestone ${id} not found`);
    }
    return milestone;
  }

  private async assertOwnTask(id: string, caller: AuthenticatedUser) {
    const task = await this.prisma.developmentTask.findUnique({
      where: { id },
      include: {
        milestone: { include: { plan: { select: { userId: true } } } },
      },
    });
    if (!task || task.milestone.plan.userId !== caller.id) {
      throw new NotFoundException(`Task ${id} not found`);
    }
    return task;
  }

  /** Auto-flips a milestone to DONE/IN_PROGRESS as its tasks get ticked. */
  private async syncMilestoneStatus(milestoneId: string) {
    const tasks = await this.prisma.developmentTask.findMany({
      where: { milestoneId },
    });
    if (tasks.length === 0) return;

    const allDone = tasks.every((t) => t.done);
    const anyDone = tasks.some((t) => t.done);
    const status = allDone
      ? MilestoneStatus.DONE
      : anyDone
        ? MilestoneStatus.IN_PROGRESS
        : MilestoneStatus.NOT_STARTED;

    await this.prisma.developmentMilestone.update({
      where: { id: milestoneId },
      data: { status },
    });
  }
}
