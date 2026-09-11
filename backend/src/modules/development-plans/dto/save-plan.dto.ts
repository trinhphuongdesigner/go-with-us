import { IsBoolean, IsOptional, IsString } from 'class-validator';

/** The explicit-save endpoint's body — see PUT /api/development-plans/me. */
export class SavePlanDto {
  @IsString()
  content!: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsBoolean()
  aiGenerated?: boolean;
}
