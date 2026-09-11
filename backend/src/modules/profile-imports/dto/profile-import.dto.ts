import { ImportSourceType } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * New DTOs for rich multi-source "Cập nhật hồ sơ năng lực".
 * Backward compatible: old CV flow still works via Create/Apply.
 */

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

// --- Rich profile update proposal (new skill) -------------------------------

export class AnalyzeSourcesDto {
  @IsOptional()
  urls?: string[] | string;

  @IsOptional()
  pastedTexts?: string[] | string;
}

export class RichBasicInfoDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  jobTitle?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  summary?: string;
}

export class RichSkillDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  level?: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class RichActivityDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsString()
  date!: string; // YYYY-MM-DD
}

export class RichGoalDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: 'WORK' | 'PERSONAL';

  @IsOptional()
  @IsString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  metric?: string;
}

export class RichRoadmapTaskDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  metric?: string;
}

export class RichRoadmapMilestoneDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  dueDate?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RichRoadmapTaskDto)
  tasks!: RichRoadmapTaskDto[];
}

export class RichIdentityCheckDto {
  @IsOptional()
  @IsString()
  detectedSourceName?: string;

  @IsOptional()
  @IsBoolean()
  matches?: boolean;
}

export class RichProfileProposal {
  @IsOptional()
  @ValidateNested()
  @Type(() => RichIdentityCheckDto)
  identityCheck?: RichIdentityCheckDto;

  @IsOptional()
  basicInfo?: RichBasicInfoDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RichSkillDto)
  skills?: RichSkillDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApplyProjectDto)
  projects?: ApplyProjectDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApplyCertificationDto)
  certifications?: ApplyCertificationDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApplyAwardDto)
  awards?: ApplyAwardDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RichActivityDto)
  activities?: RichActivityDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RichGoalDto)
  goals?: RichGoalDto[];

  @IsOptional()
  roadmap?: {
    milestones: RichRoadmapMilestoneDto[];
  };

  @IsString()
  summary!: string;

  @IsOptional()
  @IsString()
  dedupNotes?: string;
}

export class RefineProposalDto {
  @IsOptional()
  proposal?: RichProfileProposal;

  @IsString()
  @MinLength(3)
  instruction!: string;
}

export class ApplyRichUpdatesDto {
  @IsOptional()
  basicInfo?: RichBasicInfoDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RichSkillDto)
  skills?: RichSkillDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApplyProjectDto)
  projects?: ApplyProjectDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApplyCertificationDto)
  certifications?: ApplyCertificationDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApplyAwardDto)
  awards?: ApplyAwardDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RichActivityDto)
  activities?: RichActivityDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RichGoalDto)
  goals?: RichGoalDto[];

  @IsOptional()
  roadmap?: {
    milestones: RichRoadmapMilestoneDto[];
  };
}
