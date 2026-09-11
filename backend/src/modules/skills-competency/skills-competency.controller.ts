import { Controller, Get, UseGuards } from '@nestjs/common';
import { SkillsCompetencyService } from './skills-competency.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

/**
 * Stub module — real controller/service TBD in a later phase (Prisma model
 * for this domain already exists in schema.prisma). Wired into
 * AppModule.imports now so future feature-slice work only needs to fill in
 * this file, never touch app.module.ts again.
 */
@Controller('skills-competency')
@UseGuards(JwtAuthGuard)
export class SkillsCompetencyController {
  constructor(
    private readonly skillsCompetencyService: SkillsCompetencyService,
  ) {}

  @Get()
  status() {
    return this.skillsCompetencyService.status();
  }
}
