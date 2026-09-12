import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { CreateActivityLogDto } from './dto/create-activity-log.dto';
import { UpdateActivityLogDto } from './dto/update-activity-log.dto';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { assertCanViewUser } from '../../common/access/user-scope';

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
const EVIDENCE_PREFIX = 'careermate/activity-evidence';

@Injectable()
export class ActivityLogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Defaults to the caller's own activity log when no userId is given.
   * Viewing someone else's log is gated by the account-management hierarchy
   * (role-hierarchy.ts) via the shared assertCanViewUser helper — HR/BOD can
   * view an EMPLOYEE's log, SUPER_ADMIN can view anyone's.
   */
  async findAll(caller: AuthenticatedUser, userId?: string) {
    const targetUserId = userId ?? caller.id;
    await assertCanViewUser(this.prisma, caller, targetUserId, 'activity log');

    return this.prisma.activityLog.findMany({
      where: { userId: targetUserId },
      orderBy: { date: 'desc' },
    });
  }

  create(dto: CreateActivityLogDto, caller: AuthenticatedUser) {
    return this.prisma.activityLog.create({
      data: {
        userId: caller.id,
        title: dto.title,
        description: dto.description,
        category: dto.category,
        evidenceUrl: dto.evidenceUrl,
        date: new Date(dto.date),
      },
    });
  }

  /** Upload evidence file (image/PDF/Office) for an activity log entry. */
  uploadEvidence(file: Express.Multer.File, caller: AuthenticatedUser) {
    const extension = EVIDENCE_EXTENSION_BY_MIME[file.mimetype];
    if (!extension) {
      throw new BadRequestException(
        'Evidence must be JPEG, PNG, WebP, GIF, PDF, DOC, DOCX, XLS or XLSX',
      );
    }

    const key = [
      ...EVIDENCE_PREFIX.split('/'),
      caller.id,
      `${randomUUID()}.${extension}`,
    ];
    return this.storage
      .writePublic(key, file.buffer, file.mimetype)
      .then((url) => ({ url }));
  }

  async update(
    id: string,
    dto: UpdateActivityLogDto,
    caller: AuthenticatedUser,
  ) {
    const existing = await this.findOwned(id, caller);

    const updated = await this.prisma.activityLog.update({
      where: { id: existing.id },
      data: {
        title: dto.title,
        description: dto.description,
        category: dto.category,
        evidenceUrl: dto.evidenceUrl,
        date: dto.date ? new Date(dto.date) : undefined,
      },
    });

    if (
      dto.evidenceUrl !== undefined &&
      existing.evidenceUrl &&
      existing.evidenceUrl !== updated.evidenceUrl
    ) {
      this.deleteOwnedEvidence(existing.evidenceUrl, caller.id);
    }

    return updated;
  }

  async remove(id: string, caller: AuthenticatedUser) {
    const existing = await this.findOwned(id, caller);
    await this.prisma.activityLog.delete({ where: { id: existing.id } });
    this.deleteOwnedEvidence(existing.evidenceUrl, caller.id);
    return { id: existing.id };
  }

  /** Owner-only lookup shared by update/remove — 404s regardless of why. */
  private async findOwned(id: string, caller: AuthenticatedUser) {
    const entry = await this.prisma.activityLog.findUnique({ where: { id } });
    if (!entry || entry.userId !== caller.id) {
      throw new NotFoundException(`Activity log ${id} not found`);
    }
    return entry;
  }

  private deleteOwnedEvidence(url: string | null, userId: string) {
    const key = this.storage.keyFromPublicUrl(url);
    if (key?.startsWith(`${EVIDENCE_PREFIX}/${userId}/`)) {
      void this.storage.delete(key).catch(() => undefined);
    }
  }
}
