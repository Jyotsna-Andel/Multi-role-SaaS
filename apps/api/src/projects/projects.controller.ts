import { Body, Controller, Delete, Get, HttpCode, Module, Param, ParseUUIDPipe, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthUser, RequestMeta } from '../common/auth-user';
import { CurrentUser, ReqMeta, RequirePermissions } from '../common/decorators';
import { Permission } from '../common/rbac';
import { CreateProjectDto, ListProjectsDto, UpdateProjectDto } from './projects.dto';
import { ProjectsService } from './projects.service';

@Controller()
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get('projects')
  @RequirePermissions(Permission.PROJECT_READ)
  async list(@CurrentUser() user: AuthUser, @Query() q: ListProjectsDto, @Res({ passthrough: true }) res: Response) {
    const { value, hit } = await this.projects.list(user.orgId, q);
    res.setHeader('X-Cache', hit ? 'HIT' : 'MISS');
    return value;
  }

  @Get('dashboard/stats')
  @RequirePermissions(Permission.PROJECT_READ)
  async stats(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    const { value, hit } = await this.projects.stats(user.orgId);
    res.setHeader('X-Cache', hit ? 'HIT' : 'MISS');
    return { ...value, cache: hit ? 'HIT' : 'MISS' };
  }

  @Get('projects/:id')
  @RequirePermissions(Permission.PROJECT_READ)
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projects.get(user.orgId, id);
  }

  @Post('projects')
  @RequirePermissions(Permission.PROJECT_WRITE)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProjectDto, @ReqMeta() meta: RequestMeta) {
    return this.projects.create(user, dto, meta);
  }

  @Patch('projects/:id')
  @RequirePermissions(Permission.PROJECT_WRITE)
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProjectDto, @ReqMeta() meta: RequestMeta) {
    return this.projects.update(user, id, dto, meta);
  }

  @Delete('projects/:id')
  @HttpCode(204)
  @RequirePermissions(Permission.PROJECT_DELETE)
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @ReqMeta() meta: RequestMeta) {
    return this.projects.remove(user, id, meta);
  }
}

@Module({ controllers: [ProjectsController], providers: [ProjectsService] })
export class ProjectsModule {}
