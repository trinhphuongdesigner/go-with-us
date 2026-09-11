import { ArrayNotEmpty, IsArray, IsOptional, IsString } from 'class-validator';

export class CreateJobRequirementDto {
  @IsString()
  title!: string;

  @IsString()
  description!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  requiredSkills!: string[];

  // Ignored for COMPANY_ADMIN (forced to caller.companyId in the service);
  // required in practice for SUPER_ADMIN, who has no company of their own.
  @IsOptional()
  @IsString()
  companyId?: string;
}
