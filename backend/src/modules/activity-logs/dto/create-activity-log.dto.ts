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

  @IsDateString()
  date!: string;
}
