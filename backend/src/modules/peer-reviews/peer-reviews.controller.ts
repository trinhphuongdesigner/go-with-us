import { Controller, Get, UseGuards } from '@nestjs/common';
import { PeerReviewsService } from './peer-reviews.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

/**
 * Stub module — real controller/service TBD in a later phase (Prisma model
 * for this domain already exists in schema.prisma). Wired into
 * AppModule.imports now so future feature-slice work only needs to fill in
 * this file, never touch app.module.ts again.
 */
@Controller('peer-reviews')
@UseGuards(JwtAuthGuard)
export class PeerReviewsController {
  constructor(private readonly peerReviewsService: PeerReviewsService) {}

  @Get()
  status() {
    return this.peerReviewsService.status();
  }
}
