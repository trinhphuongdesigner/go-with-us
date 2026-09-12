import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateActivityLogDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  evidenceUrl?: string;

  @IsOptional()
  @IsDateString()
  date?: string;
}
