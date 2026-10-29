# ADR-0008: Offset pagination for tables, cursor for the audit log

- **Status:** Accepted
- **Date:** 2026-10-22
- **Deciders:** Jyotsna
- **Related:** G5 · [ADR-0006](0006-transactions-and-append-only-audit-log.md)

## Context

Two kinds of lists:
- **Tables** (projects, users): users expect page numbers, totals and jumping between pages; sizes are moderate.
- **Audit log**: grows fastest, always appended at the head, read newest-first, can get very large.

With offset pagination, an append-heavy feed shows duplicate or skipped rows when new entries arrive between
page loads, and `OFFSET n` gets slower as `n` grows.

## Decision

- **Offset** ([pagination.ts](../../apps/api/src/common/pagination.ts) `PageQueryDto`): `?page=&limit=` →
  `{ data, meta: { page, limit, total, totalPages } }`. Rows and count are read in one batch transaction.
  Sorting always adds `id` as a tiebreaker for a stable order.
- **Cursor** (`CursorQueryDto`): `?cursor=<lastId>&limit=` → `{ data, nextCursor }`, ordered by
  `(createdAt DESC, id DESC)`, backed by index `@@index([orgId, createdAt(sort: Desc), id])`. Fetch `limit + 1`
  rows to know whether another page exists, without a COUNT.
- `limit` is validated to 1–100 for both (prevents unbounded queries).
- UI: Prev/Next links that keep filters in the URL for tables; "Load more" for the audit log.

## Consequences

**Positive** — each list gets the right trade-off; cursor pages are stable and cost the same at any depth.
**Negative** — two patterns to learn; the cursor style can't jump to page N or show totals; `COUNT(*)` on big tables would eventually need caching or estimates.
**Follow-ups** — encode cursors opaquely (base64 of createdAt+id) if the API becomes public.

## Alternatives considered

| Option | Why not |
|---|---|
| Offset everywhere | Unstable and slow for the append-heavy audit log |
| Cursor everywhere | Tables lose page numbers and totals that users expect |
| Keyset on `createdAt` only | Not unique; ties break pagination |
