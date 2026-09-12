import { IsArray, IsEnum } from 'class-validator';
import { AdminPermission, Role } from '@prisma/client';

export class UpdateRolePermissionsDto {
  @IsEnum(Role)
  role!: Role;

  @IsArray()
  @IsEnum(AdminPermission, { each: true })
  permissions!: AdminPermission[];
}
