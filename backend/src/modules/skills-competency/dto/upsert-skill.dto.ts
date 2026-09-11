import { IsOptional, IsString, MinLength } from 'class-validator';

/**
 * Create-or-return-existing by unique `Skill.name`. Open to any
 * authenticated role — an employee typing a brand-new skill name they just
 * learned should just work without a duplicate-name error (see
 * SkillsCompetencyService.upsertSkill).
 */
export class UpsertSkillDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  category?: string;
}
