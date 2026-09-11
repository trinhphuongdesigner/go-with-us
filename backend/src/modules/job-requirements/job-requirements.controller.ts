import { Controller, Get, UseGuards } from '@nestjs/common';
import { JobRequirementsService } from './job-requirements.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

/**
 * Stub module — real controller/service TBD in a later phase (Prisma model
 * for this domain already exists in schema.prisma). Wired into
 * AppModule.imports now so future feature-slice work only needs to fill in
 * this file, never touch app.module.ts again.
 */
@Controller('job-requirements')
@UseGuards(JwtAuthGuard)
export class JobRequirementsController {
  constructor(
    private readonly jobRequirementsService: JobRequirementsService,
  ) {}

  @Get()
  status() {
    return this.jobRequirementsService.status();
  }
}
