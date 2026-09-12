import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Role, ThemeConcept } from '@prisma/client';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  // Role reassignment — UsersService enforces canManageRole() against both
  // the target's current role and this new role, so a caller can never
  // promote someone to or above their own tier.
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  // Self-described professional title/specialty — see the schema comment on
  // User.jobTitle for how this differs from a per-company Employment.jobTitle.
  @IsOptional()
  @IsString()
  jobTitle?: string;

  @IsOptional()
  @IsEnum(ThemeConcept)
  themeConcept?: ThemeConcept;

  @IsOptional()
  @IsNumber()
  contributionScore?: number;

  @IsOptional()
  @IsNumber()
  attitudeScore?: number;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  idNumber?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  // Employee-provided in practice via `create()`; UsersService.update()
  // blocks employees from setting this on themselves — see comment there.
  @IsOptional()
  @IsDateString()
  onboardDate?: string;

  @IsOptional()
  @IsString()
  emergencyContactName?: string;

  @IsOptional()
  @IsString()
  emergencyContactPhone?: string;
}
