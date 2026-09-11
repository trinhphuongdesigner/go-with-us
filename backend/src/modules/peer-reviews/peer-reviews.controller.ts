import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { PeerReviewsService } from './peer-reviews.service';
import { CreatePeerReviewDto } from './dto/create-peer-review.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';

@Controller('peer-reviews')
@UseGuards(JwtAuthGuard)
export class PeerReviewsController {
  constructor(private readonly peerReviewsService: PeerReviewsService) {}

  @Get('given')
  findGiven(@CurrentUser() caller: AuthenticatedUser) {
    return this.peerReviewsService.findGiven(caller);
  }

  @Get('received')
  findReceived(
    @CurrentUser() caller: AuthenticatedUser,
    @Query('userId') userId?: string,
  ) {
    return this.peerReviewsService.findReceived(caller, userId);
  }

  @Post()
  create(
    @Body() dto: CreatePeerReviewDto,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.peerReviewsService.create(dto, caller);
  }
}
