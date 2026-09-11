import { ImportSourceType } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProfileImportDto {
  @IsEnum(ImportSourceType)
  sourceType!: ImportSourceType;

  @IsOptional()
  @IsString()
  sourceName?: string;

  /**
   * Plain text of the CV (pasted or extracted client-side) or the LinkedIn
   * profile text. No object storage in this project, so the file itself is
   * never persisted — only the text we parse.
   */
  @IsString()
  @MinLength(20)
  rawText!: string;
}

// --- Apply payload -------------------------------------------------------
// The user may edit the AI proposal before saving, so apply takes the final
// values back rather than trusting whatever is stored in parsedData.

export class ApplySkillDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  level?: number;
}

export class ApplyCertificationDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  issuer?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  score?: string;

  @IsOptional()
  @IsString()
  issuedAt?: string;
}

export class ApplyProjectDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  role!: string;

  @IsOptional()
  @IsString()
  domain?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  techStack?: string[];

  @IsOptional()
  @IsString()
  contribution?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}

export class ApplyAwardDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  issuer?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  awardedAt?: string;
}

export class ApplyProfileImportDto {
  @IsOptional()
  @IsString()
  jobTitle?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApplySkillDto)
  skills?: ApplySkillDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApplyCertificationDto)
  certifications?: ApplyCertificationDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApplyProjectDto)
  projects?: ApplyProjectDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApplyAwardDto)
  awards?: ApplyAwardDto[];
}
