import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminPermission, Role } from '@prisma/client';
import { RolesService } from './roles.service';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';

@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @Roles(Role.COMPANY_ADMIN, Role.HR, Role.BOD, Role.SUPER_ADMIN)
  @RequirePermission(AdminPermission.MANAGE_ROLES)
  list(
    @CurrentUser() caller: AuthenticatedUser,
    @Query('companyId') companyId?: string,
  ) {
    return this.rolesService.listForCompany(caller, companyId);
  }

  @Patch(':role')
  @Roles(Role.COMPANY_ADMIN, Role.HR, Role.BOD, Role.SUPER_ADMIN)
  @RequirePermission(AdminPermission.MANAGE_ROLES)
  update(
    @Param('role') role: Role,
    @Body() dto: UpdateRolePermissionsDto,
    @CurrentUser() caller: AuthenticatedUser,
    @Query('companyId') companyId?: string,
  ) {
    return this.rolesService.updatePermissions(
      caller,
      role,
      dto.permissions,
      companyId,
    );
  }
}
