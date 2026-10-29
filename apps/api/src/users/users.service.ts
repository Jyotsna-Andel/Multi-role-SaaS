import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { BCRYPT_ROUNDS } from '../auth/auth.service';
import { SessionService } from '../auth/session.service';
import { AuthUser, RequestMeta } from '../common/auth-user';
import { paginated } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { InviteUserDto, ListUsersDto } from './users.dto';

// Never select passwordHash / token fields into API responses.
const PUBLIC_USER = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  lockedUntil: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

type Tx = Prisma.TransactionClient;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sessions: SessionService,
  ) {}

  async list(orgId: string, q: ListUsersDto) {
    const where: Prisma.UserWhereInput = {
      orgId, // tenant isolation: every query is scoped to the caller's org
      ...(q.role ? { role: q.role } : {}),
      ...(q.search
        ? { OR: [{ name: { contains: q.search, mode: 'insensitive' } }, { email: { contains: q.search, mode: 'insensitive' } }] }
        : {}),
    };
    // Batch transaction => rows and total come from one consistent snapshot.
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({ where, select: PUBLIC_USER, orderBy: { createdAt: 'asc' }, skip: (q.page - 1) * q.limit, take: q.limit }),
      this.prisma.user.count({ where }),
    ]);
    return paginated(rows, total, q.page, q.limit);
  }

  /** Creates the user with a one-time temporary password (in production this would be an emailed invite link). */
  async invite(actor: AuthUser, dto: InviteUserDto, meta: RequestMeta) {
    const tempPassword = `${randomBytes(9).toString('base64url')}A1`;
    const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);

    const user = await this.prisma.$transaction(async (tx) => {
      const exists = await tx.user.findUnique({ where: { email: dto.email }, select: { id: true } });
      if (exists) throw new ConflictException('Email is already registered');
      const created = await tx.user.create({
        data: { email: dto.email, name: dto.name, role: dto.role, passwordHash, orgId: actor.orgId },
        select: PUBLIC_USER,
      });
      await this.audit.log({ orgId: actor.orgId, actorId: actor.id, action: 'user.invited', entity: 'User', entityId: created.id, metadata: { email: dto.email, role: dto.role }, meta }, tx);
      return created;
    });
    return { user, tempPassword };
  }

  async updateRole(actor: AuthUser, userId: string, role: Role, meta: RequestMeta) {
    const user = await this.prisma.$transaction(
      async (tx) => {
        const target = await this.findInOrg(tx, actor.orgId, userId);
        if (target.role === role) return target;
        if (target.role === 'ADMIN') await this.assertNotLastAdmin(tx, actor.orgId);

        const updated = await tx.user.update({ where: { id: target.id }, data: { role }, select: PUBLIC_USER });
        await this.audit.log({ orgId: actor.orgId, actorId: actor.id, action: 'user.role_changed', entity: 'User', entityId: target.id, metadata: { from: target.role, to: role }, meta }, tx);
        return updated;
      },
      // Serializable: two admins demoting each other concurrently can't both pass the "last admin" check.
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    await this.sessions.invalidate(userId); // new role applies on the user's next request
    return user;
  }

  async setActive(actor: AuthUser, userId: string, isActive: boolean, meta: RequestMeta) {
    if (actor.id === userId && !isActive) throw new BadRequestException('You cannot deactivate yourself');

    const user = await this.prisma.$transaction(
      async (tx) => {
        const target = await this.findInOrg(tx, actor.orgId, userId);
        if (target.isActive === isActive) return target;
        if (!isActive && target.role === 'ADMIN') await this.assertNotLastAdmin(tx, actor.orgId);

        const updated = await tx.user.update({
          where: { id: target.id },
          // Deactivation also kills live sessions: bump tokenVersion + revoke refresh tokens.
          data: { isActive, ...(isActive ? { failedLogins: 0, lockedUntil: null } : { tokenVersion: { increment: 1 } }) },
          select: PUBLIC_USER,
        });
        if (!isActive) {
          await tx.refreshToken.updateMany({ where: { userId: target.id, revokedAt: null }, data: { revokedAt: new Date() } });
        }
        await this.audit.log({ orgId: actor.orgId, actorId: actor.id, action: isActive ? 'user.activated' : 'user.deactivated', entity: 'User', entityId: target.id, meta }, tx);
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    await this.sessions.invalidate(userId);
    return user;
  }

  private async findInOrg(tx: Tx, orgId: string, userId: string) {
    // findFirst with orgId => a user from another tenant is indistinguishable from "not found".
    const user = await tx.user.findFirst({ where: { id: userId, orgId }, select: PUBLIC_USER });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private async assertNotLastAdmin(tx: Tx, orgId: string) {
    const admins = await tx.user.count({ where: { orgId, role: 'ADMIN', isActive: true } });
    if (admins <= 1) throw new ConflictException('Organization must keep at least one active admin');
  }
}
