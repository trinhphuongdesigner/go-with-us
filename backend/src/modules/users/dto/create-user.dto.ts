import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  name!: string;

  @IsEnum(Role)
  role!: Role;

  // Ignored for SUPER_ADMIN; required in practice for COMPANY_ADMIN/EMPLOYEE
  // but enforced in UsersService based on the caller's own role/company,
  // not trusted verbatim from the body.
  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsString()
  jobTitle?: string;
}
