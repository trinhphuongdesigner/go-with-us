import {
  BadGatewayException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AdminPermission,
  AssessmentStatus,
  AssistantFocus,
  Prisma,
  Role,
} from '@prisma/client';
import {
  assertAdminPermission,
  hasAdminPermission,
} from '../../common/access/admin-permissions';
import { PrismaService } from '../../prisma/prisma.service';
import { AiChatService } from '../ai-chat/ai-chat.service';
import type { ChatMessage } from '../ai-chat/ai-chat.types';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { AssistantQueryDto, UpdateConversationDto } from './dto/assistant.dto';

/** How many past turns to replay to the model. */
const HISTORY_LIMIT = 10;
/** Cap on employees sent as context, to keep the prompt bounded. */
const ROSTER_LIMIT = 80;

export interface RoadmapProposalTask {
  title: string;
  metric?: string;
}

export interface RoadmapProposalMilestone {
  title: string;
  description?: string;
  dueDate?: string;
  tasks: RoadmapProposalTask[];
}

export interface RoadmapProposal {
  milestones: RoadmapProposalMilestone[];
}

interface AssistantReply {
  answer: string;
  referencedUserIds: string[];
  proposal?: RoadmapProposal;
}

@Injectable()
export class AssistantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiChatService: AiChatService,
  ) {}

  listConversations(caller: AuthenticatedUser) {
    return this.prisma.assistantConversation.findMany({
      where: {
        userId: caller.id,
        ...(caller.role === Role.COMPANY_ADMIN &&
        !hasAdminPermission(caller, AdminPermission.VIEW)
          ? { focus: AssistantFocus.ROADMAP }
          : {}),
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getConversation(id: string, caller: AuthenticatedUser) {
    const conversation = await this.prisma.assistantConversation.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conversation || conversation.userId !== caller.id) {
      throw new NotFoundException(`Conversation ${id} not found`);
    }
    if (
      caller.role === Role.COMPANY_ADMIN &&
      conversation.focus === AssistantFocus.GENERAL
    ) {
      assertAdminPermission(caller, AdminPermission.VIEW);
    }
    return conversation;
  }

  async removeConversation(id: string, caller: AuthenticatedUser) {
    const conversation = await this.getConversation(id, caller);
    await this.prisma.assistantConversation.delete({
      where: { id: conversation.id },
    });
    return { id: conversation.id };
  }

  async updateConversation(
    id: string,
    dto: UpdateConversationDto,
    caller: AuthenticatedUser,
  ) {
    const conversation = await this.getConversation(id, caller);
    return this.prisma.assistantConversation.update({
      where: { id: conversation.id },
      data: { pinned: dto.pinned },
    });
  }

  /**
   * One assistant turn. Three "focuses" behind one endpoint:
   *  - GENERAL, admin/sales/BOM: staffing questions grounded in the
   *    company roster ("ai có kinh nghiệm React trên 2 năm...")
   *  - GENERAL, employee: a companion limited to their own record.
   *  - ROADMAP: a focused coach for building a development roadmap — it
   *    auto-collects the caller's own profile/skills/goals as context and
   *    either asks a clarifying question or, once it has enough to work
   *    with, emits a structured `proposal` the UI turns into an editable
   *    milestone/task tree (see development-plans' saveRoadmap).
   *
   * The chat transcript is persisted (it IS the feature's own data); no
   * profile, goal or assessment record is ever written from here — only
   * saveRoadmap() (a separate explicit call) commits a proposal.
   */
  async query(dto: AssistantQueryDto, caller: AuthenticatedUser) {
    if (
      !dto.conversationId &&
      caller.role === Role.COMPANY_ADMIN &&
      (dto.focus ?? AssistantFocus.GENERAL) === AssistantFocus.GENERAL
    ) {
      assertAdminPermission(caller, AdminPermission.VIEW);
    }
    const conversation = dto.conversationId
      ? await this.getConversation(dto.conversationId, caller)
      : await this.prisma.assistantConversation.create({
          data: {
            userId: caller.id,
            title: dto.question.slice(0, 60),
            focus: dto.focus ?? AssistantFocus.GENERAL,
          },
          include: { messages: true },
        });

    const canSearchRoster =
      caller.role === Role.HR ||
      caller.role === Role.BOD ||
      caller.role === Role.SUPER_ADMIN;

    const { systemPrompt, knownUserIds } =
      conversation.focus === AssistantFocus.ROADMAP
        ? await this.buildRoadmapContext(caller)
        : canSearchRoster
          ? await this.buildRosterContext(caller)
          : await this.buildPersonalContext(caller);

    const history: ChatMessage[] = conversation.messages
      .slice(-HISTORY_LIMIT)
      .map((m) => ({
        role:
          m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
        content: m.content,
      }));

    const { content } = await this.aiChatService.send({
      systemPrompt,
      messages: [...history, { role: 'user', content: dto.question }],
    });

    const reply = this.parseReply(
      content,
      knownUserIds,
      conversation.focus === AssistantFocus.ROADMAP,
    );

    await this.prisma.assistantMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: dto.question,
      },
    });
    const assistantMessage = await this.prisma.assistantMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: reply.answer,
        referencedUserIds: reply.referencedUserIds,
        proposalData: reply.proposal
          ? (reply.proposal as unknown as Prisma.InputJsonValue)
          : undefined,
      },
    });
    await this.prisma.assistantConversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    // Hydrate the people the assistant pointed at, so the UI can link to them.
    const referenced = reply.referencedUserIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: reply.referencedUserIds } },
          select: { id: true, name: true, jobTitle: true, avatarUrl: true },
        })
      : [];

    return {
      conversationId: conversation.id,
      message: assistantMessage,
      referenced,
    };
  }

  /** Company roster + profile data, for staffing questions. */
  private async buildRosterContext(caller: AuthenticatedUser) {
    assertAdminPermission(caller, AdminPermission.VIEW);
    if (caller.role !== Role.SUPER_ADMIN && !caller.companyId) {
      throw new ForbiddenException('No company scope for this account');
    }

    const employees = await this.prisma.user.findMany({
      where: {
        role: Role.EMPLOYEE,
        ...(caller.companyId ? { companyId: caller.companyId } : {}),
      },
      select: {
        id: true,
        name: true,
        jobTitle: true,
        skills: {
          select: { level: true, skill: { select: { name: true } } },
        },
        projectExperiences: {
          select: {
            name: true,
            role: true,
            domain: true,
            techStack: true,
            startDate: true,
            endDate: true,
          },
          orderBy: { startDate: 'desc' },
          take: 6,
        },
        certifications: {
          select: { name: true, type: true, score: true },
          take: 6,
        },
        employments: {
          select: {
            jobTitle: true,
            level: true,
            startDate: true,
            endDate: true,
          },
          orderBy: { startDate: 'desc' },
          take: 3,
        },
      },
      take: ROSTER_LIMIT,
    });

    const lines = employees.map((e) => {
      const skills = e.skills.length
        ? e.skills.map((s) => `${s.skill.name} (lvl ${s.level}/5)`).join(', ')
        : 'none recorded';
      const projects = e.projectExperiences.length
        ? e.projectExperiences
            .map(
              (p) =>
                `${p.name} as ${p.role}${p.domain ? ` [domain: ${p.domain}]` : ''}${p.techStack.length ? ` using ${p.techStack.join('/')}` : ''} (${p.startDate.toISOString().slice(0, 7)} → ${p.endDate?.toISOString().slice(0, 7) ?? 'now'})`,
            )
            .join('; ')
        : 'none recorded';
      const certs = e.certifications.length
        ? e.certifications
            .map((c) => `${c.name}${c.score ? ` ${c.score}` : ''}`)
            .join(', ')
        : 'none';
      const tenure = e.employments.length
        ? e.employments
            .map(
              (emp) =>
                `${emp.jobTitle}${emp.level ? ` (${emp.level})` : ''} ${emp.startDate.toISOString().slice(0, 7)}→${emp.endDate?.toISOString().slice(0, 7) ?? 'now'}`,
            )
            .join('; ')
        : 'n/a';
      return `- id: ${e.id}\n  name: ${e.name}\n  title: ${e.jobTitle ?? 'n/a'}\n  history: ${tenure}\n  skills: ${skills}\n  projects: ${projects}\n  certifications: ${certs}`;
    });

    const systemPrompt = `You are CareerMate's staffing assistant. Answer questions about which employees fit a need, using ONLY the roster below.

Roster:
${lines.join('\n') || '(no employees on record)'}

Reply with ONLY a JSON object, no prose, no markdown code fences:
{"answer": "<your answer in the language the user asked in, naming the people and why they fit>", "referencedUserIds": ["<ids of the people you named>"]}

Rules:
- Never invent a person, skill, project or id. If the roster cannot answer, say so plainly.
- Years of experience must be derived from the project/employment dates shown — do not guess.
- Keep the answer short and scannable; lead with the best fit.`;

    return {
      systemPrompt,
      knownUserIds: new Set(employees.map((e) => e.id)),
    };
  }

  /** The employee's own record — a personal growth companion. */
  private async buildPersonalContext(caller: AuthenticatedUser) {
    const me = await this.loadOwnProfile(caller);

    const systemPrompt = `You are CareerMate's personal career companion for ${me.name}. Use ONLY their own record below — you cannot see anyone else's data.

Current title: ${me.jobTitle ?? 'n/a'}
Skills: ${me.skills.map((s) => `${s.skill.name} (lvl ${s.level}/5)`).join(', ') || 'none recorded'}
Certifications: ${me.certifications.map((c) => `${c.name}${c.score ? ` ${c.score}` : ''}`).join(', ') || 'none'}
Projects: ${me.projectExperiences.map((p) => `${p.name} as ${p.role}${p.domain ? ` [${p.domain}]` : ''}${p.techStack.length ? ` (${p.techStack.join('/')})` : ''}`).join('; ') || 'none recorded'}
Goals: ${me.goals.map((g) => `${g.title} [${g.category}, ${g.status}, ${g.progress}%]`).join('; ') || 'none set'}
Recent approved assessments: ${me.assessmentsReceived.map((a) => `${a.cycle?.period ?? 'n/a'}: ${a.totalScore ?? 'n/a'}/10${a.highlights ? ` — ${a.highlights}` : ''}`).join('; ') || 'none yet'}

Reply with ONLY a JSON object, no prose, no markdown code fences:
{"answer": "<supportive, concrete advice in the language the user asked in>", "referencedUserIds": []}

Rules:
- Ground advice in the record above; never invent achievements or scores.
- Be specific and actionable — suggest next steps tied to their actual gaps and goals.
- You may suggest goals, but you cannot save anything: tell them to add it on the Goals screen.`;

    return { systemPrompt, knownUserIds: new Set<string>() };
  }

  /**
   * ROADMAP focus — a coach that builds a milestone/task roadmap with the
   * user. Context (skills/goals/existing roadmap) is collected automatically
   * so the user never has to repeat what's already on their profile; the
   * model is instructed to ask a clarifying question rather than guess when
   * that context isn't enough to propose something concrete.
   */
  private async buildRoadmapContext(caller: AuthenticatedUser) {
    const me = await this.loadOwnProfile(caller);
    const existingMilestones = await this.prisma.developmentMilestone.findMany({
      where: { plan: { userId: caller.id } },
      select: { title: true, status: true },
      orderBy: { order: 'asc' },
    });

    const systemPrompt = `You are CareerMate's roadmap-building coach for ${me.name}. Help them turn a growth goal into a concrete roadmap of milestones and measurable tasks.

Their profile (use this automatically — never ask them to repeat it):
Current title: ${me.jobTitle ?? 'n/a'}
Skills: ${me.skills.map((s) => `${s.skill.name} (lvl ${s.level}/5)`).join(', ') || 'none recorded'}
Existing goals: ${me.goals.map((g) => `${g.title} [${g.category}, ${g.status}]`).join('; ') || 'none set'}
Existing roadmap milestones: ${existingMilestones.map((m) => `${m.title} [${m.status}]`).join('; ') || 'none yet'}
Recent approved assessment highlights: ${
      me.assessmentsReceived
        .map((a) => a.highlights)
        .filter(Boolean)
        .join('; ') || 'none yet'
    }

Reply with ONLY a JSON object, no prose, no markdown code fences, one of these two shapes:

1) Not enough context yet to propose a concrete roadmap (don't know their target role/timeframe/what they actually want to grow into):
{"answer": "<one specific clarifying question, in the language they used>", "proposal": null}

2) You have enough to propose something concrete:
{"answer": "<one short friendly sentence introducing the proposal>", "proposal": {"milestones": [{"title": "<milestone>", "description": "<1 sentence>", "dueDate": "<YYYY-MM-DD or omit>", "tasks": [{"title": "<measurable task>", "metric": "<how completion is measured, or omit>"}]}]}}

Rules:
- Never invent skills/goals/scores not shown above.
- Prefer asking ONE focused question over guessing — but don't stall forever: once you know the target and a rough timeframe, propose.
- 2-5 milestones, 1-4 tasks each. Tasks must be concrete and measurable, not vague ("learn X" is bad, "ship 2 features using X" is good).
- Keep "answer" short — the milestones/tasks carry the detail, not the prose.`;

    return { systemPrompt, knownUserIds: new Set<string>() };
  }

  private async loadOwnProfile(caller: AuthenticatedUser) {
    const me = await this.prisma.user.findUnique({
      where: { id: caller.id },
      select: {
        id: true,
        name: true,
        jobTitle: true,
        skills: {
          select: { level: true, skill: { select: { name: true } } },
        },
        goals: {
          select: {
            title: true,
            category: true,
            status: true,
            progress: true,
            dueDate: true,
          },
        },
        projectExperiences: {
          select: { name: true, role: true, domain: true, techStack: true },
          orderBy: { startDate: 'desc' },
          take: 10,
        },
        certifications: { select: { name: true, score: true }, take: 10 },
        assessmentsReceived: {
          where: { status: AssessmentStatus.APPROVED },
          select: {
            totalScore: true,
            highlights: true,
            cycle: { select: { period: true } },
          },
          orderBy: { approvedAt: 'desc' },
          take: 6,
        },
      },
    });
    if (!me) {
      throw new NotFoundException('Your profile could not be loaded');
    }
    return me;
  }

  private parseReply(
    raw: string,
    knownUserIds: Set<string>,
    expectProposal: boolean,
  ): AssistantReply {
    let text = raw.trim();
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch) {
      text = fenceMatch[1].trim();
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      // A plain-text answer is still usable — only a genuinely empty reply
      // is a failure.
      if (text.length === 0) {
        throw new BadGatewayException('AI provider returned an empty reply');
      }
      return { answer: text, referencedUserIds: [] };
    }

    const answer =
      typeof parsed.answer === 'string' && parsed.answer.trim().length > 0
        ? parsed.answer.trim()
        : '';
    if (!answer) {
      throw new BadGatewayException('AI provider returned an empty reply');
    }

    // Drop any hallucinated id that was not in the context we sent.
    const referencedUserIds = Array.isArray(parsed.referencedUserIds)
      ? (parsed.referencedUserIds as unknown[]).filter(
          (id): id is string => typeof id === 'string' && knownUserIds.has(id),
        )
      : [];

    if (!expectProposal) {
      return { answer, referencedUserIds };
    }

    const proposal = this.parseRoadmapProposal(parsed.proposal);
    return { answer, referencedUserIds, proposal };
  }

  /** Defensive parse — a malformed proposal just falls back to "no proposal yet" rather than failing the whole turn. */
  private parseRoadmapProposal(raw: unknown): RoadmapProposal | undefined {
    if (!raw || typeof raw !== 'object') return undefined;
    const milestonesRaw = (raw as Record<string, unknown>).milestones;
    if (!Array.isArray(milestonesRaw)) return undefined;

    const milestones: RoadmapProposalMilestone[] = [];
    for (const item of milestonesRaw) {
      if (!item || typeof item !== 'object') continue;
      const m = item as Record<string, unknown>;
      if (typeof m.title !== 'string' || m.title.trim().length === 0) continue;

      const tasksRaw = Array.isArray(m.tasks) ? m.tasks : [];
      const tasks: RoadmapProposalTask[] = [];
      for (const t of tasksRaw) {
        if (!t || typeof t !== 'object') continue;
        const task = t as Record<string, unknown>;
        if (typeof task.title !== 'string' || task.title.trim().length === 0) {
          continue;
        }
        tasks.push({
          title: task.title,
          metric: typeof task.metric === 'string' ? task.metric : undefined,
        });
      }

      milestones.push({
        title: m.title,
        description:
          typeof m.description === 'string' ? m.description : undefined,
        dueDate: typeof m.dueDate === 'string' ? m.dueDate : undefined,
        tasks,
      });
    }

    return milestones.length > 0 ? { milestones } : undefined;
  }
}
