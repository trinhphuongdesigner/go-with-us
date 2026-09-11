import {
  BadGatewayException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiChatService } from '../ai-chat/ai-chat.service';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { GeneratePlanDto } from './dto/generate-plan.dto';

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

  listGoals(caller: AuthenticatedUser) {
    return this.prisma.developmentGoal.findMany({
      where: { userId: caller.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  createGoal(dto: CreateGoalDto, caller: AuthenticatedUser) {
    return this.prisma.developmentGoal.create({
      data: {
        userId: caller.id,
        title: dto.title,
        metric: dto.metric,
        targetValue: dto.targetValue,
        currentValue: dto.currentValue,
        status: dto.status,
      },
    });
  }

  async updateGoal(id: string, dto: UpdateGoalDto, caller: AuthenticatedUser) {
    await this.assertOwnGoal(id, caller);
    return this.prisma.developmentGoal.update({
      where: { id },
      data: dto,
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
    const stripped = this.stripCodeFences(raw);

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripped);
    } catch {
      throw new BadGatewayException(
        'AI provider returned a non-JSON reply for development plan generation',
      );
    }

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof (parsed as Record<string, unknown>).planMd !== 'string' ||
      ((parsed as Record<string, unknown>).planMd as string).trim().length === 0
    ) {
      throw new BadGatewayException(
        'AI provider returned an empty or malformed development plan',
      );
    }

    const planMd = (parsed as Record<string, unknown>).planMd as string;
    const summaryRaw = (parsed as Record<string, unknown>).summary;
    const summary = typeof summaryRaw === 'string' ? summaryRaw : '';

    return { planMd, summary };
  }

  private stripCodeFences(raw: string): string {
    const trimmed = raw.trim();
    const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    return fenceMatch ? fenceMatch[1].trim() : trimmed;
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
}
