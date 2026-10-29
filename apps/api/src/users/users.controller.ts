import { Body, Controller, Get, Module, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuthUser, RequestMeta } from '../common/auth-user';
import { CurrentUser, ReqMeta, RequirePermissions } from '../common/decorators';
import { Permission } from '../common/rbac';
import { InviteUserDto, ListUsersDto, SetActiveDto, UpdateRoleDto } from './users.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermissions(Permission.USER_READ)
  list(@CurrentUser() user: AuthUser, @Query() q: ListUsersDto) {
    return this.users.list(user.orgId, q);
  }

  @Post()
  @RequirePermissions(Permission.USER_MANAGE)
  invite(@CurrentUser() user: AuthUser, @Body() dto: InviteUserDto, @ReqMeta() meta: RequestMeta) {
    return this.users.invite(user, dto, meta);
  }

  @Patch(':id/role')
  @RequirePermissions(Permission.USER_MANAGE)
  updateRole(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRoleDto, @ReqMeta() meta: RequestMeta) {
    return this.users.updateRole(user, id, dto.role, meta);
  }

  @Patch(':id/status')
  @RequirePermissions(Permission.USER_MANAGE)
  setActive(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SetActiveDto, @ReqMeta() meta: RequestMeta) {
    return this.users.setActive(user, id, dto.isActive, meta);
  }
}

@Module({ imports: [AuthModule], controllers: [UsersController], providers: [UsersService] })
export class UsersModule {}
