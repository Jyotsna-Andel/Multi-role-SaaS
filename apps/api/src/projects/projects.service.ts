import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser, RequestMeta } from '../common/auth-user';
import { Paginated, paginated } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { Cached, RedisService } from '../redis/redis.service';
import { CreateProjectDto, ListProjectsDto, UpdateProjectDto } from './projects.dto';

const LIST_TTL_SECONDS = 60;
const STATS_TTL_SECONDS = 30;

const ORDER: Record<ListProjectsDto['sort'], Prisma.ProjectOrderByWithRelationInput[]> = {
  newest: [{ createdAt: 'desc' }, { id: 'asc' }],
  oldest: [{ createdAt: 'asc' }, { id: 'asc' }],
  name: [{ name: 'asc' }, { id: 'asc' }],
};

const PROJECT_SELECT = {
  id: true,
  name: true,
  description: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.ProjectSelect;

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
  ) {}

  private ns(orgId: string) {
    return `org:${orgId}:projects`;
  }

  async list(orgId: string, q: ListProjectsDto): Promise<Cached<Paginated<unknown>>> {
    const version = await this.redis.version(this.ns(orgId));
    const key = `cache:${this.ns(orgId)}:v${version}:${RedisService.hash(q)}`;

    return this.redis.wrap(key, LIST_TTL_SECONDS, async () => {
      const where: Prisma.ProjectWhereInput = {
        orgId,
        ...(q.status ? { status: q.status } : {}),
        ...(q.search ? { name: { contains: q.search, mode: 'insensitive' } } : {}),
      };
      const [rows, total] = await this.prisma.$transaction([
        this.prisma.project.findMany({ where, select: PROJECT_SELECT, orderBy: ORDER[q.sort], skip: (q.page - 1) * q.limit, take: q.limit }),
        this.prisma.project.count({ where }),
      ]);
      return paginated(rows, total, q.page, q.limit);
    });
  }

  async stats(orgId: string) {
    const version = await this.redis.version(this.ns(orgId));
    return this.redis.wrap(`cache:${this.ns(orgId)}:v${version}:stats`, STATS_TTL_SECONDS, async () => {
      const [byStatus, users, recentEvents] = await this.prisma.$transaction([
        this.prisma.project.groupBy({ by: ['status'], where: { orgId }, _count: { _all: true }, orderBy: { status: 'asc' } }),
        this.prisma.user.count({ where: { orgId, isActive: true } }),
        this.prisma.auditLog.count({ where: { orgId, createdAt: { gte: new Date(Date.now() - 24 * 3_600_000) } } }),
      ]);
      const projects = Object.fromEntries(byStatus.map((s) => [s.status, (s._count as { _all: number })._all]));
      const totalProjects = Object.values(projects).reduce((a, b) => a + b, 0);
      return { totalProjects, projectsByStatus: projects, activeUsers: users, auditEvents24h: recentEvents, generatedAt: new Date().toISOString() };
    });
  }

  async get(orgId: string, id: string) {
    const project = await this.prisma.project.findFirst({ where: { id, orgId }, select: PROJECT_SELECT });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async create(user: AuthUser, dto: CreateProjectDto, meta: RequestMeta) {
    const project = await this.prisma.$transaction(async (tx) => {
      const created = await tx.project.create({ data: { ...dto, orgId: user.orgId, createdById: user.id }, select: PROJECT_SELECT });
      await this.audit.log({ orgId: user.orgId, actorId: user.id, action: 'project.created', entity: 'Project', entityId: created.id, metadata: { name: created.name }, meta }, tx);
      return created;
    });
    await this.redis.bumpVersion(this.ns(user.orgId));
    return project;
  }

  async update(user: AuthUser, id: string, dto: UpdateProjectDto, meta: RequestMeta) {
    const project = await this.prisma.$transaction(async (tx) => {
      const before = await tx.project.findFirst({ where: { id, orgId: user.orgId } });
      if (!before) throw new NotFoundException('Project not found');
      const updated = await tx.project.update({ where: { id }, data: dto, select: PROJECT_SELECT });

      const changes = Object.fromEntries(
        (Object.keys(dto) as (keyof UpdateProjectDto)[])
          .filter((k) => dto[k] !== undefined && dto[k] !== before[k])
          .map((k) => [k, { from: before[k], to: dto[k] }]),
      );
      await this.audit.log({ orgId: user.orgId, actorId: user.id, action: 'project.updated', entity: 'Project', entityId: id, metadata: changes, meta }, tx);
      return updated;
    });
    await this.redis.bumpVersion(this.ns(user.orgId));
    return project;
  }

  async remove(user: AuthUser, id: string, meta: RequestMeta) {
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.project.deleteMany({ where: { id, orgId: user.orgId } });
      if (!count) throw new NotFoundException('Project not found');
      await this.audit.log({ orgId: user.orgId, actorId: user.id, action: 'project.deleted', entity: 'Project', entityId: id, meta }, tx);
    });
    await this.redis.bumpVersion(this.ns(user.orgId));
  }
}
