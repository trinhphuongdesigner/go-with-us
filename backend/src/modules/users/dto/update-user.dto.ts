import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { ThemeConcept } from '@prisma/client';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  jobTitle?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsEnum(ThemeConcept)
  themeConcept?: ThemeConcept;

  @IsOptional()
  @IsNumber()
  contributionScore?: number;

  @IsOptional()
  @IsNumber()
  attitudeScore?: number;
}
