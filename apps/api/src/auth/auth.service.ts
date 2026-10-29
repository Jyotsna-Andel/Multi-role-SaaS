import { ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { AccessTokenPayload, AuthUser, RequestMeta } from '../common/auth-user';
import { ROLE_PERMISSIONS } from '../common/rbac';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './auth.dto';
import { REFRESH_TTL_SECONDS } from './cookies';
import { SessionService } from './session.service';

export const BCRYPT_ROUNDS = 12;
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
/** A just-rotated token presented again within this window is a benign race (e.g. two tabs), not theft. */
const ROTATION_GRACE_MS = 10_000;
const INVALID_CREDENTIALS = 'Invalid email or password';

// Compared against when the email doesn't exist, so response time doesn't reveal valid emails.
const DUMMY_HASH = bcrypt.hashSync('timing-attack-mitigation', BCRYPT_ROUNDS);

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
}

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly sessions: SessionService,
  ) {}

  /** Creates a new tenant + its first ADMIN atomically. */
  async register(dto: RegisterDto, meta: RequestMeta) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email }, select: { id: true } });
    if (exists) throw new ConflictException('Email is already registered');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const slug = `${dto.orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)}-${randomBytes(3).toString('hex')}`;

    const user = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({ data: { name: dto.orgName, slug } });
      const admin = await tx.user.create({
        data: { email: dto.email, name: dto.name, passwordHash, role: 'ADMIN', orgId: org.id },
      });
      await this.audit.log({ orgId: org.id, actorId: admin.id, action: 'org.created', entity: 'Organization', entityId: org.id, metadata: { name: org.name }, meta }, tx);
      await this.audit.log({ orgId: org.id, actorId: admin.id, action: 'auth.register', entity: 'User', entityId: admin.id, meta }, tx);
      return admin;
    });

    return { user: this.publicUser(user), tokens: await this.issueTokens(user, meta) };
  }

  async login(dto: LoginDto, meta: RequestMeta) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (!user) {
      await bcrypt.compare(dto.password, DUMMY_HASH);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.audit.log({ orgId: user.orgId, actorId: user.id, action: 'auth.login_blocked', entity: 'User', entityId: user.id, metadata: { reason: 'locked' }, meta });
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok || !user.isActive) {
      await this.recordFailedLogin(user, meta, ok ? 'inactive' : 'bad_password');
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
    await this.audit.log({ orgId: user.orgId, actorId: user.id, action: 'auth.login', entity: 'User', entityId: user.id, meta });
    return { user: this.publicUser(updated), tokens: await this.issueTokens(updated, meta) };
  }

  private async recordFailedLogin(user: User, meta: RequestMeta, reason: string) {
    // Atomic increment avoids lost updates under parallel brute-force attempts.
    const { failedLogins } = await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: { increment: 1 } },
      select: { failedLogins: true },
    });
    const lock = failedLogins >= MAX_FAILED_LOGINS;
    if (lock) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCKOUT_MS) },
      });
    }
    await this.audit.log({
      orgId: user.orgId,
      actorId: user.id,
      action: lock ? 'auth.account_locked' : 'auth.login_failed',
      entity: 'User',
      entityId: user.id,
      metadata: { reason, failedLogins },
      meta,
    });
  }

  /** Refresh-token rotation with reuse detection. */
  async refresh(rawToken: string | undefined, meta: RequestMeta): Promise<IssuedTokens> {
    if (!rawToken) throw new UnauthorizedException('Missing refresh token');
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(rawToken) }, include: { user: true } });
    if (!stored) throw new UnauthorizedException('Invalid refresh token');

    if (stored.revokedAt) {
      const benign = stored.replacedBy && Date.now() - stored.revokedAt.getTime() < ROTATION_GRACE_MS;
      if (!benign) await this.handleTokenReuse(stored.familyId, stored.user, meta);
      throw new UnauthorizedException('Refresh token has been revoked');
    }
    if (stored.expiresAt < new Date() || !stored.user.isActive) throw new UnauthorizedException('Refresh token expired');

    const next = this.newRefreshToken();
    await this.prisma.$transaction(async (tx) => {
      const created = await tx.refreshToken.create({
        data: { tokenHash: next.hash, familyId: stored.familyId, userId: stored.userId, expiresAt: next.expiresAt, ...meta },
      });
      // Conditional update = optimistic lock: only one concurrent request can rotate a token.
      const { count } = await tx.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: new Date(), replacedBy: created.id },
      });
      if (count !== 1) throw new UnauthorizedException('Refresh token already used'); // rolls back `created`
    });

    return { accessToken: await this.signAccess(stored.user), refreshToken: next.raw };
  }

  private async handleTokenReuse(familyId: string, user: User, meta: RequestMeta) {
    this.logger.warn(`Refresh token reuse detected for user ${user.id}; revoking family ${familyId}`);
    await this.prisma.$transaction([
      this.prisma.refreshToken.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: new Date() } }),
      // Bumping tokenVersion also kills any access tokens the attacker may hold.
      this.prisma.user.update({ where: { id: user.id }, data: { tokenVersion: { increment: 1 } } }),
      this.prisma.auditLog.create({
        data: { orgId: user.orgId, actorId: user.id, action: 'auth.refresh_reuse_detected', entity: 'RefreshToken', entityId: familyId, ip: meta.ip, userAgent: meta.userAgent },
      }),
    ]);
    await this.sessions.invalidate(user.id);
  }

  async logout(rawToken: string | undefined, user: AuthUser | undefined, meta: RequestMeta) {
    if (!rawToken) return;
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(rawToken) } });
    if (!stored) return;
    await this.prisma.refreshToken.updateMany({ where: { familyId: stored.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
    const actor = user ?? (await this.prisma.user.findUnique({ where: { id: stored.userId } }));
    if (actor) {
      await this.audit.log({ orgId: actor.orgId, actorId: actor.id, action: 'auth.logout', entity: 'User', entityId: actor.id, meta });
    }
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { org: { select: { id: true, name: true, slug: true } } } });
    return { ...this.publicUser(user), org: user.org };
  }

  private async issueTokens(user: User, meta: RequestMeta): Promise<IssuedTokens> {
    const next = this.newRefreshToken();
    await this.prisma.refreshToken.create({
      data: { tokenHash: next.hash, familyId: randomUUID(), userId: user.id, expiresAt: next.expiresAt, ...meta },
    });
    return { accessToken: await this.signAccess(user), refreshToken: next.raw };
  }

  private signAccess(user: Pick<User, 'id' | 'orgId' | 'tokenVersion'>) {
    const payload: AccessTokenPayload = { sub: user.id, org: user.orgId, tv: user.tokenVersion };
    return this.jwt.signAsync(payload);
  }

  private newRefreshToken() {
    const raw = randomBytes(48).toString('base64url');
    return { raw, hash: sha256(raw), expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000) };
  }

  publicUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      orgId: user.orgId,
      permissions: ROLE_PERMISSIONS[user.role],
    };
  }
}

export type PublicUser = ReturnType<AuthService['publicUser']>;
