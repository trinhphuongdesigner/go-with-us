import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { CreatePeerReviewDto } from './dto/create-peer-review.dto';

// Only the bits needed to render "who wrote/received this" — never leak
// passwordHash or anything else off the related User row.
const BASIC_USER_SELECT = {
  id: true,
  name: true,
  jobTitle: true,
  avatarUrl: true,
} as const;

@Injectable()
export class PeerReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Reviews the caller has written about others, newest first. */
  findGiven(caller: AuthenticatedUser) {
    return this.prisma.peerReview.findMany({
      where: { reviewerId: caller.id },
      include: { reviewee: { select: BASIC_USER_SELECT } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Reviews written about a user. Defaults to the caller's own reviews.
   * Looking up someone else's requires COMPANY_ADMIN (same company as the
   * target) or SUPER_ADMIN.
   */
  async findReceived(caller: AuthenticatedUser, userId?: string) {
    const targetId = userId ?? caller.id;

    if (targetId !== caller.id) {
      if (caller.role === Role.SUPER_ADMIN) {
        // allowed, no further check
      } else if (caller.role === Role.COMPANY_ADMIN) {
        const target = await this.prisma.user.findUnique({
          where: { id: targetId },
          select: { id: true, companyId: true },
        });
        if (!target) {
          throw new NotFoundException(`User ${targetId} not found`);
        }
        if (!caller.companyId || target.companyId !== caller.companyId) {
          throw new ForbiddenException(
            'Not allowed to view reviews for this user',
          );
        }
      } else {
        throw new ForbiddenException(
          'Not allowed to view reviews for this user',
        );
      }
    }

    return this.prisma.peerReview.findMany({
      where: { revieweeId: targetId },
      include: { reviewer: { select: BASIC_USER_SELECT } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreatePeerReviewDto, caller: AuthenticatedUser) {
    // SUPER_ADMIN has no company — not a reviewer in this domain at all.
    if (caller.role === Role.SUPER_ADMIN) {
      throw new BadRequestException('Super admins cannot submit peer reviews');
    }

    if (dto.revieweeId === caller.id) {
      throw new BadRequestException('Cannot submit a peer review of yourself');
    }

    const reviewee = await this.prisma.user.findUnique({
      where: { id: dto.revieweeId },
      select: { id: true, companyId: true },
    });
    if (!reviewee) {
      throw new NotFoundException(`User ${dto.revieweeId} not found`);
    }
    if (!caller.companyId || reviewee.companyId !== caller.companyId) {
      throw new ForbiddenException(
        'Can only review colleagues in your own company',
      );
    }

    return this.prisma.peerReview.create({
      data: {
        reviewerId: caller.id,
        revieweeId: dto.revieweeId,
        content: dto.content,
        ratings: dto.ratings as Prisma.InputJsonValue | undefined,
      },
      include: { reviewee: { select: BASIC_USER_SELECT } },
    });
  }
}
