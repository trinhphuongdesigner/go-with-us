import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
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
import { asArray, asString, parseJsonReplyOrThrow } from '../ai-chat/ai-reply.utils';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import {
  ApplyProfileImportDto,
  ApplyRichUpdatesDto,
  CreateProfileImportDto,
  RefineProposalDto,
  RichProfileProposal,
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
  private readonly logger = new Logger(ProfileImportsService.name);

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

    // jobTitle is display-only on import review — never apply from AI proposal.

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

  // --- Rich profile update skill (multi-source, full context, proposal + apply) ---

  /**
   * Gather a rich snapshot of the caller's current profile for AI context.
   * Reuses the aggregate query pattern from CompetencyProfileService.getProfile
   * plus goals, full activities, development plan + milestones, employments + summaries.
   */
  private async gatherFullSnapshot(caller: AuthenticatedUser) {
    const userId = caller.id;

    const [
      user,
      skills,
      certifications,
      projects,
      awards,
      employments,
      activities,
      goals,
      devPlan,
      milestones,
      careerSummaries,
    ] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          jobTitle: true,
          phone: true,
          dateOfBirth: true,
          gender: true,
        },
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
      this.prisma.projectExperience.findMany({
        where: { userId },
        orderBy: { startDate: 'desc' },
      }),
      this.prisma.award.findMany({
        where: { userId },
        orderBy: [{ awardedAt: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.employment.findMany({
        where: { userId },
        include: { company: { select: { id: true, name: true } } },
        orderBy: { startDate: 'desc' },
      }),
      this.prisma.activityLog.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
      }),
      this.prisma.developmentGoal.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.developmentPlan.findFirst({
        where: { userId },
      }),
      this.prisma.developmentMilestone.findMany({
        where: { roadmap: { plan: { userId } } },
        include: { tasks: true },
        orderBy: { order: 'asc' },
      }),
      this.prisma.careerSummary.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    if (!user) {
      throw new NotFoundException('User not found for snapshot');
    }

    return {
      user,
      skills,
      certifications,
      projects,
      awards,
      employments,
      activities,
      goals,
      devPlan,
      milestones,
      careerSummaries,
    };
  }

  /**
   * Extract readable text from a URL (LinkedIn, personal site, etc).
   * Strips HTML tags roughly; keeps main content.
   */
  private async extractFromUrl(url: string): Promise<string> {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'CareerMate/1.0' } });
      if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
      const html = await res.text();
      // Very rough strip: remove scripts/styles, keep text
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return text.slice(0, 30000); // bound size
    } catch (e) {
      return `[Could not fetch ${url}: ${(e as Error).message}]`;
    }
  }

  /**
   * Extract text from uploaded file buffer based on mime or name.
   * pdf-parse, mammoth, xlsx are already installed.
   */
  private async extractFromFile(buffer: Buffer, filename: string, mime?: string): Promise<string> {
    const lower = filename.toLowerCase();
    try {
      if (lower.endsWith('.pdf') || mime === 'application/pdf') {
        const pdfModule = await import('pdf-parse');
        const pdfParse = (pdfModule as any).default ?? pdfModule;
        const data = await pdfParse(buffer);
        return (data.text || '').slice(0, 30000);
      }
      if (lower.endsWith('.docx') || mime?.includes('word')) {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        return (result.value || '').slice(0, 30000);
      }
      if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || mime?.includes('spreadsheet')) {
        const XLSX = await import('xlsx');
        const wb = XLSX.read(buffer, { type: 'buffer' });
        let out = '';
        wb.SheetNames.forEach((name) => {
          const sheet = wb.Sheets[name];
          const csv = XLSX.utils.sheet_to_csv(sheet);
          out += `\n--- Sheet: ${name} ---\n${csv}`;
        });
        return out.slice(0, 30000);
      }
      if (lower.endsWith('.txt') || lower.endsWith('.md') || lower.endsWith('.markdown')) {
        return buffer.toString('utf8').slice(0, 30000);
      }
      // Fallback: try utf8
      return buffer.toString('utf8').slice(0, 15000);
    } catch (e) {
      return `[Could not parse ${filename}: ${(e as Error).message}]`;
    }
  }

  /**
   * Build the rich analysis prompt: send full current profile snapshot + new sources (as markdown).
   * AI must propose only deltas and respect dates for timeline.
   */
  private buildAnalysisPrompt(snapshot: any, sourcesMd: string): string {
    const s = snapshot;
    const userLine = `${s.user.name} — ${s.user.jobTitle ?? 'no title'} — ${s.user.email}`;
    const skills = s.skills.length
      ? s.skills.map((e: any) => `${e.skill.name} (lvl ${e.level}/5)${e.note ? ` — ${e.note}` : ''}`).join('; ')
      : 'none';
    const certs = s.certifications.length
      ? s.certifications.map((c: any) => `${c.name}${c.issuer ? ` @${c.issuer}` : ''}${c.issuedAt ? ` (${c.issuedAt.toISOString().slice(0, 7)})` : ''}`).join('; ')
      : 'none';
    const projs = s.projects.length
      ? s.projects.map((p: any) => `${p.name} as ${p.role}${p.startDate ? ` [${p.startDate.toISOString().slice(0, 7)}→${p.endDate?.toISOString().slice(0, 7) ?? 'now'}]` : ''}`).join('; ')
      : 'none';
    const awds = s.awards.length
      ? s.awards.map((a: any) => `${a.title}${a.awardedAt ? ` (${a.awardedAt.toISOString().slice(0, 7)})` : ''}`).join('; ')
      : 'none';
    const acts = s.activities.length
      ? s.activities.map((a: any) => `${a.title} @${a.date.toISOString().slice(0, 10)}${a.category ? ` [${a.category}]` : ''}`).join('; ')
      : 'none';
    const gls = s.goals.length
      ? s.goals.map((g: any) => `${g.title} [${g.category}, ${g.status}]${g.dueDate ? ` due ${g.dueDate.toISOString().slice(0, 10)}` : ''}`).join('; ')
      : 'none';
    const plan = s.devPlan ? (s.devPlan.content || '').slice(0, 2000) : 'none';
    const mstones = s.milestones.length
      ? s.milestones.map((m: any) => `${m.title}${m.dueDate ? ` (${m.dueDate.toISOString().slice(0, 10)})` : ''}`).join('; ')
      : 'none';
    const jobs = s.employments.length
      ? s.employments.map((e: any) => `${e.jobTitle} @${e.company?.name} [${e.startDate.toISOString().slice(0, 7)}→${e.endDate?.toISOString().slice(0, 7) ?? 'now'}]`).join('; ')
      : 'none';

    return `You are CareerMate's profile enrichment analyst.
You receive the user's CURRENT structured profile snapshot plus NEW source material (CVs, LinkedIn, pasted notes, etc. already converted to markdown/text).

CURRENT SNAPSHOT:
User: ${userLine}
Skills: ${skills}
Certifications: ${certs}
Projects: ${projs}
Awards: ${awds}
Activities: ${acts}
Goals: ${gls}
Development Plan (markdown, truncated): ${plan}
Milestones: ${mstones}
Employments: ${jobs}

NEW SOURCES (markdown/text):
${sourcesMd}

Task: Propose ONLY updates/deltas that add value or correct data. Skip anything that is clearly already present (same name + similar date/level). Use dates when available so items can appear on the user's timeline.

LANGUAGE: This product is used by Vietnamese users. Write every free-text value you generate — "summary", "dedupNotes", and any "description"/"note"/"contribution" field — in Vietnamese, regardless of what language the source material is in. Keep proper nouns, company names, project names, technology/tool names (e.g. React, NestJS, TypeScript) and people's names unchanged — do not translate those.

Reply with ONLY a JSON object of this exact shape, no prose, no markdown code fences:
{
  "identityCheck": { "detectedSourceName": "<the person's name as it appears in the NEW SOURCES, or empty string if no name is mentioned>", "matches": true|false },
  "basicInfo": { "name": "...", "jobTitle": "...", "phone": "...", "summary": "..." },
  "skills": [ { "name": "...", "level": 1-5, "note": "..." } ],
  "projects": [ { "name": "...", "role": "...", "domain": "...", "techStack": ["..."], "contribution": "...", "startDate": "YYYY-MM or YYYY-MM-DD", "endDate": "..." } ],
  "certifications": [ { "name": "...", "issuer": "...", "type": "DEGREE|LANGUAGE|PROFESSIONAL|OTHER", "score": "...", "issuedAt": "YYYY or YYYY-MM or YYYY-MM-DD" } ],
  "awards": [ { "title": "...", "issuer": "...", "description": "...", "category": "WORK|PERSONAL", "awardedAt": "YYYY or YYYY-MM or YYYY-MM-DD" } ],
  "activities": [ { "title": "...", "description": "...", "category": "...", "date": "YYYY-MM-DD" } ],
  "goals": [ { "title": "...", "description": "...", "category": "WORK|PERSONAL", "dueDate": "YYYY-MM-DD", "metric": "..." } ],
  "roadmap": { "milestones": [ { "title": "...", "description": "...", "dueDate": "YYYY-MM-DD", "tasks": [ { "title": "...", "metric": "..." } ] } ] },
  "summary": "one sentence about what changed",
  "dedupNotes": "brief note on what was skipped as duplicate"
}

Rules:
- Never invent skills, projects, or achievements not supported by the new sources.
- Prefer concrete dates. If a source mentions "graduated 2021", use "2021-01-01" or "2021".
- Activities and dated items are high value for timeline.
- If nothing new, return mostly empty arrays + a clear summary (in Vietnamese).
- Keep strings short and factual.
- SKILLS: List EVERY distinct technology/framework/language/tool mentioned as its own separate skill entry — never merge multiple techs into one item and never drop the frontend stack. Example: "BE code nestjs + mysql, fe dùng vuejs" must yield 3 skills: NestJS, MySQL, VueJS (plus a Fullstack skill if that role is stated).
- PROJECT DOMAIN (Lĩnh vực): every project you propose MUST have a non-empty "domain" — a short Vietnamese industry/field label (e.g. "Công nghệ thông tin", "Phát triển phần mềm"). Infer it from context (fullstack/web/mobile dev → "Công nghệ thông tin") when the source doesn't state one explicitly; never leave it blank.
- basicInfo.name/jobTitle: only fill these when the NEW SOURCES actually restate the person's name or title — do not guess or copy them from the CURRENT SNAPSHOT just to fill the field.
- IDENTITY: Always fully read and analyze every source and populate the COMPLETE proposal (skills/projects/certifications/awards/activities/goals/roadmap), regardless of whether the name in the source matches "${s.user.name}". Never use a perceived name difference as a reason to skip, omit, or hedge on any item, and never mention "name mismatch" inside "summary" or "dedupNotes" — the only valid reason to skip an item there is that it already exists in the CURRENT SNAPSHOT above.
- Set "identityCheck.detectedSourceName" to the person's name exactly as it appears in the NEW SOURCES (empty string if none is mentioned). Set "identityCheck.matches" to false if that name clearly refers to a different person than "${s.user.name}" (not just a spelling/nickname variant), otherwise true. This field is for the UI to ask the user for confirmation — it must NOT influence which items you include in the proposal above.`;
  }

  /**
   * AI analysis entry point. Accepts raw texts + already-extracted source markdown.
   * Returns a RichProfileProposal (proposal only — nothing persisted).
   */
  async analyzeSources(
    payload: { urls?: string[]; pastedTexts?: string[]; fileTexts?: string[] },
    caller: AuthenticatedUser,
  ): Promise<RichProfileProposal> {
    const snapshot = await this.gatherFullSnapshot(caller);

    // Gather source texts
    const urlTexts: string[] = [];
    for (const u of payload.urls ?? []) {
      const t = await this.extractFromUrl(u);
      urlTexts.push(`\n--- URL: ${u} ---\n${t}`);
    }
    const pasted = (payload.pastedTexts ?? []).map((t, i) => `\n--- Pasted text #${i + 1} ---\n${t}`);
    const files = (payload.fileTexts ?? []).map((t, i) => `\n--- File text #${i + 1} ---\n${t}`);

    const sourcesMd = [...urlTexts, ...pasted, ...files].join('\n').slice(0, 60000);
    if (sourcesMd.trim().length < 30) {
      throw new BadRequestException('Not enough source content to analyze');
    }

    const systemPrompt = this.buildAnalysisPrompt(snapshot, sourcesMd);

    this.logger.log(
      `analyzeSources: sourcesMdLen=${sourcesMd.length} sysPromptLen=${systemPrompt.length} ` +
      `sourcesPrefix=${sourcesMd.slice(0, 400)} sysHead=${systemPrompt.slice(0, 800)}`,
    );

    const { content } = await this.aiChatService.send({
      systemPrompt,
      messages: [
        {
          role: 'user',
          content: 'Output exactly one JSON object matching the required shape and nothing else. No explanations, no fences.',
        },
      ],
    });

    return this.parseRichProposal(content);
  }

  /**
   * Refine an existing proposal via chat instruction. Re-sends snapshot + prior proposal + instruction.
   */
  async refineProposal(
    dto: RefineProposalDto,
    caller: AuthenticatedUser,
  ): Promise<RichProfileProposal> {
    const snapshot = await this.gatherFullSnapshot(caller);
    const prior = JSON.stringify(dto.proposal ?? {}, null, 2);

    const systemPrompt = `You are refining a previous profile update proposal for ${snapshot.user.name}.

CURRENT SNAPSHOT (same format as before):
${JSON.stringify(
  {
    skills: snapshot.skills.map((s: any) => s.skill.name + '/' + s.level),
    certs: snapshot.certifications.map((c: any) => c.name),
    projects: snapshot.projects.map((p: any) => p.name),
    activities: snapshot.activities.map((a: any) => a.title),
    goals: snapshot.goals.map((g: any) => g.title),
  },
  null,
  2,
)}

PREVIOUS PROPOSAL:
${prior}

USER INSTRUCTION:
${dto.instruction}

Reply with ONLY the updated full JSON proposal object (same shape as before). Apply the instruction, keep good items, remove or fix as asked. Do not add prose.
LANGUAGE: Write every free-text value ("summary", "dedupNotes", "description", "note", "contribution") in Vietnamese, regardless of the source language. Keep proper nouns, company/project names, tech names and people's names unchanged.
IDENTITY: The person who submitted the original sources IS ${snapshot.user.name} — never skip or remove an item because a name in the source text looks different from "${snapshot.user.name}"; that is not a valid reason.`;

    const { content } = await this.aiChatService.send({
      systemPrompt,
      messages: [{ role: 'user', content: 'Output exactly one JSON object matching the required shape and nothing else. No explanations, no fences.' }],
    });

    return this.parseRichProposal(content);
  }

  /**
   * Defensive parser for the rich proposal shape. Re-uses the same fence-strip + filter discipline.
   */
  private parseRichProposal(raw: string): RichProfileProposal {
    const parsed = parseJsonReplyOrThrow<any>(raw, 'rich profile proposal');
    if (!parsed || typeof parsed !== 'object') {
      throw new BadGatewayException('AI returned empty rich profile proposal');
    }

    const proposal: RichProfileProposal = {
      identityCheck: parsed.identityCheck
        ? {
            detectedSourceName: asString(parsed.identityCheck.detectedSourceName),
            matches: parsed.identityCheck.matches !== false,
          }
        : undefined,
      basicInfo: parsed.basicInfo
        ? {
            name: asString(parsed.basicInfo.name),
            jobTitle: asString(parsed.basicInfo.jobTitle),
            phone: asString(parsed.basicInfo.phone),
            summary: asString(parsed.basicInfo.summary),
          }
        : undefined,
      skills: asArray(parsed.skills)
        .map((s: any) => ({
          name: asString(s.name) ?? '',
          level: typeof s.level === 'number' ? Math.max(1, Math.min(5, Math.round(s.level))) : undefined,
          note: asString(s.note),
        }))
        .filter((s: any) => s.name),
      projects: asArray(parsed.projects)
        .map((p: any) => ({
          name: asString(p.name) ?? '',
          role: asString(p.role) ?? 'Member',
          domain: asString(p.domain),
          techStack: Array.isArray(p.techStack) ? p.techStack.filter((t: any) => typeof t === 'string') : [],
          contribution: asString(p.contribution),
          startDate: asString(p.startDate),
          endDate: asString(p.endDate),
        }))
        .filter((p: any) => p.name),
      certifications: asArray(parsed.certifications)
        .map((c: any) => ({
          name: asString(c.name) ?? '',
          issuer: asString(c.issuer),
          type: asString(c.type),
          score: asString(c.score),
          issuedAt: asString(c.issuedAt),
        }))
        .filter((c: any) => c.name),
      awards: asArray(parsed.awards)
        .map((a: any) => ({
          title: asString(a.title) ?? '',
          issuer: asString(a.issuer),
          description: asString(a.description),
          category: a.category === 'PERSONAL' ? 'PERSONAL' : 'WORK',
          awardedAt: asString(a.awardedAt),
        }))
        .filter((a: any) => a.title),
      activities: asArray(parsed.activities)
        .map((a: any) => ({
          title: asString(a.title) ?? '',
          description: asString(a.description),
          category: asString(a.category),
          date: asString(a.date) ?? '',
        }))
        .filter((a: any) => a.title && a.date),
      goals: asArray(parsed.goals)
        .map((g: any) => ({
          title: asString(g.title) ?? '',
          description: asString(g.description),
          category: (g.category === 'PERSONAL' ? 'PERSONAL' : g.category === 'WORK' ? 'WORK' : undefined) as 'WORK' | 'PERSONAL' | undefined,
          dueDate: asString(g.dueDate),
          metric: asString(g.metric),
        }))
        .filter((g: any) => g.title),
      roadmap: parsed.roadmap && Array.isArray(parsed.roadmap.milestones)
        ? {
            milestones: parsed.roadmap.milestones
              .map((m: any) => ({
                title: asString(m.title) ?? '',
                description: asString(m.description),
                dueDate: asString(m.dueDate),
                tasks: Array.isArray(m.tasks)
                  ? m.tasks
                      .map((t: any) => ({
                        title: asString(t.title) ?? '',
                        metric: asString(t.metric),
                      }))
                      .filter((t: any) => t.title)
                  : [],
              }))
              .filter((m: any) => m.title),
          }
        : undefined,
      summary: asString(parsed.summary) ?? 'AI đã phân tích các nguồn dữ liệu dựa trên hồ sơ hiện tại của bạn.',
      dedupNotes: asString(parsed.dedupNotes),
    };

    return proposal;
  }

  /**
   * Explicit apply for the rich proposal.
   * Routes each section to the correct domain service/table.
   * Dupe guard: simple name+date or name+level exact skip on insert paths.
   */
  async applyRichUpdates(dto: ApplyRichUpdatesDto, caller: AuthenticatedUser) {
    const counts = {
      basic: 0,
      skills: 0,
      projects: 0,
      certifications: 0,
      awards: 0,
      activities: 0,
      goals: 0,
      roadmapMilestones: 0,
    };

    // Basic info: name + jobTitle are display-only (đối chiếu), never applied.
    if (dto.basicInfo) {
      const patch: { phone?: string } = {};
      if (dto.basicInfo.phone) patch.phone = dto.basicInfo.phone.trim();
      if (Object.keys(patch).length) {
        await this.prisma.user.update({ where: { id: caller.id }, data: patch });
        counts.basic = 1;
      }
    }

    // Skills (upsert by name, skip exact level dupes)
    for (const sk of dto.skills ?? []) {
      const name = sk.name.trim();
      if (!name) continue;
      const catalog =
        (await this.prisma.skill.findUnique({ where: { name } })) ??
        (await this.prisma.skill.create({ data: { name } }));
      const existing = await this.prisma.employeeSkill.findUnique({
        where: { userId_skillId: { userId: caller.id, skillId: catalog.id } },
      });
      if (existing && existing.level === (sk.level ?? 3)) continue;
      await this.prisma.employeeSkill.upsert({
        where: { userId_skillId: { userId: caller.id, skillId: catalog.id } },
        update: { level: sk.level ?? 3, note: sk.note ?? null, selfAssessed: true },
        create: {
          userId: caller.id,
          skillId: catalog.id,
          level: sk.level ?? 3,
          note: sk.note ?? null,
          selfAssessed: true,
        },
      });
      counts.skills += 1;
    }

    // Projects (simple create; historical pre-company allowed)
    for (const p of dto.projects ?? []) {
      await this.prisma.projectExperience.create({
        data: {
          userId: caller.id,
          companyId: caller.companyId ?? undefined,
          name: p.name,
          role: p.role,
          domain: p.domain,
          techStack: p.techStack ?? [],
          contribution: p.contribution,
          startDate: parseLooseDate(p.startDate) ?? new Date(),
          endDate: parseLooseDate(p.endDate),
        },
      });
      counts.projects += 1;
    }

    // Certifications
    for (const c of dto.certifications ?? []) {
      await this.prisma.certification.create({
        data: {
          userId: caller.id,
          name: c.name,
          issuer: c.issuer,
          type: c.type && CERTIFICATION_TYPES.has(c.type) ? (c.type as CertificationType) : CertificationType.PROFESSIONAL,
          score: c.score,
          issuedAt: parseLooseDate(c.issuedAt),
        },
      });
      counts.certifications += 1;
    }

    // Awards
    for (const a of dto.awards ?? []) {
      await this.prisma.award.create({
        data: {
          userId: caller.id,
          title: a.title,
          category: a.category === 'PERSONAL' ? LifeCategory.PERSONAL : LifeCategory.WORK,
          issuer: a.issuer,
          description: a.description,
          awardedAt: parseLooseDate(a.awardedAt),
          selfReported: true,
        },
      });
      counts.awards += 1;
    }

    // Activities
    for (const act of dto.activities ?? []) {
      await this.prisma.activityLog.create({
        data: {
          userId: caller.id,
          title: act.title,
          description: act.description,
          category: act.category,
          date: new Date(act.date),
        },
      });
      counts.activities += 1;
    }

    // Goals
    for (const g of dto.goals ?? []) {
      await this.prisma.developmentGoal.create({
        data: {
          userId: caller.id,
          title: g.title,
          description: g.description,
          category: g.category === 'PERSONAL' ? LifeCategory.PERSONAL : LifeCategory.WORK,
          dueDate: parseLooseDate(g.dueDate),
          metric: g.metric,
        },
      });
      counts.goals += 1;
    }

    // Roadmap (create a new attempt instead of replacing existing history)
    if (dto.roadmap && dto.roadmap.milestones?.length) {
      const plan = await this.prisma.developmentPlan.findFirst({ where: { userId: caller.id } });
      const planId = plan
        ? plan.id
        : (await this.prisma.developmentPlan.create({ data: { userId: caller.id, content: '' } })).id;

      await this.prisma.developmentRoadmap.create({
        data: {
          planId,
          category: LifeCategory.WORK,
          milestones: {
            create: dto.roadmap.milestones.map((m, i) => ({
              title: m.title,
              description: m.description,
              dueDate: parseLooseDate(m.dueDate),
              order: i,
              tasks: m.tasks?.length
                ? {
                    create: m.tasks.map((t, ti) => ({
                      title: t.title,
                      metric: t.metric,
                      order: ti,
                    })),
                  }
                : undefined,
            })),
          },
        },
      });
      counts.roadmapMilestones += dto.roadmap.milestones.length;
    }

    return counts;
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
- category PERSONAL is for non-work achievements (sport, volunteering, personal contests); everything job-related is WORK.
- LANGUAGE: Write "summary" and any free-text description in Vietnamese, regardless of the source language. Keep proper nouns, company/project names, tech names and people's names unchanged.`;
  }

  private parseReply(raw: string): ParsedProfile {
    const parsed = parseJsonReplyOrThrow<Record<string, unknown>>(
      raw,
      'profile import result',
    );

    if (!parsed || typeof parsed !== 'object') {
      throw new BadGatewayException(
        'AI provider returned an empty or malformed profile import result',
      );
    }

    const profileRaw = (parsed.profile ?? {}) as Record<string, unknown>;

    const result: ParsedProfile = {
      profile: {
        name: asString(profileRaw.name),
        jobTitle: asString(profileRaw.jobTitle),
        summary: asString(profileRaw.summary),
      },
      skills: asArray(parsed.skills)
        .map((s: any) => ({
          name: asString(s.name) ?? '',
          level:
            typeof s.level === 'number' && s.level >= 1 && s.level <= 5
              ? Math.round(s.level)
              : 3,
        }))
        .filter((s) => s.name.length > 0),
      certifications: asArray(parsed.certifications)
        .map((c: any) => ({
          name: asString(c.name) ?? '',
          issuer: asString(c.issuer),
          type: asString(c.type),
          score: asString(c.score),
          issuedAt: asString(c.issuedAt),
        }))
        .filter((c) => c.name.length > 0),
      projects: asArray(parsed.projects)
        .map((p: any) => ({
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
        .map((a: any) => ({
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
