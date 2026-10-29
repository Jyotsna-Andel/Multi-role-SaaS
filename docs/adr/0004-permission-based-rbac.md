# ADR-0004: Permission-based RBAC, role resolved per request

- **Status:** Accepted
- **Date:** 2026-10-22
- **Deciders:** Jyotsna
- **Related:** G3, G10 · [ADR-0003](0003-cookie-sessions-with-rotating-refresh-tokens.md)

## Context

Three roles (ADMIN, MANAGER, MEMBER) need different capabilities. Role checks like `if role === 'ADMIN'`
scattered through code are hard to audit and to change. Role changes should apply immediately, but a
role embedded in a 15-minute JWT would stay stale until it expires.

## Decision

- Roles map to **permissions** in one table, [rbac.ts](../../apps/api/src/common/rbac.ts):

  | Permission | ADMIN | MANAGER | MEMBER |
  |---|:-:|:-:|:-:|
  | `project:read` | ✓ | ✓ | ✓ |
  | `project:write` | ✓ | ✓ | |
  | `project:delete` | ✓ | | |
  | `user:read` | ✓ | ✓ | |
  | `user:manage` | ✓ | | |
  | `audit:read` | ✓ | | |

- Endpoints declare `@RequirePermissions(...)`; a global `PermissionsGuard` enforces it after the global
  `JwtAuthGuard`. Denials are written to the audit log (`access.denied`).
- The **role is not trusted from the JWT**. `JwtAuthGuard` loads `{role, isActive, tokenVersion, orgId}` from
  a Redis-cached session ([session.service.ts](../../apps/api/src/auth/session.service.ts), 5-min TTL);
  role/status changes call `sessions.invalidate(userId)`.
- The web app receives the permission list from `/auth/me` and uses it only to hide UI.
- Organization-level invariant: at least one active ADMIN must remain ([ADR-0006](0006-transactions-and-append-only-audit-log.md)).

## Consequences

**Positive** — one place to review or change access; endpoints read as "needs X", not "is Y"; promotions/demotions apply on the next request.
**Negative** — session lookup per request; permissions are static per role (no per-user overrides).
**Follow-ups** — custom roles per org would move the map into the database.

## Alternatives considered

| Option | Why not |
|---|---|
| `@Roles('ADMIN')` checks | Couples endpoints to role names; adding a role means editing many endpoints |
| Role in JWT only | Stale for up to 15 minutes after a change |
| ABAC / policy engine (CASL, OPA) | More power than three static roles need |
