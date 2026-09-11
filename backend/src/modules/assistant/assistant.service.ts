import {
  BadGatewayException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AssessmentStatus, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AiChatService } from '../ai-chat/ai-chat.service';
import type { ChatMessage } from '../ai-chat/ai-chat.types';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { AssistantQueryDto } from './dto/assistant.dto';

/** How many past turns to replay to the model. */
const HISTORY_LIMIT = 10;
/** Cap on employees sent as context, to keep the prompt bounded. */
const ROSTER_LIMIT = 80;

interface AssistantReply {
  answer: string;
  referencedUserIds: string[];
}

@Injectable()
export class AssistantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiChatService: AiChatService,
  ) {}

  listConversations(caller: AuthenticatedUser) {
    return this.prisma.assistantConversation.findMany({
      where: { userId: caller.id },
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
    return conversation;
  }

  async removeConversation(id: string, caller: AuthenticatedUser) {
    const conversation = await this.getConversation(id, caller);
    await this.prisma.assistantConversation.delete({
      where: { id: conversation.id },
    });
    return { id: conversation.id };
  }

  /**
   * One assistant turn. Two different assistants behind one endpoint:
   *  - admin/sales/BOM ask staffing questions, and get answers grounded in
   *    the company roster ("ai có kinh nghiệm React trên 2 năm...")
   *  - an employee asks about their own growth, and only ever sees their
   *    own data.
   *
   * The chat transcript is persisted (it IS the feature's own data); no
   * profile or assessment record is ever written from here.
   */
  async query(dto: AssistantQueryDto, caller: AuthenticatedUser) {
    const conversation = dto.conversationId
      ? await this.getConversation(dto.conversationId, caller)
      : await this.prisma.assistantConversation.create({
          data: {
            userId: caller.id,
            title: dto.question.slice(0, 60),
          },
          include: { messages: true },
        });

    const canSearchRoster =
      caller.role === Role.COMPANY_ADMIN || caller.role === Role.SUPER_ADMIN;

    const { systemPrompt, knownUserIds } = canSearchRoster
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

    const reply = this.parseReply(content, knownUserIds);

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

  private parseReply(raw: string, knownUserIds: Set<string>): AssistantReply {
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

    return { answer, referencedUserIds };
  }
}
