# ADR-0006: Write + audit in one transaction; Serializable for invariants

- **Status:** Accepted
- **Date:** 2026-10-22
- **Deciders:** Jyotsna
- **Related:** G4, G9, G10

## Context

Two consistency needs:
1. An audit trail is only trustworthy if every change has its audit entry, and no audit entry exists for a
   change that rolled back.
2. Some business rules span rows. "An org must keep at least one active admin" can be broken by two admins
   demoting each other at the same moment: each transaction sees the other admin still present and passes the check.

## Decision

- Every mutating service method runs in `prisma.$transaction(async (tx) => …)` and writes its audit row
  with the **same `tx`** (`audit.log(entry, tx)`), e.g. register (org + admin + 2 audit rows), invite,
  project create/update/delete. Project updates record a `{field: {from, to}}` diff.
- Role and status changes use **`isolationLevel: Serializable`**; Postgres aborts one of two conflicting
  transactions (`P2034`), which the API maps to **409 "please retry"**
  ([prisma-exception.filter.ts](../../apps/api/src/common/prisma-exception.filter.ts)).
- Refresh rotation uses a conditional `updateMany … WHERE revokedAt IS NULL` (an optimistic lock) inside its transaction.
- Read pairs (`findMany` + `count`) use a batch `$transaction([...])` so page data and totals come from one snapshot.
- The **audit log is append-only**: no update/delete endpoints. It records security events (failed logins,
  lockouts, access denials, token reuse) as well as data changes, with IP and user agent.
- Side effects outside the database (cache version bump, session invalidation) run **after** commit.

## Consequences

**Positive** — no change without its audit entry, and no audit entry without its change; the last-admin rule holds under concurrency; clients get clear 409s.
**Negative** — Serializable transactions can abort under contention (rare for admin actions); a crash between commit and cache bump leaves a stale cache until its TTL (≤60 s, accepted).
**Follow-ups** — audit retention/export; tamper evidence (hash chain) if needed for compliance.

## Alternatives considered

| Option | Why not |
|---|---|
| Audit via async events/queue | Can lose entries or record changes that rolled back; needs an outbox for correctness |
| Postgres triggers for audit | Loses request context (actor, IP) unless passed through session variables |
| `SELECT … FOR UPDATE` for last-admin | Works, but Prisma lacks first-class row locking; Serializable is declarative |
