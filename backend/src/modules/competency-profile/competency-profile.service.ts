import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { assertCanViewUser } from '../../common/access/user-scope';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import {
  CreateCertificationDto,
  UpdateCertificationDto,
} from './dto/certification.dto';
import {
  CreateProjectExperienceDto,
  UpdateProjectExperienceDto,
} from './dto/project-experience.dto';
import { CreateAwardDto, UpdateAwardDto } from './dto/award.dto';

const EVIDENCE_EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
};

/** One entry on the merged profile timeline the frontend renders. */
export interface TimelineEntry {
  id: string;
  kind: 'EMPLOYMENT' | 'PROJECT' | 'CERTIFICATION' | 'AWARD' | 'ACTIVITY';
  title: string;
  subtitle: string | null;
  date: string;
  endDate: string | null;
  meta: Record<string, unknown>;
}

const optionalDate = (value?: string) =>
  value === undefined ? undefined : new Date(value);

@Injectable()
export class CompetencyProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // --- Certifications ------------------------------------------------------

  async listCertifications(caller: AuthenticatedUser, userId?: string) {
    const targetUserId = userId ?? caller.id;
    await assertCanViewUser(
      this.prisma,
      caller,
      targetUserId,
      'certifications',
    );
    return this.prisma.certification.findMany({
      where: { userId: targetUserId },
      orderBy: [{ issuedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  createCertification(dto: CreateCertificationDto, caller: AuthenticatedUser) {
    return this.prisma.certification.create({
      data: {
        userId: caller.id,
        name: dto.name,
        issuer: dto.issuer,
        type: dto.type,
        score: dto.score,
        issuedAt: optionalDate(dto.issuedAt),
        expiresAt: optionalDate(dto.expiresAt),
        credentialUrl: dto.credentialUrl,
      },
    });
  }

  /** Upload evidence file for a certification (image/PDF/Office). */
  async uploadCertificationEvidence(
    file: Express.Multer.File,
    caller: AuthenticatedUser,
  ) {
    const extension = EVIDENCE_EXTENSION_BY_MIME[file.mimetype];
    if (!extension) {
      throw new BadRequestException(
        'Evidence must be JPEG, PNG, WebP, GIF, PDF, DOC, DOCX, XLS or XLSX',
      );
    }

    const key = [
      'careermate',
      'certification-evidence',
      caller.id,
      `${randomUUID()}.${extension}`,
    ];
    const credentialUrl = await this.storage.writePublic(
      key,
      file.buffer,
      file.mimetype,
    );
    return { url: credentialUrl };
  }

  async updateCertification(
    id: string,
    dto: UpdateCertificationDto,
    caller: AuthenticatedUser,
  ) {
    const existing = await this.prisma.certification.findUnique({
      where: { id },
    });
    if (!existing || existing.userId !== caller.id) {
      throw new NotFoundException(`Certification ${id} not found`);
    }
    const updated = await this.prisma.certification.update({
      where: { id },
      data: {
        name: dto.name,
        issuer: dto.issuer,
        type: dto.type,
        score: dto.score,
        issuedAt: optionalDate(dto.issuedAt),
        expiresAt: optionalDate(dto.expiresAt),
        credentialUrl: dto.credentialUrl,
      },
    });

    if (
      dto.credentialUrl !== undefined &&
      existing.credentialUrl &&
      existing.credentialUrl !== updated.credentialUrl
    ) {
      void this.deleteOwnedEvidence(
        existing.credentialUrl,
        caller.id,
        'certification-evidence',
      );
    }

    return updated;
  }

  async removeCertification(id: string, caller: AuthenticatedUser) {
    const existing = await this.prisma.certification.findUnique({
      where: { id },
    });
    if (!existing || existing.userId !== caller.id) {
      throw new NotFoundException(`Certification ${id} not found`);
    }
    await this.prisma.certification.delete({ where: { id } });
    void this.deleteOwnedEvidence(
      existing.credentialUrl,
      caller.id,
      'certification-evidence',
    );
    return { id };
  }

  // --- Project experience --------------------------------------------------

  async listProjects(caller: AuthenticatedUser, userId?: string) {
    const targetUserId = userId ?? caller.id;
    await assertCanViewUser(
      this.prisma,
      caller,
      targetUserId,
      'project experience',
    );
    return this.prisma.projectExperience.findMany({
      where: { userId: targetUserId },
      orderBy: { startDate: 'desc' },
    });
  }

  createProject(dto: CreateProjectExperienceDto, caller: AuthenticatedUser) {
    return this.prisma.projectExperience.create({
      data: {
        userId: caller.id,
        companyId: caller.companyId ?? undefined,
        employmentId: dto.employmentId,
        name: dto.name,
        role: dto.role,
        domain: dto.domain,
        techStack: dto.techStack ?? [],
        contribution: dto.contribution,
        startDate: new Date(dto.startDate),
        endDate: optionalDate(dto.endDate),
      },
    });
  }

  async updateProject(
    id: string,
    dto: UpdateProjectExperienceDto,
    caller: AuthenticatedUser,
  ) {
    const existing = await this.prisma.projectExperience.findUnique({
      where: { id },
    });
    if (!existing || existing.userId !== caller.id) {
      throw new NotFoundException(`Project experience ${id} not found`);
    }
    return this.prisma.projectExperience.update({
      where: { id },
      data: {
        name: dto.name,
        role: dto.role,
        domain: dto.domain,
        techStack: dto.techStack,
        contribution: dto.contribution,
        startDate: optionalDate(dto.startDate),
        endDate: optionalDate(dto.endDate),
        employmentId: dto.employmentId,
      },
    });
  }

  async removeProject(id: string, caller: AuthenticatedUser) {
    const existing = await this.prisma.projectExperience.findUnique({
      where: { id },
    });
    if (!existing || existing.userId !== caller.id) {
      throw new NotFoundException(`Project experience ${id} not found`);
    }
    await this.prisma.projectExperience.delete({ where: { id } });
    return { id };
  }

  // --- Awards --------------------------------------------------------------

  async listAwards(caller: AuthenticatedUser, userId?: string) {
    const targetUserId = userId ?? caller.id;
    await assertCanViewUser(this.prisma, caller, targetUserId, 'awards');
    return this.prisma.award.findMany({
      where: { userId: targetUserId },
      orderBy: [{ awardedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async uploadEvidence(file: Express.Multer.File, caller: AuthenticatedUser) {
    const extension = EVIDENCE_EXTENSION_BY_MIME[file.mimetype];
    if (!extension) {
      throw new BadRequestException(
        'Evidence must be JPEG, PNG, WebP, GIF, PDF, DOC, DOCX, XLS or XLSX',
      );
    }

    const key = [
      'careermate',
      'award-evidence',
      caller.id,
      `${randomUUID()}.${extension}`,
    ];
    const evidenceUrl = await this.storage.writePublic(key, file.buffer, file.mimetype);
    return { url: evidenceUrl };
  }

  createAward(dto: CreateAwardDto, caller: AuthenticatedUser) {
    return this.prisma.award.create({
      data: {
        userId: caller.id,
        title: dto.title,
        issuer: dto.issuer,
        description: dto.description,
        evidenceUrl: dto.evidenceUrl,
        awardedAt: optionalDate(dto.awardedAt),
        selfReported: true,
      },
    });
  }

  async updateAward(
    id: string,
    dto: UpdateAwardDto,
    caller: AuthenticatedUser,
  ) {
    const existing = await this.prisma.award.findUnique({ where: { id } });
    if (!existing || existing.userId !== caller.id) {
      throw new NotFoundException(`Award ${id} not found`);
    }

    const updated = await this.prisma.award.update({
      where: { id },
      data: {
        title: dto.title,
        issuer: dto.issuer,
        description: dto.description,
        evidenceUrl: dto.evidenceUrl,
        awardedAt: optionalDate(dto.awardedAt),
      },
    });

    // Only delete old Spaces object when evidenceUrl actually changes.
    if (
      dto.evidenceUrl !== undefined &&
      existing.evidenceUrl &&
      existing.evidenceUrl !== updated.evidenceUrl
    ) {
      void this.deleteOwnedEvidence(existing.evidenceUrl, caller.id, 'award-evidence');
    }

    return updated;
  }

  async removeAward(id: string, caller: AuthenticatedUser) {
    const existing = await this.prisma.award.findUnique({ where: { id } });
    if (!existing || existing.userId !== caller.id) {
      throw new NotFoundException(`Award ${id} not found`);
    }
    await this.prisma.award.delete({ where: { id } });
    void this.deleteOwnedEvidence(existing.evidenceUrl, caller.id, 'award-evidence');
    return { id };
  }

  /** Deletes a Spaces evidence object only if it's actually ours (matches prefix/userId) — never touches externally-pasted URLs. */
  private deleteOwnedEvidence(
    url: string | null,
    userId: string,
    prefix: 'award-evidence' | 'certification-evidence',
  ) {
    const key = this.storage.keyFromPublicUrl(url);
    if (key?.startsWith(`careermate/${prefix}/${userId}/`)) {
      void this.storage.delete(key).catch(() => undefined);
    }
  }

  // --- Aggregate profile ---------------------------------------------------

  /**
   * Everything the profile screen needs in one call, plus a merged
   * chronological timeline — the "dựng hồ sơ năng lực theo timeline" part of
   * the idea doc.
   */
  async getProfile(caller: AuthenticatedUser, userId?: string) {
    const targetUserId = userId ?? caller.id;
    await assertCanViewUser(this.prisma, caller, targetUserId, 'profile');

    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        jobTitle: true,
        contributionScore: true,
        attitudeScore: true,
        avatarUrl: true,
        companyId: true,
        company: { select: { id: true, name: true } },
      },
    });
    if (!user) {
      throw new NotFoundException(`User ${targetUserId} not found`);
    }

    const [skills, certifications, projects, awards, employments, activities] =
      await Promise.all([
        this.prisma.employeeSkill.findMany({
          where: { userId: targetUserId },
          include: { skill: true },
          orderBy: { level: 'desc' },
        }),
        this.prisma.certification.findMany({
          where: { userId: targetUserId },
          orderBy: [{ issuedAt: 'desc' }, { createdAt: 'desc' }],
        }),
        this.prisma.projectExperience.findMany({
          where: { userId: targetUserId },
          orderBy: { startDate: 'desc' },
        }),
        this.prisma.award.findMany({
          where: { userId: targetUserId },
          orderBy: [{ awardedAt: 'desc' }, { createdAt: 'desc' }],
        }),
        this.prisma.employment.findMany({
          where: { userId: targetUserId },
          include: { company: { select: { id: true, name: true } } },
          orderBy: { startDate: 'desc' },
        }),
        this.prisma.activityLog.findMany({
          where: { userId: targetUserId },
          orderBy: { date: 'desc' },
          take: 20,
        }),
      ]);

    const timeline: TimelineEntry[] = [
      ...employments.map((e) => ({
        id: e.id,
        kind: 'EMPLOYMENT' as const,
        title: e.jobTitle,
        subtitle: e.company.name,
        date: e.startDate.toISOString(),
        endDate: e.endDate?.toISOString() ?? null,
        meta: { level: e.level, status: e.status, department: e.department },
      })),
      ...projects.map((p) => ({
        id: p.id,
        kind: 'PROJECT' as const,
        title: p.name,
        subtitle: p.role,
        date: p.startDate.toISOString(),
        endDate: p.endDate?.toISOString() ?? null,
        meta: {
          domain: p.domain,
          techStack: p.techStack,
          contribution: p.contribution,
        },
      })),
      ...certifications
        .filter((c) => c.issuedAt)
        .map((c) => ({
          id: c.id,
          kind: 'CERTIFICATION' as const,
          title: c.name,
          subtitle: c.issuer,
          date: c.issuedAt!.toISOString(),
          endDate: null,
          meta: { type: c.type, score: c.score },
        })),
      ...awards
        .filter((a) => a.awardedAt)
        .map((a) => ({
          id: a.id,
          kind: 'AWARD' as const,
          title: a.title,
          subtitle: a.issuer,
          date: a.awardedAt!.toISOString(),
          endDate: null,
          meta: { evidenceUrl: a.evidenceUrl },
        })),
      ...activities.map((a) => ({
        id: a.id,
        kind: 'ACTIVITY' as const,
        title: a.title,
        subtitle: a.category,
        date: a.date.toISOString(),
        endDate: null,
        meta: { description: a.description },
      })),
    ].sort((a, b) => b.date.localeCompare(a.date));

    return {
      user,
      skills,
      certifications,
      projects,
      awards,
      employments,
      timeline,
    };
  }
}
