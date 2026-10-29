# Progress & decisions

Last updated: 2026-10-29 · Why the project exists and what's in scope: [CONTEXT.md](CONTEXT.md)

## Requirement status

Brief: *P2 — Multi-role SaaS · Next.js + NestJS + Postgres + Prisma · Auth, RBAC, transactions, pagination ·
Redis cache · Next.js App Router · Security, rate limits, audit logs · Admin/user flows + secure auth ·
Architecture diagram + demo*

| Requirement | Status | Where |
|---|---|---|
| Auth (register / login / refresh / logout / me) | ✅ | `apps/api/src/auth/` |
| Secure auth: httpOnly cookies, refresh rotation + reuse detection, lockout, timing-safe login | ✅ | `auth.service.ts`, `cookies.ts` |
| RBAC (ADMIN / MANAGER / MEMBER → permissions) | ✅ | `common/rbac.ts`, `common/guards.ts` |
| Multi-tenant isolation (org-scoped queries) | ✅ | every service; demo §3 |
| Transactions (register, invite, role change w/ Serializable, refresh rotation, write + audit) | ✅ | `auth.service.ts`, `users.service.ts`, `projects.service.ts` |
| Pagination: offset (projects, users) + cursor (audit log) | ✅ | `common/pagination.ts`, `audit.service.ts` |
| Redis: cache-aside + version invalidation, session cache, rate-limit storage | ✅ | `redis/`, `auth/session.service.ts`, `common/redis-throttler.storage.ts` |
| Rate limits: global 100/min, login 5/min, register 3/min, refresh 30/min | ✅ | `app.module.ts`, `auth.controller.ts` |
| Security: helmet, CORS, Origin check, DTO whitelist, body limit, env validation, safe redirects | ✅ | `main.ts`, `config/env.ts`, `web/src/lib/safe-next.ts` |
| Audit logs (append-only, incl. failed logins, denials, token theft) | ✅ | `audit/` |
| Next.js App Router UI: login/register, dashboard, projects, admin users, audit | ✅ | `apps/web/src/app/` |
| Admin/user flows: invite, change role, deactivate, role-aware UI | ✅ | `users/`, `web/src/app/(app)/admin/` |
| Demo (automated) | ✅ 44/44 passing | `scripts/demo.mjs` |
| UI flow checks (middleware, proxy login, SSR, role-gated UI, silent refresh) | ✅ 11/11 passing | `scripts/ui-check.mjs` |
| AI/dev workflow: `CLAUDE.md`, this tracker, skills `/run-demo`, `/add-api-feature`, `/update-progress`, `/new-adr` | ✅ | `CLAUDE.md`, `.claude/skills/` |
| Engagement context + ADRs 0001–0011 | ✅ links verified | `docs/CONTEXT.md`, `docs/adr/` |
| Architecture diagrams (system, request pipeline, auth sequence, ER, caching) + security controls | ✅ all 5 Mermaid diagrams render (mermaid-cli 11.4.2) | `docs/ARCHITECTURE.md` |
| README: quick start, demo accounts, verification, presenter walkthrough, troubleshooting | ✅ | `README.md` |
| One-command setup on a fresh clone (generates `apps/api/.env` with random secret) | ✅ tested on fresh + existing checkout | `scripts/setup-env.mjs`, `npm run setup` |
| Git repo (`main`), LF line endings enforced | ✅ initial commit on `main` (`git log`) | `.gitattributes` |
| Push to remote (GitHub/GitLab) | ⏳ waiting on target + account | — |

## Decisions

Recorded as ADRs — full index and template in [adr/README.md](adr/README.md). Summary:

| ADR | Decision in one line |
|---|---|
| [0002](adr/0002-monorepo-with-next-proxy-to-nest.md) | Two apps in one repo; Next proxies `/api` so cookies are first-party |
| [0003](adr/0003-cookie-sessions-with-rotating-refresh-tokens.md) | httpOnly cookies, 15-min JWT, rotating hashed refresh tokens with theft detection, lockout |
| [0004](adr/0004-permission-based-rbac.md) | Endpoints require permissions; role re-read per request from Redis session cache |
| [0005](adr/0005-shared-schema-multi-tenancy.md) | One schema, every query scoped by session `orgId`; cross-tenant → 404 |
| [0006](adr/0006-transactions-and-append-only-audit-log.md) | Change + audit row in one transaction; Serializable for the last-admin rule |
| [0007](adr/0007-redis-for-cache-sessions-and-rate-limits.md) | Redis for version-key cache, sessions and shared rate limits |
| [0008](adr/0008-pagination-strategy.md) | Offset pages for tables, cursor for the audit log |
| [0009](adr/0009-pin-prisma-6-and-next-15.md) | Pin Prisma 6 / Next 15.5 |
| [0010](adr/0010-app-router-data-fetching-and-route-protection.md) | Server Components fetch; middleware refreshes silently; admin gated on server |
| [0011](adr/0011-plain-css-design-tokens.md) | Plain CSS with tokens |

## Known limitations / next ideas

- If Redis is down, the rate limiter throws (requests fail with 500) while the cache degrades gracefully — decide fail-open vs fail-closed ([ADR-0007](adr/0007-redis-for-cache-sessions-and-rate-limits.md)).
- Tenant isolation relies on application code; Postgres RLS would add defence in depth ([ADR-0005](adr/0005-shared-schema-multi-tenancy.md)).
- `docs/CONTEXT.md` still has two `TODO`s only the author can fill: reviewer name, review/demo date.
- Invites return a one-time temp password instead of an emailed invite link; no forced password change on first login.
- No password reset / email verification / MFA.
- No Content-Security-Policy header yet (Next dev needs `unsafe-eval`; add nonce-based CSP for prod).
- No unit tests; `scripts/demo.mjs` acts as the e2e suite. Candidates: RBAC map, refresh rotation, last-admin invariant.
- `scripts/ui-check.mjs` inspects server-rendered HTML; a Playwright suite would also cover client interactions (modals, role dropdown).
- No Dockerfiles for api/web (only infra in compose); no CI pipeline.
- Audit log has no retention/export; no per-org rate limits or plans/billing.
