import { Module } from '@nestjs/common';
import { CompetencyProfileController } from './competency-profile.controller';
import { CompetencyProfileService } from './competency-profile.service';

/**
 * M1 — the "hồ sơ năng lực toàn diện" domain that sits alongside the existing
 * skills-competency module: certifications, project history and awards.
 */
@Module({
  controllers: [CompetencyProfileController],
  providers: [CompetencyProfileService],
  exports: [CompetencyProfileService],
})
export class CompetencyProfileModule {}
