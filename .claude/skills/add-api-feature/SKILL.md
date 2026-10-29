---
name: add-api-feature
description: Checklist for adding a new tenant-scoped resource or endpoint end-to-end (Prisma model, DTO, service, RBAC permission, transaction + audit, cache, Next.js UI, demo check, docs). Use whenever adding or changing an API endpoint or data model.
---

# Add an API feature the project's way

Follow the architecture rules in `CLAUDE.md`. Use `apps/api/src/projects/` as the reference implementation.
Tell the user what each step is and why before doing it.

## Backend (`apps/api`)
1. **Schema** — add the model to `prisma/schema.prisma` with `orgId` + relation to `Organization` (`onDelete: Cascade`) and an `@@index([orgId, ...])` matching the main query. Run `npm run db:migrate` (name the migration).
2. **Permission** — add `RESOURCE_READ/WRITE/...` to `Permission` in `src/common/rbac.ts` and map it in `ROLE_PERMISSIONS`. Add the same string to `Permission` in `apps/web/src/lib/types.ts`.
3. **DTOs** — class-validator for every field (lengths, enums). List DTO extends `PageQueryDto` or `CursorQueryDto`.
4. **Service**
   - Every query filters by `orgId` from the `AuthUser`; single lookups use `findFirst({ where: { id, orgId } })` → `NotFoundException`.
   - Explicit `select` — never return secrets.
   - Writes: `prisma.$transaction(async (tx) => { write; await audit.log({ action: 'resource.created', ... , meta }, tx) })`. Use `Serializable` if an invariant could race.
   - Cached reads: `redis.wrap(key-with-version, ttl, fn)`; after the transaction commits call `redis.bumpVersion(ns)`.
5. **Controller** — `@RequirePermissions(...)` on every handler, `ParseUUIDPipe` on ids, `@ReqMeta()` for audit IP/UA. Add `@Throttle` if unauthenticated or expensive. Register the module in `app.module.ts`.
6. `npm run typecheck --prefix apps/api`.

## Frontend (`apps/web`)
7. Page = Server Component using `serverApi()`; filters/pages in `searchParams`. Interactive parts in a `'use client'` component using `api()` + `router.refresh()`.
8. Gate buttons/links with `useSession().can('...')` and add nav entries to `NAV` in `components/Sidebar.tsx` with their permission.
9. `npx next build` in `apps/web` must pass.

## Verify & record
10. Add checks to `scripts/demo.mjs`: allowed role succeeds, disallowed role → 403, other tenant → 404, audit action recorded. Run `npm run demo` → 0 failed, then `npm run db:seed`.
11. Run `/update-progress` (status row + any decision made).
