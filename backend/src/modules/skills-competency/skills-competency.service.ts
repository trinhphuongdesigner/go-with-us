import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdminPermission, Role } from '@prisma/client';
import { assertAdminPermission } from '../../common/access/admin-permissions';
import { PrismaService } from '../../prisma/prisma.service';
import { UpsertSkillDto } from './dto/upsert-skill.dto';
import { EmployeeSkillItemDto } from './dto/employee-skill-item.dto';
import type { AuthenticatedUser } from '../auth/jwt.strategy';

@Injectable()
export class SkillsCompetencyService {
  constructor(private readonly prisma: PrismaService) {}

  /** Any authenticated role may browse the full skill catalog. */
  listSkills() {
    return this.prisma.skill.findMany({ orderBy: { name: 'asc' } });
  }

  /**
   * Create-or-return-existing by unique name, open to any authenticated
   * role — so an employee typing a brand-new skill name they just learned
   * doesn't hit a duplicate-name error; they just get that Skill's id back
   * either way.
   */
  async upsertSkill(dto: UpsertSkillDto) {
    const existing = await this.prisma.skill.findUnique({
      where: { name: dto.name },
    });
    if (existing) {
      return existing;
    }

    return this.prisma.skill.create({
      data: { name: dto.name, category: dto.category },
    });
  }

  /**
   * Visibility: self, or a COMPANY_ADMIN whose companyId matches the
   * target user's companyId, or SUPER_ADMIN.
   */
  async listUserSkills(userId: string, caller: AuthenticatedUser) {
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, companyId: true },
    });
    if (!target) {
      throw new NotFoundException(`User ${userId} not found`);
    }
    this.assertSameCompanyOrSelfOrSuperAdmin(target, caller);

    return this.prisma.employeeSkill.findMany({
      where: { userId },
      include: { skill: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Bulk upsert-by-unique([userId, skillId]) the caller's OWN
   * EmployeeSkill rows only — always stamped selfAssessed: true, since
   * this is the self-tracking entry point (there is no admin-override
   * write path in this slice).
   */
  async bulkUpsertOwnSkills(
    userId: string,
    items: EmployeeSkillItemDto[],
    caller: AuthenticatedUser,
  ) {
    if (caller.id !== userId) {
      throw new ForbiddenException('You can only update your own skills');
    }

    const results: Array<
      Awaited<ReturnType<typeof this.prisma.employeeSkill.upsert>>
    > = [];
    for (const item of items) {
      const row = await this.prisma.employeeSkill.upsert({
        where: { userId_skillId: { userId, skillId: item.skillId } },
        update: {
          level: item.level,
          note: item.note ?? null,
          selfAssessed: true,
        },
        create: {
          userId,
          skillId: item.skillId,
          level: item.level,
          note: item.note ?? null,
          selfAssessed: true,
        },
        include: { skill: true },
      });
      results.push(row);
    }

    return results;
  }

  /**
   * Company-admin-facing aggregated view — restricted to COMPANY_ADMIN
   * (same company as the target) or SUPER_ADMIN at the controller
   * (@Roles), plus the same-company check re-asserted here since @Roles
   * alone doesn't know about companyId scoping.
   */
  async getInsight(userId: string, caller: AuthenticatedUser) {
    assertAdminPermission(caller, AdminPermission.VIEW);
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        jobTitle: true,
        contributionScore: true,
        attitudeScore: true,
        companyId: true,
      },
    });
    if (!target) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const isSameCompanyAdmin =
      caller.role === Role.COMPANY_ADMIN &&
      !!caller.companyId &&
      caller.companyId === target.companyId;
    if (caller.role !== Role.SUPER_ADMIN && !isSameCompanyAdmin) {
      throw new ForbiddenException('Not allowed to view this insight');
    }

    const [skills, goalGroups, activityCount, peerReviewReceivedCount] =
      await Promise.all([
        this.prisma.employeeSkill.findMany({
          where: { userId },
          include: { skill: true },
          orderBy: { updatedAt: 'desc' },
        }),
        this.prisma.developmentGoal.groupBy({
          by: ['status'],
          where: { userId },
          _count: { _all: true },
        }),
        this.prisma.activityLog.count({ where: { userId } }),
        this.prisma.peerReview.count({ where: { revieweeId: userId } }),
      ]);

    const goalStatusCounts = goalGroups.reduce<Record<string, number>>(
      (acc, group) => {
        acc[group.status] = group._count._all;
        return acc;
      },
      {},
    );

    return {
      profile: {
        id: target.id,
        name: target.name,
        jobTitle: target.jobTitle,
        contributionScore: target.contributionScore,
        attitudeScore: target.attitudeScore,
      },
      skills,
      goalStatusCounts,
      activityCount,
      peerReviewReceivedCount,
    };
  }

  private assertSameCompanyOrSelfOrSuperAdmin(
    target: { id: string; companyId: string | null },
    caller: AuthenticatedUser,
  ) {
    if (caller.role === Role.SUPER_ADMIN) return;
    if (caller.id === target.id) return;
    assertAdminPermission(caller, AdminPermission.VIEW);
    if (
      caller.role === Role.COMPANY_ADMIN &&
      caller.companyId &&
      caller.companyId === target.companyId
    ) {
      return;
    }
    throw new ForbiddenException("Not allowed to view this user's skills");
  }
}
