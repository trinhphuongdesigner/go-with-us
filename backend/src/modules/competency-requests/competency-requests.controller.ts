import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CompetencyRequestStatus } from '@prisma/client';
import { CompetencyRequestsService } from './competency-requests.service';
import {
  CreateCompetencyRequestDto,
  ReviewCompetencyRequestDto,
} from './dto/competency-request.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';

/**
 * An employee asking a specific HR at one of their current companies to
 * review a certification/award, HR then approves (optionally awarding
 * points) or rejects. No role guard on the module — visibility is enforced
 * inside the service (senderId/recipientId checks) since this is a
 * peer-to-target request, not a management action.
 */
@Controller('competency-requests')
@UseGuards(JwtAuthGuard)
export class CompetencyRequestsController {
  constructor(private readonly service: CompetencyRequestsService) {}

  @Post()
  create(
    @Body() dto: CreateCompetencyRequestDto,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.service.create(dto, caller);
  }

  @Get('sent')
  listSent(@CurrentUser() caller: AuthenticatedUser) {
    return this.service.listSent(caller);
  }

  @Get('received')
  listReceived(
    @CurrentUser() caller: AuthenticatedUser,
    @Query('status') status?: CompetencyRequestStatus,
  ) {
    return this.service.listReceived(caller, status);
  }

  @Patch(':id/review')
  review(
    @Param('id') id: string,
    @Body() dto: ReviewCompetencyRequestDto,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.service.review(id, dto, caller);
  }
}
