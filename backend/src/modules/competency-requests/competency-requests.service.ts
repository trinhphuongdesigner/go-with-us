import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CompetencyRequestSourceType,
  CompetencyRequestStatus,
  EmploymentStatus,
  Prisma,
  Role,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import {
  CreateCompetencyRequestDto,
  ReviewCompetencyRequestDto,
} from './dto/competency-request.dto';

/** Fields worth freezing onto the request so it stays readable even if the source record is later edited or deleted. Round-tripped through JSON so Date/etc become plain Prisma Json input. */
function buildSnapshot(
  sourceType: CompetencyRequestSourceType,
  source: Record<string, unknown>,
): Prisma.InputJsonValue {
  const shaped =
    sourceType === CompetencyRequestSourceType.CERTIFICATION
      ? {
          name: source.name,
          issuer: source.issuer,
          score: source.score,
          issuedAt: source.issuedAt,
          credentialUrl: source.credentialUrl,
        }
      : {
          title: source.title,
          issuer: source.issuer,
          description: source.description,
          awardedAt: source.awardedAt,
          evidenceUrl: source.evidenceUrl,
        };
  return JSON.parse(JSON.stringify(shaped));
}

@Injectable()
export class CompetencyRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCompetencyRequestDto, caller: AuthenticatedUser) {
    const employment = await this.prisma.employment.findUnique({
      where: { id: dto.employmentId },
    });
    if (
      !employment ||
      employment.userId !== caller.id ||
      employment.status !== EmploymentStatus.ACTIVE
    ) {
      throw new BadRequestException(
        'employmentId must be one of your current employments',
      );
    }

    const recipient = await this.prisma.user.findUnique({
      where: { id: dto.recipientUserId },
    });
    if (
      !recipient ||
      recipient.role !== Role.HR ||
      recipient.companyId !== employment.companyId
    ) {
      throw new BadRequestException(
        'recipientUserId must be an HR user at that company',
      );
    }

    const source =
      dto.sourceType === CompetencyRequestSourceType.CERTIFICATION
        ? await this.prisma.certification.findUnique({
            where: { id: dto.sourceId },
          })
        : await this.prisma.award.findUnique({ where: { id: dto.sourceId } });
    if (!source || source.userId !== caller.id) {
      throw new NotFoundException(
        `${dto.sourceType === CompetencyRequestSourceType.CERTIFICATION ? 'Certification' : 'Award'} ${dto.sourceId} not found`,
      );
    }

    return this.prisma.competencyRequest.create({
      data: {
        senderId: caller.id,
        recipientId: recipient.id,
        companyId: employment.companyId,
        sourceType: dto.sourceType,
        sourceId: dto.sourceId,
        sourceSnapshot: buildSnapshot(dto.sourceType, source),
        message: dto.message,
      },
    });
  }

  /** The employee's own outbox — used to show a "Đang chờ duyệt" state on each certification/award row. */
  listSent(caller: AuthenticatedUser) {
    return this.prisma.competencyRequest.findMany({
      where: { senderId: caller.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** HR/BOD/COMPANY_ADMIN's inbox — only what was addressed to them directly (v1: no company-wide visibility). */
  listReceived(caller: AuthenticatedUser, status?: CompetencyRequestStatus) {
    if (
      caller.role !== Role.HR &&
      caller.role !== Role.BOD &&
      caller.role !== Role.COMPANY_ADMIN
    ) {
      throw new ForbiddenException(
        'Only HR, BOD, or Company Admin can view received requests',
      );
    }
    return this.prisma.competencyRequest.findMany({
      where: { recipientId: caller.id, ...(status ? { status } : {}) },
      include: { sender: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async review(
    id: string,
    dto: ReviewCompetencyRequestDto,
    caller: AuthenticatedUser,
  ) {
    const request = await this.prisma.competencyRequest.findUnique({
      where: { id },
    });
    if (!request) {
      throw new NotFoundException(`Competency request ${id} not found`);
    }
    if (request.recipientId !== caller.id) {
      throw new ForbiddenException('Not allowed to review this request');
    }
    if (request.status !== CompetencyRequestStatus.PENDING) {
      throw new BadRequestException('This request has already been reviewed');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.competencyRequest.update({
        where: { id },
        data: {
          status: dto.status,
          pointsAwarded: dto.pointsAwarded,
          reviewNote: dto.reviewNote,
          reviewedAt: new Date(),
        },
      });

      if (dto.status === 'APPROVED' && dto.pointsAwarded) {
        const sender = await tx.user.findUnique({
          where: { id: request.senderId },
          select: { contributionScore: true },
        });
        await tx.user.update({
          where: { id: request.senderId },
          data: {
            contributionScore:
              (sender?.contributionScore ?? 0) + dto.pointsAwarded,
          },
        });
      }

      return updated;
    });
  }
}
