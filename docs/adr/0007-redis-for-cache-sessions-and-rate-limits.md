# ADR-0007: Redis for cache (version keys), sessions and rate limits

- **Status:** Accepted
- **Date:** 2026-10-22
- **Deciders:** Jyotsna
- **Related:** G6, G8 · [ADR-0003](0003-cookie-sessions-with-rotating-refresh-tokens.md), [ADR-0004](0004-permission-based-rbac.md)

## Context

Three needs share the same shape: fast, shared, expiring key-value state.
1. Project lists and dashboard stats are read far more often than written.
2. Every authenticated request needs the user's current role/active/tokenVersion ([ADR-0004](0004-permission-based-rbac.md)).
3. Rate limits must hold across multiple API instances; the default in-memory throttler counts per process.

Cache invalidation must be correct (no stale data after a write) and cheap.

## Decision

One Redis instance (`ioredis`, [redis.service.ts](../../apps/api/src/redis/redis.service.ts)) used three ways:

- **Response cache (cache-aside).** Keys embed a per-org **version**: `cache:org:{orgId}:projects:v{n}:{hash(query)}`.
  Writes `INCR ver:org:{orgId}:projects` after commit; old keys become unreachable and expire by TTL
  (lists 60 s, stats 30 s). Responses carry `X-Cache: HIT|MISS`.
- **Session cache.** `session:user:{id}` (5-min TTL), deleted on role/status change.
- **Rate-limit storage.** A custom `ThrottlerStorage` ([redis-throttler.storage.ts](../../apps/api/src/common/redis-throttler.storage.ts))
  uses one atomic Lua script (INCR + PEXPIRE + block flag). Limits: 100/min global per IP; login 5, register 3,
  refresh 30 per min. Per-IP limits are complemented by per-account lockout ([ADR-0003](0003-cookie-sessions-with-rotating-refresh-tokens.md)).
- **Graceful degradation:** cache helpers swallow Redis errors and fall back to Postgres; `/api/health` reports `cache: down`.
- Redis runs with `maxmemory 128mb` + `allkeys-lru` and no persistence: everything in it can be rebuilt.

## Consequences

**Positive** — O(1) invalidation with no `KEYS`/`SCAN`; correct after writes; limits shared across instances; Redis outage slows the API but doesn't break it.
**Negative** — orphaned keys occupy memory until TTL (bounded by LRU); stale reads possible for ≤ TTL if a version bump fails; if Redis is down, the throttler errors (a fail-closed choice not yet handled gracefully).
**Follow-ups** — decide fail-open vs fail-closed for rate limiting during Redis outages; per-org quotas.

## Alternatives considered

| Option | Why not |
|---|---|
| Delete keys by wildcard on write | `KEYS`/`SCAN` is O(N) and racy |
| Next.js fetch cache / ISR | Per-user data behind auth; invalidation would live in the wrong tier |
| In-memory LRU in the API | Not shared across instances; lost on restart |
| `@nest-lab/throttler-storage-redis` | Viable; ~40 lines of our own Lua avoids a dependency and shows the mechanism |
