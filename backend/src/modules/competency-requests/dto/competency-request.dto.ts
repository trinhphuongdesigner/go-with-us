import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { CompetencyRequestSourceType } from '@prisma/client';

export class CreateCompetencyRequestDto {
  @IsEnum(CompetencyRequestSourceType)
  sourceType!: CompetencyRequestSourceType;

  @IsString()
  @MinLength(1)
  sourceId!: string;

  /** Which of the sender's ACTIVE employments this request is scoped to — the recipient's company is derived from this, never trusted from the client directly. */
  @IsString()
  @MinLength(1)
  employmentId!: string;

  @IsString()
  @MinLength(1)
  recipientUserId!: string;

  @IsOptional()
  @IsString()
  message?: string;
}

export class ReviewCompetencyRequestDto {
  @IsEnum(['APPROVED', 'REJECTED'])
  status!: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  pointsAwarded?: number;

  @IsOptional()
  @IsString()
  reviewNote?: string;
}
