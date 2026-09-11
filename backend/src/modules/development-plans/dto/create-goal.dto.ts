import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { GoalStatus, LifeCategory } from '@prisma/client';

export class CreateGoalDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  /** WORK vs PERSONAL — defaults to WORK server-side. */
  @IsOptional()
  @IsEnum(LifeCategory)
  category?: LifeCategory;

  @IsOptional()
  @IsString()
  metric?: string;

  @IsOptional()
  @IsNumber()
  targetValue?: number;

  @IsOptional()
  @IsNumber()
  currentValue?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progress?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsEnum(GoalStatus)
  status?: GoalStatus;

  /** Set when this goal was created by accepting a roadmap proposal. */
  @IsOptional()
  aiSuggested?: boolean;
}
