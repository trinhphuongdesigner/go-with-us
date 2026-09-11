import { AssessmentType, CycleStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateAssessmentCycleDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  templateId!: string;

  /** "YYYY-MM" — the month this cycle covers. */
  @Matches(/^\d{4}-\d{2}$/, { message: 'period must be in YYYY-MM format' })
  period!: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  companyId?: string;
}

export class UpdateAssessmentCycleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsEnum(CycleStatus)
  status?: CycleStatus;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class AnswerDto {
  @IsString()
  questionId!: string;

  @IsInt()
  @Min(0)
  score!: number;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class CreateAssessmentDto {
  @IsOptional()
  @IsString()
  cycleId?: string;

  /** Omit for a self-assessment. */
  @IsOptional()
  @IsString()
  revieweeId?: string;

  @IsEnum(AssessmentType)
  type!: AssessmentType;

  /** Monthly self check-in fields. */
  @IsOptional()
  @IsString()
  mood?: string;

  @IsOptional()
  @IsString()
  highlights?: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers?: AnswerDto[];
}

export class UpdateAssessmentDto {
  @IsOptional()
  @IsString()
  mood?: string;

  @IsOptional()
  @IsString()
  highlights?: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers?: AnswerDto[];
}

export class ReviewAssessmentDto {
  /** Only used when rejecting, to tell the reviewee what to fix. */
  @IsOptional()
  @IsString()
  comment?: string;
}
