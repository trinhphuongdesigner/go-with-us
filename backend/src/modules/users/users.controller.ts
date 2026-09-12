import {
  Body,
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(
    @CurrentUser() caller: AuthenticatedUser,
    @Query('role') role?: Role,
    @Query('companyId') companyId?: string,
  ) {
    return this.usersService.findAll(caller, { role, companyId });
  }

  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('avatar', {
      limits: { files: 1, fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadAvatar(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({
            maxSize: 5 * 1024 * 1024,
            errorMessage: 'Avatar must not exceed 5 MB',
          }),
          new FileTypeValidator({
            fileType: /^image\/(jpeg|png|webp)$/,
            overrideMimeType: true,
            errorMessage: 'Avatar must be a JPEG, PNG or WebP image',
          }),
        ],
      }),
    )
    file: Express.Multer.File,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.usersService.uploadAvatar(file, caller);
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

  @Patch(':id/password')
  resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    return this.usersService.resetPassword(id, dto.password, caller);
  }
}
