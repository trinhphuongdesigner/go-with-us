import { IsArray, IsEnum } from 'class-validator';
import { AdminPermission } from '@prisma/client';

// The target role comes from the :role path param (see RolesController.update),
// not the body — the frontend only ever sends { permissions }.
export class UpdateRolePermissionsDto {
  @IsArray()
  @IsEnum(AdminPermission, { each: true })
  permissions!: AdminPermission[];
}
