import { Global, Injectable, Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import Redis from 'ioredis';

export interface Cached<T> {
  value: T;
  hit: boolean;
}

/**
 * Thin Redis wrapper. Cache reads/writes never throw: if Redis is down the API
 * keeps serving from Postgres (graceful degradation).
 *
 * Invalidation uses namespace *versions*: keys embed `v{n}` and a write simply
 * INCRs the version, orphaning old entries (they expire via TTL). This avoids
 * expensive SCAN/DEL over wildcard keys.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;

  constructor(config: ConfigService) {
    this.client = new Redis(config.getOrThrow<string>('REDIS_URL'), { maxRetriesPerRequest: 2 });
    this.client.on('error', (err) => this.logger.warn(`Redis error: ${err.message}`));
  }

  async getJson<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      /* cache is best-effort */
    }
  }

  async del(...keys: string[]): Promise<void> {
    try {
      if (keys.length) await this.client.del(...keys);
    } catch {
      /* best-effort */
    }
  }

  async version(namespace: string): Promise<number> {
    try {
      return Number((await this.client.get(`ver:${namespace}`)) ?? 0);
    } catch {
      return 0;
    }
  }

  async bumpVersion(namespace: string): Promise<void> {
    try {
      await this.client.incr(`ver:${namespace}`);
    } catch {
      /* best-effort; entries still expire via TTL */
    }
  }

  /** Cache-aside helper: return cached value or compute + store it. */
  async wrap<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<Cached<T>> {
    const cached = await this.getJson<T>(key);
    if (cached !== null) return { value: cached, hit: true };
    const value = await compute();
    await this.setJson(key, value, ttlSeconds);
    return { value, hit: false };
  }

  static hash(input: unknown): string {
    return createHash('sha1').update(JSON.stringify(input)).digest('hex').slice(0, 16);
  }

  async onModuleDestroy() {
    await this.client.quit().catch(() => undefined);
  }
}

@Global()
@Module({ providers: [RedisService], exports: [RedisService] })
export class RedisModule {}
