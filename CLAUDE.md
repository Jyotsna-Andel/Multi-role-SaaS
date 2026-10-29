# Multi-role SaaS — project guide

Multi-tenant, role-based SaaS demo ("TeamSpace"). Organizations (tenants) have users with roles
ADMIN / MANAGER / MEMBER who manage Projects; every sensitive action is audit-logged.

Training/assessment project (track item P2), reviewed by a tech lead/mentor.

## Docs map — read before non-trivial work

| Need | File |
|---|---|
| Why the project exists, brief, goals → evidence, scope / non-goals, glossary | [docs/CONTEXT.md](docs/CONTEXT.md) |
| Current status, open items, known limitations | [docs/PROGRESS.md](docs/PROGRESS.md) — run `/update-progress` after each unit of work |
| Why things are built the way they are | [docs/adr/](docs/adr/README.md) — ADR-0001…0011 |

**Never contradict an accepted ADR silently.** To change a decision, write a superseding ADR with `/new-adr`.
New significant decisions (auth, tenancy, data integrity, caching, dependencies, cross-app structure) also get an ADR.

## Stack & layout

| Path | What |
|---|---|
| `apps/api` | NestJS 11 + Prisma 6 (Postgres) + ioredis. Global prefix `/api`, port **4000** |
| `apps/web` | Next.js 15 App Router + React 19, port **3000**. Proxies `/api/*` → API (`next.config.ts` rewrites) |
| `scripts/demo.mjs` | End-to-end API feature demo / regression check (44 checks) |
| `scripts/ui-check.mjs` | Web UI flow checks (11 checks) |
| `scripts/setup-env.mjs` | Creates `apps/api/.env` with a random secret (part of `npm run setup`; never overwrites) |
| `docs/ARCHITECTURE.md` | Mermaid diagrams — keep in sync when flows/schema change; validate with `npx -y @mermaid-js/mermaid-cli@11.4.2 -i x.mmd -o x.svg` |
| `.claude/skills/` | `/run-demo`, `/add-api-feature`, `/update-progress`, `/new-adr` playbooks |
| `docs/` | `CONTEXT.md`, `PROGRESS.md`, `adr/` |
| `docker-compose.yml` | Postgres on **5433**, Redis on **6380** (5432 is taken on the dev machine) |

API modules: `auth/` (login, refresh rotation, sessions), `users/` (admin flows), `projects/` (CRUD + cache + stats),
`audit/` (append-only log), `common/` (guards, RBAC, decorators, pagination), `redis/`, `prisma/`.

## Commands (run from repo root)

```bash
npm run infra:up      # start Postgres + Redis (docker compose --wait)
npm run dev:api       # NestJS watch mode
npm run dev:web       # Next dev server
npm run demo          # end-to-end checks against the running API — must end "0 failed"
npm run ui-check      # UI flow checks against the running web app (middleware, SSR, role gating)
npm run db:seed       # reset demo data (wipes all rows)
npm run db:migrate    # after editing prisma/schema.prisma
```

Type checks: `npm run typecheck --prefix apps/api` · `npx next build` in `apps/web`.
Demo logins: `admin@acme.test`, `manager@acme.test`, `member@acme.test`, `admin@globex.test` — password `Password123!`.

## Architecture rules (non-negotiable)

1. **Tenant isolation** — every Prisma query on tenant data filters by `orgId` from `req.user`, never from the request body/params. Look up single records with `findFirst({ where: { id, orgId } })` so cross-tenant ids return **404**, not 403.
2. **Auth is on by default** — `JwtAuthGuard` is global. Only mark routes `@Public()` deliberately (login, register, refresh, logout, health).
3. **Authorize with permissions, not roles** — use `@RequirePermissions(Permission.X)`; add new permissions to `ROLE_PERMISSIONS` in `apps/api/src/common/rbac.ts` (single source of truth; the web UI reads them from `/auth/me`).
4. **Write + audit in one transaction** — `prisma.$transaction(async (tx) => { ...; await audit.log({...}, tx) })`. Invariant checks (e.g. "last admin") go inside the transaction; use `Serializable` when two concurrent requests could both pass the check.
5. **Cache invalidation by version** — after any write that affects a cached list/stats, call `redis.bumpVersion(ns)` *after* the transaction commits. Cache reads must degrade gracefully (RedisService never throws).
6. **Role/active changes** → call `sessions.invalidate(userId)`; changes that must kill live sessions (deactivate, token theft) also bump `tokenVersion`.
7. **Tokens only in httpOnly cookies** — never return tokens in JSON or store them in `localStorage`.
8. **Responses never include** `passwordHash`, token hashes or `tokenVersion` — use explicit `select` objects (see `PUBLIC_USER`).
9. **Web UI permission checks are cosmetic** — hide buttons with `useSession().can()`, but the API is the security boundary.

## Do

- Validate every input with a class-validator DTO (global pipe has `whitelist` + `forbidNonWhitelisted`).
- Use offset pagination (`PageQueryDto` → `paginated()`) for tables, cursor pagination (`CursorQueryDto`) for feeds/logs; cap `limit` at 100.
- Add a stricter `@Throttle()` to any new unauthenticated or expensive endpoint.
- Add a check to `scripts/demo.mjs` for each new feature, then run `npm run demo`.
- Web: fetch data in Server Components via `serverApi()` / `getMe()`; use `api()` from `lib/api.ts` in client components; call `router.refresh()` after mutations.
- Validate any redirect target with `safeNext()`.
- Keep comments to the *why*; match the existing terse style.

## Don't

- Don't trust `orgId`, `role` or `createdById` from the client.
- Don't add update/delete endpoints for `AuditLog` (append-only by design).
- Don't reveal whether an email exists (login uses one generic error + dummy bcrypt compare).
- Don't call `/api/auth/refresh` from new client code directly — go through `api()` so concurrent refreshes are de-duplicated (parallel refreshes trigger reuse detection and log the user out).
- Don't use Next's fetch cache for per-user data (`cache: 'no-store'` in `serverApi`); caching lives in Redis on the API.
- Don't upgrade Prisma to 7 or Next to 16 casually — Prisma 7 requires driver adapters/`prisma.config.ts`; Next 16 renames `middleware.ts` → `proxy.ts`.
- Don't commit `.env` files (only `.env.example`).

## Gotchas

- **Never run `next build` while `next dev` is running** — both write `apps/web/.next`; the dev server then 500s with `Cannot find module './NN.js'`. Fix: stop dev, delete `apps/web/.next`, restart dev.
- Git author for this repo is set locally (`Jyotsna <jyotsnaandel.1998@gmail.com>`). The machine's `gh` CLI is logged into a different account (`bhavesh-JPI`, expired) — never push with it; confirm the target account first.
- `npm run demo` locks `intern@acme.test` for 15 min (lockout test) and adds users → run `npm run db:seed` afterwards.
- Demo uses fake `X-Forwarded-For` per actor; the API trusts XFF only from loopback (`trust proxy: 'loopback'`) — i.e. the Next proxy.
- Reusing a just-rotated refresh token within 10 s is treated as a benign race (no family revoke); the demo waits 10.5 s on purpose.
- Next middleware runs on the Node runtime (`runtime: 'nodejs'`), needed for `Headers.getSetCookie()`.
- `npm install` in `apps/web` warns that `sharp`'s install script was skipped — harmless (no `next/image`).
- Node 24 prints `DEP0060 util._extend` from Next's internal proxy — harmless.
- After editing `schema.prisma`, the VS Code TS server may show stale "no exported member" errors until `prisma generate` runs.
