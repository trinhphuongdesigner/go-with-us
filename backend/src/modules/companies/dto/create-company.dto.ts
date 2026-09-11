import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCompanyDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  industry?: string;

  // The Company Admin created alongside the company (Super Admin flow —
  // "create company + its Company Admin" per the product brief).
  @IsEmail()
  adminEmail!: string;

  @IsString()
  adminName!: string;

  @IsString()
  @MinLength(6)
  adminPassword!: string;
}
