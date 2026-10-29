import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RequestMeta } from '../common/auth-user';
import { CursorPage } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  orgId: string;
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
  meta?: RequestMeta;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Pass `tx` to write the audit row inside the caller's transaction, so the
   * business change and its audit trail commit (or roll back) together.
   */
  log(entry: AuditEntry, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prisma;
    return db.auditLog.create({
      data: {
        orgId: entry.orgId,
        actorId: entry.actorId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        metadata: entry.metadata,
        ip: entry.meta?.ip,
        userAgent: entry.meta?.userAgent,
      },
    });
  }

  async list(orgId: string, q: { cursor?: string; limit: number; action?: string }): Promise<CursorPage<unknown>> {
    const rows = await this.prisma.auditLog.findMany({
      where: { orgId, ...(q.action ? { action: { startsWith: q.action } } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: q.limit + 1, // fetch one extra to know whether another page exists
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      include: { actor: { select: { id: true, name: true, email: true } } },
    });
    const hasMore = rows.length > q.limit;
    const data = hasMore ? rows.slice(0, q.limit) : rows;
    return { data, nextCursor: hasMore ? data[data.length - 1].id : null };
  }
}
