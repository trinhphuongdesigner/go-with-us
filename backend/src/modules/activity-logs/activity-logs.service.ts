import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateActivityLogDto } from './dto/create-activity-log.dto';
import { UpdateActivityLogDto } from './dto/update-activity-log.dto';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { assertCanViewUser } from '../../common/access/user-scope';

@Injectable()
export class ActivityLogsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Defaults to the caller's own activity log when no userId is given.
   * Viewing someone else's log is gated by the account-management hierarchy
   * (role-hierarchy.ts) via the shared assertCanViewUser helper — HR/BOD can
   * view an EMPLOYEE's log, SUPER_ADMIN can view anyone's.
   */
  async findAll(caller: AuthenticatedUser, userId?: string) {
    const targetUserId = userId ?? caller.id;
    await assertCanViewUser(
      this.prisma,
      caller,
      targetUserId,
      'activity log',
    );

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
        date: new Date(dto.date),
      },
    });
  }

  async update(
    id: string,
    dto: UpdateActivityLogDto,
    caller: AuthenticatedUser,
  ) {
    const existing = await this.findOwned(id, caller);

    return this.prisma.activityLog.update({
      where: { id: existing.id },
      data: {
        title: dto.title,
        description: dto.description,
        category: dto.category,
        date: dto.date ? new Date(dto.date) : undefined,
      },
    });
  }

  async remove(id: string, caller: AuthenticatedUser) {
    const existing = await this.findOwned(id, caller);
    await this.prisma.activityLog.delete({ where: { id: existing.id } });
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
}
