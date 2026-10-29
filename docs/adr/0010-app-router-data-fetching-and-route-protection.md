# ADR-0010: App Router — server-side fetching + middleware silent refresh

- **Status:** Accepted
- **Date:** 2026-10-22
- **Deciders:** Jyotsna
- **Related:** G7, G10 · [ADR-0002](0002-monorepo-with-next-proxy-to-nest.md), [ADR-0003](0003-cookie-sessions-with-rotating-refresh-tokens.md)

## Context

The UI must use the App Router, show role-appropriate navigation without flicker, protect pages, and not log
users out every 15 minutes when the access token expires. Tokens are in httpOnly cookies, so client JS can't
inspect them.

## Decision

- **Reads in Server Components.** Pages call `serverApi()` ([server-api.ts](../../apps/web/src/lib/server-api.ts)),
  which forwards cookies + client IP, uses `cache: 'no-store'`, and maps 401 → `redirect('/login')`,
  403/404 → `notFound()`. `getMe()` is wrapped in React `cache()` so layout, page and guards share one call.
- **Filters and pages live in `searchParams`**; search uses a plain GET form (works without JS, shareable URLs).
- **Mutations in Client Components** via `api()` ([api.ts](../../apps/web/src/lib/api.ts)), then `router.refresh()`.
  `api()` handles a 401 by running **one shared refresh** for all concurrent callers, then retrying.
- **Route groups:** `(auth)` for public pages, `(app)` for the authenticated shell (Server Component layout
  loads the user → `SessionProvider` → role-aware `Sidebar`). `admin/layout.tsx` checks `user:manage` on the
  server, so non-admins never receive admin pages.
- **Middleware** ([middleware.ts](../../apps/web/src/middleware.ts)): no access cookie but a refresh cookie →
  call `/api/auth/refresh`, forward the `Set-Cookie` to the browser **and** rewrite the request's `Cookie`
  header so Server Components in the same request see the new token; otherwise redirect to `/login?next=…`.
- Post-login redirects go through `safeNext()` (same-site paths only).
- **The UI is never the security boundary**; `can()` only hides controls.

## Consequences

**Positive** — correct first paint with no role flicker; seamless sessions; pages work before hydration; little client JS (~102 kB shared).
**Negative** — middleware adds a network hop when it refreshes; two fetch helpers (server/client) to keep consistent; the audit log page fetches on the client (an intentional demo of cursor "load more").
**Follow-ups** — Server Actions for mutations; nonce-based CSP.

## Alternatives considered

| Option | Why not |
|---|---|
| Client-only fetching (SPA style) | Role flicker, spinner on every page, auth logic duplicated client-side |
| Refresh only in client `api()` | Server Components would redirect to login whenever the access token expired |
| NextAuth / Auth.js | Duplicates the NestJS auth that the brief requires |
