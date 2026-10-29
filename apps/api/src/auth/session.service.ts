import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

export interface SessionState {
  email: string;
  name: string;
  role: Role;
  orgId: string;
  isActive: boolean;
  tokenVersion: number;
}

const TTL_SECONDS = 300;

/**
 * Per-request auth state (role, active flag, token version), cached in Redis.
 * Because the role is read from here — not from the JWT — role changes and
 * deactivations take effect on the very next request after `invalidate()`.
 */
@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private key(userId: string) {
    return `session:user:${userId}`;
  }

  async get(userId: string): Promise<SessionState | null> {
    const { value } = await this.redis.wrap(this.key(userId), TTL_SECONDS, () =>
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true, role: true, orgId: true, isActive: true, tokenVersion: true },
      }),
    );
    return value;
  }

  invalidate(userId: string) {
    return this.redis.del(this.key(userId));
  }
}
