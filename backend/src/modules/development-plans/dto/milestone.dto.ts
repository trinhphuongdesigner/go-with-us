import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { MilestoneStatus } from '@prisma/client';

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
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoadmapMilestoneDto)
  milestones!: RoadmapMilestoneDto[];
}
