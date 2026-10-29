import { ThrottlerStorage } from '@nestjs/throttler';
import Redis from 'ioredis';

// Atomic fixed-window counter + block flag. Returns [hits, hitsTtlMs, blocked, blockTtlMs].
const INCREMENT_SCRIPT = `
local hitsKey, blockKey = KEYS[1], KEYS[2]
local ttl, limit, block = tonumber(ARGV[1]), tonumber(ARGV[2]), tonumber(ARGV[3])
local blockTtl = redis.call('PTTL', blockKey)
if blockTtl > 0 then
  return { tonumber(redis.call('GET', hitsKey) or '0'), redis.call('PTTL', hitsKey), 1, blockTtl }
end
local hits = redis.call('INCR', hitsKey)
if hits == 1 then redis.call('PEXPIRE', hitsKey, ttl) end
local hitsTtl = redis.call('PTTL', hitsKey)
if hits > limit then
  redis.call('SET', blockKey, '1', 'PX', block)
  return { hits, hitsTtl, 1, block }
end
return { hits, hitsTtl, 0, 0 }
`;

/**
 * Redis-backed storage for @nestjs/throttler so rate limits are shared across
 * every API instance (the default in-memory store is per-process).
 */
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redis: Redis) {}

  async increment(key: string, ttl: number, limit: number, blockDuration: number, throttlerName: string) {
    const prefix = `rl:${throttlerName}:${key}`;
    const [totalHits, hitsTtl, blocked, blockTtl] = (await this.redis.eval(
      INCREMENT_SCRIPT,
      2,
      `${prefix}:hits`,
      `${prefix}:block`,
      ttl,
      limit,
      blockDuration || ttl,
    )) as [number, number, number, number];

    return {
      totalHits,
      timeToExpire: Math.ceil(Math.max(hitsTtl, 0) / 1000),
      isBlocked: blocked === 1,
      timeToBlockExpire: Math.ceil(Math.max(blockTtl, 0) / 1000),
    };
  }
}
