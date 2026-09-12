import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AiChatService } from '../ai-chat/ai-chat.service';
import { parseJsonReplyOrThrow } from '../ai-chat/ai-reply.utils';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { CreateJobRequirementDto } from './dto/create-job-requirement.dto';
import { UpdateJobRequirementDto } from './dto/update-job-requirement.dto';

interface RawMatchItem {
  userId?: unknown;
  matchScore?: unknown;
  rationale?: unknown;
}

interface RawMatchReply {
  matches?: unknown;
  summary?: unknown;
}

export interface CandidateMatch {
  userId: string;
  name: string;
  jobTitle: string | null;
  matchScore: number;
  rationale: string;
}

export interface MatchResult {
  matches: CandidateMatch[];
  summary: string;
}

@Injectable()
export class JobRequirementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiChatService: AiChatService,
  ) {}

  /**
   * SUPER_ADMIN has no company of their own, so they must pass one
   * explicitly; every other role is scoped to their own companyId.
   */
  findAll(caller: AuthenticatedUser, companyId?: string) {
    if (caller.role === Role.SUPER_ADMIN) {
      if (!companyId) {
        throw new BadRequestException(
          'companyId query param is required for SUPER_ADMIN',
        );
      }
      return this.prisma.jobRequirement.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!caller.companyId) {
      throw new ForbiddenException('No company scope for this account');
    }

    return this.prisma.jobRequirement.findMany({
      where: { companyId: caller.companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateJobRequirementDto, caller: AuthenticatedUser) {
    let companyId: string;
    if (caller.role === Role.SUPER_ADMIN) {
      if (!dto.companyId) {
        throw new BadRequestException('companyId is required for SUPER_ADMIN');
      }
      companyId = dto.companyId;
    } else {
      // HR/BOD — force their own company, ignore any client-supplied
      // companyId (RolesGuard already keeps EMPLOYEE out of this handler).
      if (!caller.companyId) {
        throw new ForbiddenException('No company scope for this account');
      }
      companyId = caller.companyId;
    }

    return this.prisma.jobRequirement.create({
      data: {
        companyId,
        createdById: caller.id,
        title: dto.title,
        description: dto.description,
        requiredSkills: dto.requiredSkills,
      },
    });
  }

  async update(
    id: string,
    dto: UpdateJobRequirementDto,
    caller: AuthenticatedUser,
  ) {
    const requirement = await this.findOwned(id, caller);

    return this.prisma.jobRequirement.update({
      where: { id: requirement.id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.requiredSkills !== undefined
          ? { requiredSkills: dto.requiredSkills }
          : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });
  }

  async remove(id: string, caller: AuthenticatedUser) {
    const requirement = await this.findOwned(id, caller);
    await this.prisma.jobRequirement.delete({ where: { id: requirement.id } });
    return { id: requirement.id };
  }

  /**
   * The AI skill — see D:\Coding\AI_Tool\docs\skills.md's conventions for
   * the shape this follows (proposal-only, no persistence). Unlike every
   * skill in that reference doc, this result is read-only analysis with no
   * save step, so it's returned straight to the frontend.
   */
  async match(id: string, caller: AuthenticatedUser): Promise<MatchResult> {
    const requirement = await this.findOwned(id, caller);

    const candidates = await this.prisma.user.findMany({
      where: { companyId: requirement.companyId, role: Role.EMPLOYEE },
      select: {
        id: true,
        name: true,
        jobTitle: true,
        skills: {
          select: {
            level: true,
            skill: { select: { name: true } },
          },
        },
      },
    });

    const candidateById = new Map(candidates.map((c) => [c.id, c]));

    if (candidates.length === 0) {
      return { matches: [], summary: 'No employees found to match against.' };
    }

    const systemPrompt = this.buildMatchSystemPrompt(requirement, candidates);

    const { content } = await this.aiChatService.send({
      systemPrompt,
      messages: [
        {
          role: 'user',
          content: 'Return the JSON match result for this job requirement now.',
        },
      ],
    });

    const parsed = this.parseMatchReply(content);

    const matches: CandidateMatch[] = [];
    for (const item of parsed.matches) {
      const candidate = candidateById.get(item.userId);
      // Never trust a hallucinated id — drop anything not in the actual
      // candidate set we sent to the model.
      if (!candidate) continue;
      matches.push({
        userId: candidate.id,
        name: candidate.name,
        jobTitle: candidate.jobTitle ?? null,
        matchScore: item.matchScore,
        rationale: item.rationale,
      });
    }

    matches.sort((a, b) => b.matchScore - a.matchScore);

    return { matches, summary: parsed.summary };
  }

  /** Loads a requirement and enforces creator/same-company HR-or-BOD access. */
  private async findOwned(id: string, caller: AuthenticatedUser) {
    const requirement = await this.prisma.jobRequirement.findUnique({
      where: { id },
    });
    if (!requirement) {
      throw new NotFoundException(`Job requirement ${id} not found`);
    }

    const isCreator = requirement.createdById === caller.id;
    const isSameCompanyManager =
      (caller.role === Role.HR || caller.role === Role.BOD) &&
      caller.companyId === requirement.companyId;
    const isSuperAdmin = caller.role === Role.SUPER_ADMIN;

    if (!isCreator && !isSameCompanyManager && !isSuperAdmin) {
      throw new ForbiddenException(
        'Not allowed to manage this job requirement',
      );
    }

    return requirement;
  }

  private buildMatchSystemPrompt(
    requirement: {
      title: string;
      description: string;
      requiredSkills: string[];
    },
    candidates: {
      id: string;
      name: string;
      jobTitle: string | null;
      skills: { level: number; skill: { name: string } }[];
    }[],
  ): string {
    const candidateLines = candidates
      .map((c) => {
        const skillList =
          c.skills.length > 0
            ? c.skills
                .map((s) => `${s.skill.name} (level ${s.level})`)
                .join(', ')
            : 'no recorded skills';
        return `- id: ${c.id}\n  name: ${c.name}\n  jobTitle: ${c.jobTitle ?? 'n/a'}\n  skills: ${skillList}`;
      })
      .join('\n');

    return `You are matching employees to an open job requirement for a company.

Job requirement:
Title: ${requirement.title}
Description: ${requirement.description}
Required skills: ${requirement.requiredSkills.join(', ') || 'none specified'}

Candidate employees:
${candidateLines}

Score each genuinely relevant candidate against the requirement. Reply with
ONLY a JSON object of this exact shape, no prose, no markdown code fences:
{"matches": [{"userId": "<one of the candidate ids above>", "matchScore": <0-100 integer>, "rationale": "<one sentence>"}], "summary": "<one sentence overview>"}

Only include candidates who are genuinely relevant — it is fine to return
fewer than all candidates, or none at all. Never invent a userId that is
not in the candidate list above.`;
  }

  private parseMatchReply(raw: string): {
    matches: { userId: string; matchScore: number; rationale: string }[];
    summary: string;
  } {
    const parsed = parseJsonReplyOrThrow<RawMatchReply>(
      raw,
      'job requirement matching',
    );

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !Array.isArray(parsed.matches)
    ) {
      throw new BadGatewayException(
        'AI provider returned an empty or malformed match result',
      );
    }

    const matches = (parsed.matches as RawMatchItem[])
      .filter(
        (item): item is Required<RawMatchItem> =>
          typeof item?.userId === 'string' &&
          typeof item?.matchScore === 'number' &&
          typeof item?.rationale === 'string',
      )
      .map((item) => ({
        userId: item.userId as string,
        matchScore: item.matchScore as number,
        rationale: item.rationale as string,
      }));

    const summary =
      typeof parsed.summary === 'string' && parsed.summary.trim().length > 0
        ? parsed.summary
        : '';

    return { matches, summary };
  }
}
