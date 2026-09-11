import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class EmployeeSkillItemDto {
  @IsString()
  skillId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  level!: number;

  @IsOptional()
  @IsString()
  note?: string;
}
