import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { AdminPermission } from '@prisma/client';
import { ADMIN_PERMISSIONS_KEY } from '../access/permission-metadata';
import { PermissionsGuard } from '../guards/permissions.guard';

/** Use after JwtAuthGuard. All requested permissions are required. */
export const RequirePermission = (...permissions: AdminPermission[]) =>
  applyDecorators(
    SetMetadata(ADMIN_PERMISSIONS_KEY, permissions),
    UseGuards(PermissionsGuard),
  );
