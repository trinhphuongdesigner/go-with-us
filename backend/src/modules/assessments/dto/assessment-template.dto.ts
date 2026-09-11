import { AssessmentScoreDimension, TemplateStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class QuestionDto {
  @IsString()
  @MinLength(1)
  text!: string;

  /** "mô tả expand" — what this criterion means / how to score it. */
  @IsOptional()
  @IsString()
  guidance?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxScore?: number;
}

export class GroupDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(AssessmentScoreDimension)
  scoreDimension?: AssessmentScoreDimension;

  /** Relative weight of this group within the template. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuestionDto)
  questions!: QuestionDto[];
}

export class CreateAssessmentTemplateDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  /** SUPER_ADMIN must name the company; COMPANY_ADMIN is pinned to theirs. */
  @IsOptional()
  @IsString()
  companyId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GroupDto)
  groups!: GroupDto[];
}

export class UpdateAssessmentTemplateDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(TemplateStatus)
  status?: TemplateStatus;

  /**
   * When present, replaces the whole group/question tree — approved
   * assessments keep their own frozen snapshot, so rewriting the live
   * template never rewrites history.
   */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GroupDto)
  groups?: GroupDto[];
}
