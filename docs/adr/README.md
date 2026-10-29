# Architecture Decision Records

An ADR captures **one** significant decision: the context that forced it, what we chose, what it costs,
and what we rejected. ADRs are immutable once accepted — to change a decision, write a new ADR that
**supersedes** the old one and update the old one's status line. Format: [Michael Nygard's template](0000-template.md).

**Write an ADR when** a choice is hard to reverse, affects security or data integrity, spans both apps,
or a reasonable engineer might ask "why didn't you just…?". Use `/new-adr` to create one.

**Statuses:** Proposed → Accepted → (Deprecated | Superseded by ADR-NNNN)

## Index

| ADR | Title | Status | Date |
|---|---|---|---|
| [0001](0001-record-architecture-decisions.md) | Record architecture decisions | Accepted | 2026-10-22 |
| [0002](0002-monorepo-with-next-proxy-to-nest.md) | Monorepo; Next.js proxies `/api` to NestJS | Accepted | 2026-10-22 |
| [0003](0003-cookie-sessions-with-rotating-refresh-tokens.md) | Cookie sessions: short JWT + rotating refresh tokens | Accepted | 2026-10-22 |
| [0004](0004-permission-based-rbac.md) | Permission-based RBAC, role resolved per request | Accepted | 2026-10-22 |
| [0005](0005-shared-schema-multi-tenancy.md) | Shared-schema multi-tenancy scoped by `orgId` | Accepted | 2026-10-22 |
| [0006](0006-transactions-and-append-only-audit-log.md) | Write + audit in one transaction; Serializable for invariants | Accepted | 2026-10-22 |
| [0007](0007-redis-for-cache-sessions-and-rate-limits.md) | Redis for cache (version keys), sessions and rate limits | Accepted | 2026-10-22 |
| [0008](0008-pagination-strategy.md) | Offset pagination for tables, cursor for the audit log | Accepted | 2026-10-22 |
| [0009](0009-pin-prisma-6-and-next-15.md) | Pin Prisma 6 and Next.js 15.5 | Accepted | 2026-10-22 |
| [0010](0010-app-router-data-fetching-and-route-protection.md) | App Router: server-side fetching + middleware silent refresh | Accepted | 2026-10-22 |
| [0011](0011-plain-css-design-tokens.md) | Plain CSS with design tokens, no UI framework | Accepted | 2026-10-22 |
