import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { MilestoneStatus } from '@prisma/client';

type LifeCategory = 'WORK' | 'PERSONAL';

export class CreateTaskDto {
  @IsString()
  @MinLength(1)
  title!: string;

  /** How completion is measured, e.g. "ship 2 features as tech lead". */
  @IsOptional()
  @IsString()
  metric?: string;
}

export class CreateMilestoneDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTaskDto)
  tasks?: CreateTaskDto[];
}

export class UpdateMilestoneDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsEnum(MilestoneStatus)
  status?: MilestoneStatus;

  @IsOptional()
  @IsIn(['WORK', 'PERSONAL'])
  category?: LifeCategory;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  metric?: string;

  @IsOptional()
  done?: boolean;
}

/** One milestone in a roadmap proposal being committed to real records. */
export class RoadmapMilestoneDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTaskDto)
  tasks!: CreateTaskDto[];
}

/**
 * Explicit save of an AI-proposed (or user-edited) roadmap — replaces the
 * caller's whole milestone tree with this one, same "proposal until
 * confirmed" shape as the rest of the app's AI features.
 */
export class SaveRoadmapDto {
  @IsOptional()
  @IsIn(['WORK', 'PERSONAL'])
  category?: 'WORK' | 'PERSONAL';

  @IsOptional()
  @IsInt()
  @Min(1)
  durationWeeks?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  hoursPerWeek?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoadmapMilestoneDto)
  milestones!: RoadmapMilestoneDto[];
}

/**
 * Roadmap display prefs (character, view mode, costume color, reduce
 * motion, font size) — merged into DevelopmentPlan.displaySettings JSON.
 * A UI concern, not business data, so it isn't modeled as columns.
 */
export class UpdatePlanSettingsDto {
  @IsOptional()
  @IsString()
  character?: string;

  @IsOptional()
  @IsIn(['stair', 'diagram'])
  viewMode?: 'stair' | 'diagram';

  @IsOptional()
  @IsString()
  costumeColor?: string;

  @IsOptional()
  @IsBoolean()
  reduceMotion?: boolean;

  @IsOptional()
  @IsIn(['sm', 'md', 'lg'])
  fontSize?: 'sm' | 'md' | 'lg';
}
