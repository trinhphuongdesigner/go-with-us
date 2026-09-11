import { EmploymentStatus } from '@prisma/client';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateEmploymentDto {
  /** Admin creating a record for someone else; omit for your own. */
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  companyId?: string;

  @IsString()
  @MinLength(1)
  jobTitle!: string;

  @IsOptional()
  @IsString()
  level?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class UpdateEmploymentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  jobTitle?: string;

  @IsOptional()
  @IsString()
  level?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(EmploymentStatus)
  status?: EmploymentStatus;
}

/** Explicit save of an AI-proposed (or user-edited) career summary. */
export class SaveCareerSummaryDto {
  @IsOptional()
  @IsString()
  employmentId?: string;

  @IsString()
  @MinLength(1)
  content!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  strengths?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  growthAreas?: string[];
}

export class GenerateCareerSummaryDto {
  /** Which employment period to summarise; omit for the whole career. */
  @IsOptional()
  @IsString()
  employmentId?: string;

  /** Admin generating for an employee; omit for your own. */
  @IsOptional()
  @IsString()
  userId?: string;
}

export class CreatePassportShareDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
