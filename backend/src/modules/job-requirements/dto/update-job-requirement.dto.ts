import { ArrayNotEmpty, IsArray, IsOptional, IsString } from 'class-validator';

export class UpdateJobRequirementDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  requiredSkills?: string[];

  // e.g. "closed" to stop matching against a filled requirement.
  @IsOptional()
  @IsString()
  status?: string;
}
