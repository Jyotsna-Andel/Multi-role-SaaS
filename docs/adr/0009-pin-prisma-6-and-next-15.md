# ADR-0009: Pin Prisma 6 and Next.js 15.5

- **Status:** Accepted
- **Date:** 2026-10-22
- **Deciders:** Jyotsna
- **Related:** G1, G7 · [CONTEXT.md](../CONTEXT.md) §5 (time-boxed)

## Context

Newer majors exist with breaking changes relevant to this codebase:
- **Prisma 7** requires driver adapters and a `prisma.config.ts`, and changes client generation.
- **Next.js 16** renames `middleware.ts` → `proxy.ts` and changes related conventions.

The project is time-boxed and assessed on architecture, not on tracking release churn.

## Decision

- `apps/api`: `prisma` / `@prisma/client` `^6.16` (resolved 6.19.x); NestJS 11.
- `apps/web`: `next` **15.5.4** (exact), React 19.1.1 (exact). Middleware stays `src/middleware.ts` with `runtime: 'nodejs'`.
- Other dependencies use caret ranges within their current major.

## Consequences

**Positive** — stable, well-documented APIs; reproducible installs; no mid-project migrations.
**Negative** — not on the newest features; a future upgrade has known work (Prisma adapters; rename to `proxy.ts`).
**Follow-ups** — upgrade both in a dedicated change with a superseding ADR, re-running `npm run demo` and `npm run ui-check`.

## Alternatives considered

| Option | Why not |
|---|---|
| Latest majors | Breaking changes with no benefit to the brief |
| Floating `latest` tags | Non-reproducible builds |
