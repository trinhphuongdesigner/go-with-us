import {
  BadGatewayException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CertificationType,
  ImportStatus,
  LifeCategory,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AiChatService } from '../ai-chat/ai-chat.service';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import {
  ApplyProfileImportDto,
  CreateProfileImportDto,
} from './dto/profile-import.dto';

/** Shape the AI is asked to return — every field optional/defensive. */
export interface ParsedProfile {
  profile: { name?: string; jobTitle?: string; summary?: string };
  skills: { name: string; level: number }[];
  certifications: {
    name: string;
    issuer?: string;
    type?: string;
    score?: string;
    issuedAt?: string;
  }[];
  projects: {
    name: string;
    role: string;
    domain?: string;
    techStack?: string[];
    contribution?: string;
    startDate?: string;
    endDate?: string;
  }[];
  awards: {
    title: string;
    category?: string;
    issuer?: string;
    description?: string;
    awardedAt?: string;
  }[];
  summary: string;
}

const CERTIFICATION_TYPES = new Set<string>(Object.values(CertificationType));

/** Tolerates "2021", "2021-06" and full ISO strings alike. */
function parseLooseDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  const normalised = /^\d{4}$/.test(trimmed)
    ? `${trimmed}-01-01`
    : /^\d{4}-\d{2}$/.test(trimmed)
      ? `${trimmed}-01`
      : trimmed;
  const date = new Date(normalised);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

@Injectable()
export class ProfileImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiChatService: AiChatService,
  ) {}

  list(caller: AuthenticatedUser) {
    return this.prisma.profileImport.findMany({
      where: { userId: caller.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, caller: AuthenticatedUser) {
    const item = await this.prisma.profileImport.findUnique({ where: { id } });
    if (!item || item.userId !== caller.id) {
      throw new NotFoundException(`Profile import ${id} not found`);
    }
    return item;
  }

  create(dto: CreateProfileImportDto, caller: AuthenticatedUser) {
    return this.prisma.profileImport.create({
      data: {
        userId: caller.id,
        sourceType: dto.sourceType,
        sourceName: dto.sourceName,
        rawText: dto.rawText,
        status: ImportStatus.PENDING,
      },
    });
  }

  /**
   * The AI skill: read the raw CV text, hand back structured profile data as
   * a PROPOSAL. Nothing touches the actual profile here — parsedData is
   * staged on the import row and only `apply()` writes to the profile, per
   * the project's proposal/explicit-save convention.
   */
  async parse(id: string, caller: AuthenticatedUser) {
    const item = await this.findOne(id, caller);

    let parsed: ParsedProfile;
    try {
      const { content } = await this.aiChatService.send({
        systemPrompt: this.buildParsePrompt(),
        messages: [
          {
            role: 'user',
            content: `Extract the structured profile from this CV / profile text:\n\n${item.rawText}`,
          },
        ],
      });
      parsed = this.parseReply(content);
    } catch (err) {
      await this.prisma.profileImport.update({
        where: { id: item.id },
        data: {
          status: ImportStatus.FAILED,
          error: err instanceof Error ? err.message : 'AI parsing failed',
        },
      });
      throw err;
    }

    return this.prisma.profileImport.update({
      where: { id: item.id },
      data: {
        status: ImportStatus.PARSED,
        error: null,
        parsedData: parsed as unknown as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Explicit save step — writes only what the user kept (they can edit the
   * proposal first, so the payload comes back from the client rather than
   * being read out of parsedData).
   */
  async apply(
    id: string,
    dto: ApplyProfileImportDto,
    caller: AuthenticatedUser,
  ) {
    const item = await this.findOne(id, caller);

    const applied = {
      skills: 0,
      certifications: 0,
      projects: 0,
      awards: 0,
    };

    if (dto.jobTitle) {
      await this.prisma.user.update({
        where: { id: caller.id },
        data: { jobTitle: dto.jobTitle },
      });
    }

    for (const skill of dto.skills ?? []) {
      const name = skill.name.trim();
      if (!name) continue;
      // Same upsert-by-name behaviour as SkillsCompetencyService.upsertSkill.
      const catalogSkill =
        (await this.prisma.skill.findUnique({ where: { name } })) ??
        (await this.prisma.skill.create({ data: { name } }));
      await this.prisma.employeeSkill.upsert({
        where: {
          userId_skillId: { userId: caller.id, skillId: catalogSkill.id },
        },
        update: { level: skill.level ?? 3, selfAssessed: true },
        create: {
          userId: caller.id,
          skillId: catalogSkill.id,
          level: skill.level ?? 3,
          selfAssessed: true,
          note: 'Imported from CV',
        },
      });
      applied.skills += 1;
    }

    for (const cert of dto.certifications ?? []) {
      await this.prisma.certification.create({
        data: {
          userId: caller.id,
          name: cert.name,
          issuer: cert.issuer,
          type:
            cert.type && CERTIFICATION_TYPES.has(cert.type)
              ? (cert.type as CertificationType)
              : CertificationType.PROFESSIONAL,
          score: cert.score,
          issuedAt: parseLooseDate(cert.issuedAt),
        },
      });
      applied.certifications += 1;
    }

    for (const project of dto.projects ?? []) {
      await this.prisma.projectExperience.create({
        data: {
          userId: caller.id,
          companyId: caller.companyId ?? undefined,
          name: project.name,
          role: project.role,
          domain: project.domain,
          techStack: project.techStack ?? [],
          contribution: project.contribution,
          startDate: parseLooseDate(project.startDate) ?? new Date(),
          endDate: parseLooseDate(project.endDate),
        },
      });
      applied.projects += 1;
    }

    for (const award of dto.awards ?? []) {
      await this.prisma.award.create({
        data: {
          userId: caller.id,
          title: award.title,
          category:
            award.category === 'PERSONAL'
              ? LifeCategory.PERSONAL
              : LifeCategory.WORK,
          issuer: award.issuer,
          description: award.description,
          awardedAt: parseLooseDate(award.awardedAt),
          selfReported: true,
        },
      });
      applied.awards += 1;
    }

    const updated = await this.prisma.profileImport.update({
      where: { id: item.id },
      data: { status: ImportStatus.APPLIED, appliedAt: new Date() },
    });

    return { import: updated, applied };
  }

  async remove(id: string, caller: AuthenticatedUser) {
    const item = await this.findOne(id, caller);
    await this.prisma.profileImport.delete({ where: { id: item.id } });
    return { id: item.id };
  }

  private buildParsePrompt(): string {
    return `You extract structured HR profile data from a CV or LinkedIn profile text.

Reply with ONLY a JSON object of this exact shape, no prose, no markdown code fences:
{
  "profile": {"name": "<full name or empty>", "jobTitle": "<current title or empty>", "summary": "<2 sentence professional summary>"},
  "skills": [{"name": "<skill name>", "level": <1-5 integer estimated from the text>}],
  "certifications": [{"name": "<name>", "issuer": "<issuer or empty>", "type": "DEGREE|LANGUAGE|PROFESSIONAL|OTHER", "score": "<e.g. IELTS 7.0, or empty>", "issuedAt": "<YYYY or YYYY-MM or empty>"}],
  "projects": [{"name": "<project>", "role": "<role held>", "domain": "<business domain or empty>", "techStack": ["<tech>"], "contribution": "<one sentence on the contribution/result>", "startDate": "<YYYY-MM or empty>", "endDate": "<YYYY-MM or empty>"}],
  "awards": [{"title": "<award or competition>", "category": "WORK|PERSONAL", "issuer": "<issuer or empty>", "description": "<one sentence>", "awardedAt": "<YYYY or empty>"}],
  "summary": "<one sentence describing what was extracted>"
}

Rules:
- Only extract what the text actually supports. Never invent a skill, employer, certificate or award that is not mentioned.
- Use an empty array when a section is absent.
- category PERSONAL is for non-work achievements (sport, volunteering, personal contests); everything job-related is WORK.`;
  }

  private parseReply(raw: string): ParsedProfile {
    let text = raw.trim();
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch) {
      text = fenceMatch[1].trim();
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new BadGatewayException(
        'AI provider returned an unparseable profile import result',
      );
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new BadGatewayException(
        'AI provider returned an empty or malformed profile import result',
      );
    }

    const asArray = (value: unknown): Record<string, unknown>[] =>
      Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
    const asString = (value: unknown): string | undefined =>
      typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : undefined;

    const profileRaw = (parsed.profile ?? {}) as Record<string, unknown>;

    const result: ParsedProfile = {
      profile: {
        name: asString(profileRaw.name),
        jobTitle: asString(profileRaw.jobTitle),
        summary: asString(profileRaw.summary),
      },
      skills: asArray(parsed.skills)
        .map((s) => ({
          name: asString(s.name) ?? '',
          level:
            typeof s.level === 'number' && s.level >= 1 && s.level <= 5
              ? Math.round(s.level)
              : 3,
        }))
        .filter((s) => s.name.length > 0),
      certifications: asArray(parsed.certifications)
        .map((c) => ({
          name: asString(c.name) ?? '',
          issuer: asString(c.issuer),
          type: asString(c.type),
          score: asString(c.score),
          issuedAt: asString(c.issuedAt),
        }))
        .filter((c) => c.name.length > 0),
      projects: asArray(parsed.projects)
        .map((p) => ({
          name: asString(p.name) ?? '',
          role: asString(p.role) ?? 'Member',
          domain: asString(p.domain),
          techStack: Array.isArray(p.techStack)
            ? (p.techStack as unknown[]).filter(
                (t): t is string => typeof t === 'string',
              )
            : [],
          contribution: asString(p.contribution),
          startDate: asString(p.startDate),
          endDate: asString(p.endDate),
        }))
        .filter((p) => p.name.length > 0),
      awards: asArray(parsed.awards)
        .map((a) => ({
          title: asString(a.title) ?? '',
          category: a.category === 'PERSONAL' ? 'PERSONAL' : 'WORK',
          issuer: asString(a.issuer),
          description: asString(a.description),
          awardedAt: asString(a.awardedAt),
        }))
        .filter((a) => a.title.length > 0),
      summary: asString(parsed.summary) ?? '',
    };

    const nothingFound =
      result.skills.length === 0 &&
      result.certifications.length === 0 &&
      result.projects.length === 0 &&
      result.awards.length === 0 &&
      !result.profile.jobTitle;

    if (nothingFound) {
      throw new BadGatewayException(
        'AI provider found nothing usable in this document',
      );
    }

    return result;
  }
}
