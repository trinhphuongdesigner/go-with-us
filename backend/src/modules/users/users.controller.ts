import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(@CurrentUser() caller: AuthenticatedUser) {
    return this.usersService.findAll(caller);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() caller: AuthenticatedUser) {
    return this.usersService.findOne(id, caller);
  }

  @Post()
  create(@Body() dto: CreateUserDto, @CurrentUser() caller: AuthenticatedUser) {
    return this.usersService.create(dto, caller);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.usersService.update(id, dto, caller);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() caller: AuthenticatedUser) {
    return this.usersService.remove(id, caller);
  }
}
