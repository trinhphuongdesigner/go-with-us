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

  // Resolved through resolveCompanyScope in the service: required for
  // SUPER_ADMIN (who has no company of their own), optional for everyone
  // else (defaults to caller.companyId, or an explicit CompanyMembership).
  @IsOptional()
  @IsString()
  companyId?: string;
}
