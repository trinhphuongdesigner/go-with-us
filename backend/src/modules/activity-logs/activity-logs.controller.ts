import { Controller, Get, UseGuards } from '@nestjs/common';
import { ActivityLogsService } from './activity-logs.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

/**
 * Stub module — real controller/service TBD in a later phase (Prisma model
 * for this domain already exists in schema.prisma). Wired into
 * AppModule.imports now so future feature-slice work only needs to fill in
 * this file, never touch app.module.ts again.
 */
@Controller('activity-logs')
@UseGuards(JwtAuthGuard)
export class ActivityLogsController {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  @Get()
  status() {
    return this.activityLogsService.status();
  }
}
