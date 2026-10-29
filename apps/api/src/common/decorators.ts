import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import { AuthUser, requestMeta, RequestMeta } from './auth-user';
import { Permission } from './rbac';

export const IS_PUBLIC_KEY = 'isPublic';
/** Opt a route out of authentication (auth is on by default for every route). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...permissions: Permission[]) => SetMetadata(PERMISSIONS_KEY, permissions);

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest<Request>().user!,
);

export const ReqMeta = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): RequestMeta => requestMeta(ctx.switchToHttp().getRequest<Request>()),
);
