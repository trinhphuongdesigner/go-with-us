import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpsertSkillDto } from './dto/upsert-skill.dto';
import { EmployeeSkillItemDto } from './dto/employee-skill-item.dto';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { assertCanViewUser } from '../../common/access/user-scope';
import { canManageRole } from '../../common/access/role-hierarchy';

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
   * Visibility: self, SUPER_ADMIN, or same-company and within the caller's
   * account-management hierarchy (role-hierarchy.ts via assertCanViewUser).
   */
  async listUserSkills(userId: string, caller: AuthenticatedUser) {
    await assertCanViewUser(this.prisma, caller, userId, 'skills');

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
   * Delete-own-only, mirroring bulkUpsertOwnSkills — there is no
   * admin-override write path in this slice.
   */
  async removeOwnSkill(
    userId: string,
    skillId: string,
    caller: AuthenticatedUser,
  ) {
    if (caller.id !== userId) {
      throw new ForbiddenException('You can only remove your own skills');
    }

    const existing = await this.prisma.employeeSkill.findUnique({
      where: { userId_skillId: { userId, skillId } },
    });
    if (!existing) {
      throw new NotFoundException(`Skill ${skillId} not found for user`);
    }

    await this.prisma.employeeSkill.delete({
      where: { userId_skillId: { userId, skillId } },
    });
    return { id: existing.id };
  }

  /**
   * HR/BOD-facing aggregated view — the controller's @Roles already narrows
   * callers to HR/BOD/SUPER_ADMIN; this re-asserts same-company scope plus
   * the account-management hierarchy (role-hierarchy.ts) since @Roles alone
   * doesn't know about companyId or which tier the target belongs to.
   */
  async getInsight(userId: string, caller: AuthenticatedUser) {
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        jobTitle: true,
        contributionScore: true,
        attitudeScore: true,
        companyId: true,
        role: true,
      },
    });
    if (!target) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const canManage =
      caller.companyId === target.companyId &&
      canManageRole(caller.role, target.role);
    if (caller.role !== Role.SUPER_ADMIN && !canManage) {
      throw new ForbiddenException('Not allowed to view this insight');
    }

    const [skills, goalGroups, activityCount, assessmentsReceivedCount] =
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
        this.prisma.assessment.count({ where: { revieweeId: userId } }),
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
      assessmentsReceivedCount,
    };
  }
}
