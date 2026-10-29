import { Role } from '@prisma/client';
import type { Request } from 'express';

export interface AuthUser {
  id: string;
  orgId: string;
  email: string;
  name: string;
  role: Role;
}

export interface AccessTokenPayload {
  sub: string;
  org: string;
  /** token version — must match the user's current tokenVersion */
  tv: number;
}

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

export function requestMeta(req: Request): RequestMeta {
  return { ip: req.ip, userAgent: req.headers['user-agent']?.slice(0, 255) };
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
