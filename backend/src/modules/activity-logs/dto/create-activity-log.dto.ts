import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateActivityLogDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  /** URL to a photo/certificate (outside Spaces) OR Spaces upload (prefix careermate/activity-evidence/). */
  @IsOptional()
  @IsString()
  evidenceUrl?: string;

  @IsDateString()
  date!: string;
}
