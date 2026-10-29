# ADR-0005: Shared-schema multi-tenancy scoped by `orgId`

- **Status:** Accepted
- **Date:** 2026-10-22
- **Deciders:** Jyotsna
- **Related:** G3, G8 · [ADR-0004](0004-permission-based-rbac.md)

## Context

Many organizations share one deployment. One tenant reading or changing another's data is the most
serious failure a SaaS can have. We need isolation that is simple to apply consistently and works with Prisma.

## Decision

- **One database, one schema.** Every tenant-owned table has `orgId` (FK → `Organization`, `onDelete: Cascade`)
  and composite indexes starting with `orgId`.
- **`orgId` always comes from the authenticated session**, never from the request body or params. DTOs
  don't accept it (`forbidNonWhitelisted` rejects it outright).
- Single-record access uses `findFirst({ where: { id, orgId } })` / `deleteMany({ where: { id, orgId } })`;
  a record in another org is indistinguishable from a missing one → **404, not 403**.
- Redis cache keys are namespaced by org (`cache:org:{orgId}:…`).
- Verified by `npm run demo` §3 (a Globex admin can't read or edit Acme projects).

## Consequences

**Positive** — simple, cheap, one migration path; cross-org reporting is easy; 404 hides which records exist.
**Negative** — isolation depends on every query including `orgId` (a developer mistake can leak data). Mitigated by CLAUDE.md rules, the `/add-api-feature` checklist and demo tests, not by the database.
**Follow-ups** — Postgres Row-Level Security as defence in depth; a Prisma extension that injects `orgId` automatically.

## Alternatives considered

| Option | Why not |
|---|---|
| Schema-per-tenant | Migration fan-out, connection pool pressure, Prisma friction |
| Database-per-tenant | Strongest isolation but heavy operations; overkill for this scope |
| Postgres RLS now | Needs per-request `SET app.org_id` with Prisma (interactive tx or extension); deferred as a follow-up |
