import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AuditService } from '../audit/audit.service';
import { extractAccessToken } from '../auth/cookies';
import { SessionService } from '../auth/session.service';
import { AccessTokenPayload, requestMeta } from './auth-user';
import { IS_PUBLIC_KEY, PERMISSIONS_KEY } from './decorators';
import { hasPermissions, Permission } from './rbac';

/** Global guard: every route requires a valid access token unless marked @Public(). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    const token = extractAccessToken(req);
    if (!token) throw new UnauthorizedException('Authentication required');

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const session = await this.sessions.get(payload.sub);
    if (!session || !session.isActive || session.tokenVersion !== payload.tv || session.orgId !== payload.org) {
      throw new UnauthorizedException('Session is no longer valid');
    }

    req.user = { id: payload.sub, orgId: session.orgId, email: session.email, name: session.name, role: session.role };
    return true;
  }
}

/** Global guard: enforces @RequirePermissions(...) against the caller's current role. */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!required?.length) return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    const user = req.user;
    if (!user) throw new UnauthorizedException();
    if (hasPermissions(user.role, required)) return true;

    // Denied attempts are security-relevant: record them (fire-and-forget).
    void this.audit
      .log({
        orgId: user.orgId,
        actorId: user.id,
        action: 'access.denied',
        entity: 'Route',
        entityId: `${req.method} ${req.route?.path ?? req.path}`,
        metadata: { role: user.role, required },
        meta: requestMeta(req),
      })
      .catch(() => undefined);
    throw new ForbiddenException('Insufficient permissions');
  }
}
