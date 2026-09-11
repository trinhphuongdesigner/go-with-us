import { Module } from '@nestjs/common';
import { SkillsCompetencyController } from './skills-competency.controller';
import { SkillsCompetencyService } from './skills-competency.service';

@Module({
  controllers: [SkillsCompetencyController],
  providers: [SkillsCompetencyService],
})
export class SkillsCompetencyModule {}
