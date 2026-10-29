# Engagement context

| | |
|---|---|
| **Project** | TeamSpace — Multi-role SaaS (training track item **P2**) |
| **Type** | Training / assessment project |
| **Author** | Jyotsna |
| **Reviewer** | Tech lead / mentor — `TODO: name` |
| **Started** | 2026-10-22 |
| **Review / demo date** | `TODO` |
| **Status** | See [PROGRESS.md](PROGRESS.md) |

## 1. Why this project exists

Most production SaaS products share the same hard parts: many customers (tenants) on one system, people
with different permissions inside each customer, and the security, consistency and performance concerns
that come with that. This project builds a small but **production-shaped** slice of such a product to
demonstrate, and be assessed on, end-to-end ownership of those concerns across a modern TypeScript stack.

The business domain is deliberately simple (organizations, users, projects) so the effort goes into
architecture, not features.

## 2. The brief (verbatim)

> P2 · Multi-role SaaS · Next.js + NestJS + Postgres + Prisma · Auth, RBAC, transactions, pagination ·
> Redis cache · Next.js App Router · Security, rate limits, audit logs · Admin/user flows + secure auth ·
> Architecture diagram + demo

## 3. Goals and how each is evaluated

Each goal has a way for the reviewer to check it themselves.

| # | Goal (from brief) | Evidence for the reviewer |
|---|---|---|
| G1 | Stack: Next.js + NestJS + Postgres + Prisma | `apps/web`, `apps/api`, `apps/api/prisma/schema.prisma` |
| G2 | Secure auth | `npm run demo` §1, §7 · [ADR-0003](adr/0003-cookie-sessions-with-rotating-refresh-tokens.md) |
| G3 | RBAC | `npm run demo` §2 · `apps/api/src/common/rbac.ts` · [ADR-0004](adr/0004-permission-based-rbac.md) |
| G4 | Transactions | `npm run demo` §6 · [ADR-0006](adr/0006-transactions-and-append-only-audit-log.md) |
| G5 | Pagination | `npm run demo` §4 · [ADR-0008](adr/0008-pagination-strategy.md) |
| G6 | Redis cache | `npm run demo` §5 (MISS → HIT → MISS after write) · [ADR-0007](adr/0007-redis-for-cache-sessions-and-rate-limits.md) |
| G7 | Next.js App Router | `apps/web/src/app/` · `npm run ui-check` · [ADR-0010](adr/0010-app-router-data-fetching-and-route-protection.md) |
| G8 | Security & rate limits | `npm run demo` §1, §2, §8 · [ADR-0003](adr/0003-cookie-sessions-with-rotating-refresh-tokens.md), [ADR-0007](adr/0007-redis-for-cache-sessions-and-rate-limits.md) |
| G9 | Audit logs | `npm run demo` §9 · Admin → Audit log page |
| G10 | Admin / user flows | Admin → Users page (invite, role change, deactivate) · `npm run demo` §6 |
| G11 | Architecture diagram | [ARCHITECTURE.md](ARCHITECTURE.md) — system, request pipeline, auth sequence, data model, caching |
| G12 | Demo | `npm run demo` (44 checks), `npm run ui-check` (11 checks), [presenter walkthrough](../README.md#presenter-walkthrough-10-min) |

**Done means:** every row above has passing evidence, `npm run demo` ends `0 failed`, and the reviewer can
set the project up from the README alone.

## 4. Scope

**In scope**
- Multi-tenant model: organizations, users with one role per organization, projects.
- Three roles (ADMIN, MANAGER, MEMBER) mapped to fine-grained permissions.
- Registration (creates an organization), login, logout, silent session refresh.
- Admin flows: invite user, change role, deactivate/reactivate, view audit log.
- Projects CRUD with search, filter, sort and pagination.
- Defensive security: rate limiting, account lockout, token-theft detection, input validation, CSRF/XSS mitigations.
- Local developer setup with Docker; an automated end-to-end demo.

**Out of scope (non-goals)** — deliberately excluded to keep the focus on architecture
- Email delivery (invites, password reset, verification) — invites return a one-time temp password instead.
- MFA / SSO / OAuth providers.
- Billing, plans, usage quotas.
- A user belonging to multiple organizations.
- Production deployment, CI/CD, observability stack.
- Comprehensive unit-test suite (the e2e demo scripts are the verification layer).

These are listed as follow-ups in [PROGRESS.md](PROGRESS.md#known-limitations--next-ideas).

## 5. Constraints and assumptions

- **Time-boxed** training project; prefer depth on the brief's concerns over breadth of features.
- Runs fully locally: Node 24, Docker (Postgres 16, Redis 7). No paid or cloud services.
- Dev machine already uses port 5432 → Postgres is mapped to **5433**, Redis to **6380**.
- Stable major versions pinned (Prisma 6, Next 15.5) — see [ADR-0009](adr/0009-pin-prisma-6-and-next-15.md).
- Demo data only; no real personal data. All seeded accounts share one public password.

## 6. Stakeholders

| Role | Who | Interest |
|---|---|---|
| Author / developer | Jyotsna | Build, explain and defend the design |
| Reviewer | Tech lead / mentor (`TODO`) | Correctness, security, architecture reasoning, code quality |
| Future maintainers (incl. AI assistants) | — | Understand rules and decisions quickly: [CLAUDE.md](../CLAUDE.md), [ADRs](adr/README.md) |

## 7. Review checklist (for demo day)

1. `npm run setup` from a clean clone works using the README alone.
2. `npm run dev:api` + `npm run dev:web`, then `npm run demo` → 44 passed, 0 failed.
3. Live UI tour: login as Member → Manager → Admin; show role-gated UI, cache badge, audit log.
4. Walk through the architecture diagram and 2–3 ADRs (suggested: 0003 auth, 0005 tenancy, 0007 Redis).
5. Discuss limitations and what production would add (PROGRESS.md).

## 8. Glossary

| Term | Meaning here |
|---|---|
| **Tenant / Organization (org)** | A customer company. All data belongs to exactly one org; orgs never see each other's data. |
| **Role** | ADMIN, MANAGER or MEMBER — assigned per user within their org. |
| **Permission** | A single capability, e.g. `project:write`. Roles are bundles of permissions; endpoints require permissions. |
| **Access token** | Short-lived (15 min) signed JWT in an httpOnly cookie; proves identity on each request. |
| **Refresh token** | Long-lived (7 d) random token in an httpOnly cookie; exchanged for a new access token and rotated on every use. |
| **Token family** | All refresh tokens descending from one login. Reusing an old one revokes the whole family (theft detection). |
| **Token version (`tv`)** | Counter on the user; bumping it instantly invalidates all their access tokens. |
| **Audit log** | Append-only record of who did what, when, from which IP. |
| **Cache version key** | Redis counter per org; incrementing it makes all cached lists for that org stale at once. |
| **ADR** | Architecture Decision Record — a short document capturing one significant decision and its reasoning. |
