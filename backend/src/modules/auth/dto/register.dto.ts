import { IsEmail, IsString, MinLength } from 'class-validator';

/**
 * Only used to bootstrap the very first SUPER_ADMIN (see
 * AuthService.register — rejected once any user already exists). Every
 * other user (COMPANY_ADMIN, EMPLOYEE) is created through
 * CompaniesService/UsersService instead, which apply real role scoping.
 */
export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  name!: string;
}
