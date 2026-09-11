import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { GoalStatus } from '@prisma/client';

export class CreateGoalDto {
  @IsString()
  title!: string;

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
  @IsEnum(GoalStatus)
  status?: GoalStatus;
}
