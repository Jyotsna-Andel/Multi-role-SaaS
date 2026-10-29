# TeamSpace — Multi-role SaaS

A small, production-shaped **multi-tenant SaaS**: organizations share one deployment, never see each
other's data, and their users are **Admins**, **Managers** or **Members** with different permissions.
Built as training project **P2** with Next.js (App Router), NestJS, PostgreSQL/Prisma and Redis.

| | |
|---|---|
| **Architecture & diagrams** | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| **Why each design choice** | [docs/adr/](docs/adr/README.md) (11 ADRs) |
| **Brief, goals, scope** | [docs/CONTEXT.md](docs/CONTEXT.md) |
| **Status & known limitations** | [docs/PROGRESS.md](docs/PROGRESS.md) |

## Features

| Brief item | What's implemented |
|---|---|
| **Secure auth** | httpOnly cookies only · 15-min JWT + 7-day refresh token rotated on every use, hashed at rest · stolen-token reuse detection · account lockout · no user enumeration |
| **RBAC** | Roles map to permissions (`project:write`, `user:manage`, …); every route declares what it needs; role changes apply on the next request |
| **Multi-tenancy** | Every query scoped by the session's `orgId`; other tenants' records return 404 |
| **Transactions** | Each change and its audit entry commit together; "always keep one admin" enforced with a Serializable transaction |
| **Pagination** | Page numbers for projects/users; cursor ("load more") for the audit log |
| **Redis** | Response cache with version-key invalidation (`X-Cache: HIT/MISS`), session cache, shared rate-limit counters |
| **Rate limits** | 100 req/min per IP; login 5/min, register 3/min, refresh 30/min |
| **Audit logs** | Append-only; logins, failures, lockouts, permission denials, token theft, role changes, data changes with before/after |
| **Admin / user flows** | Invite users, change roles, deactivate (signs them out everywhere), audit log viewer |
| **App Router** | Server Components fetch data, middleware renews sessions silently, admin area guarded on the server |

## Quick start

**Prerequisites:** Node.js 22+ (developed on 24), Docker Desktop running, ports 3000, 4000, 5433, 6380 free.

```bash
npm run setup      # creates apps/api/.env (random secret), starts Postgres + Redis,
                   # installs dependencies, runs migrations, seeds demo data
```

Then, in two terminals:

```bash
npm run dev:api    # NestJS  → http://localhost:4000/api   (wait for "API listening")
npm run dev:web    # Next.js → http://localhost:3000
```

Open **http://localhost:3000** and use a one-click demo account.

### Demo accounts

Password for all: **`Password123!`**

| Email | Organization | Role |
|---|---|---|
| `admin@acme.test` | Acme Inc (42 projects) | Admin |
| `manager@acme.test` | Acme Inc | Manager |
| `member@acme.test` | Acme Inc | Member |
| `intern@acme.test` | Acme Inc | Member (used by the lockout test) |
| `admin@globex.test` | Globex Corp (7 projects) | Admin |

## Verify it works

With both servers running:

```bash
npm run demo       # 44 end-to-end API checks: auth, RBAC, tenancy, pagination, cache,
                   # transactions, token theft, rate limits, audit — expect "44 passed, 0 failed"
npm run ui-check   # 11 UI flow checks: redirects, login via proxy, SSR, role-gated pages, silent refresh
npm run db:seed    # afterwards: reset demo data (the demo locks intern@acme.test for 15 min)
```

## Presenter walkthrough (~10 min)

1. **Architecture (2 min):** walk through the system diagram and request pipeline in [ARCHITECTURE.md](docs/ARCHITECTURE.md).
2. **Member (1 min):** sign in as **Acme · Member**. Projects are read-only; no Admin menu. Type `/admin/users` in the address bar → *Not authorized*.
3. **Manager (1 min):** sign out, sign in as **Acme · Manager**. Create a project; note there's **Edit** but no **Delete**.
4. **Admin (3 min):** sign in as **Acme · Admin**.
   - **Dashboard:** note the cache badge. Reload → **MISS** becomes **HIT** (served by Redis).
   - **Projects:** search "Apollo", filter by status, page through results; the URL keeps the filters.
   - **Users:** invite someone (one-time temp password shown); change Member → Manager; try demoting yourself → blocked: *must keep at least one active admin*.
   - **Audit log:** every action above is listed; filter to *Authentication*; **Load more** (cursor pagination).
5. **Tenant isolation (1 min):** sign in as **Globex · Admin**; only 7 Globex projects, none of Acme's.
6. **Automated proof (2 min):** run `npm run demo` and narrate its 9 sections; point out the stolen-token replay (§7) and the 429 after five logins (§8).
7. **Trade-offs:** open [PROGRESS.md → Known limitations](docs/PROGRESS.md#known-limitations--next-ideas) and one ADR (suggested: [0003](docs/adr/0003-cookie-sessions-with-rotating-refresh-tokens.md) auth or [0005](docs/adr/0005-shared-schema-multi-tenancy.md) tenancy).

## Project structure

```
apps/api      NestJS API: auth, users, projects, audit, guards, RBAC, Redis, Prisma
apps/web      Next.js App Router UI: (auth) login/register, (app) dashboard/projects/admin
scripts/      demo.mjs, ui-check.mjs, setup-env.mjs
docs/         ARCHITECTURE, CONTEXT, PROGRESS, adr/
```

Full annotated tree in [ARCHITECTURE.md §8](docs/ARCHITECTURE.md#8-repository-layout).

## Scripts

| Command | What it does |
|---|---|
| `npm run setup` | One-time setup (env file, containers, install, migrate, seed) |
| `npm run dev:api` / `npm run dev:web` | Run API / web in watch mode |
| `npm run demo` / `npm run ui-check` | Automated verification |
| `npm run db:seed` | Reset demo data |
| `npm run db:migrate` | Apply schema changes after editing `schema.prisma` |
| `npm run infra:up` / `npm run infra:down` | Start / stop Postgres and Redis |
| `npm run build` | Production build of both apps |

## Configuration

`apps/api/.env` (created by `npm run setup` from [.env.example](apps/api/.env.example)):

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql://saas:…@localhost:5433/saas` | Docker Postgres |
| `REDIS_URL` | `redis://localhost:6380` | Docker Redis |
| `JWT_ACCESS_SECRET` | random, generated | ≥ 32 chars, validated at startup |
| `WEB_ORIGIN` | `http://localhost:3000` | CORS + CSRF Origin check |
| `COOKIE_SECURE` | `false` | must be `true` in production (enforced) |

`apps/web` optionally reads `API_URL` (default `http://localhost:4000`).

## Troubleshooting

| Symptom | Fix |
|---|---|
| Port 5433 / 6380 already in use | Change the host port in `docker-compose.yml` and the URL in `apps/api/.env` |
| Web pages return 500 `Cannot find module './NN.js'` | A `next build` ran while `next dev` was running. Stop dev, delete `apps/web/.next`, restart `npm run dev:web` |
| `intern@acme.test` can't log in | Locked by the demo's lockout test, as intended. `npm run db:seed` |
| Login returns 429 | Rate limit (5/min per IP), as intended. Wait a minute |
| API exits with "Invalid environment" | Check `apps/api/.env`; the message lists what's missing |

## Tech stack

Next.js 15.5 · React 19 · NestJS 11 · Prisma 6 · PostgreSQL 16 · Redis 7 · TypeScript 5.9 · Docker Compose.
Versions are pinned deliberately: see [ADR-0009](docs/adr/0009-pin-prisma-6-and-next-15.md).
