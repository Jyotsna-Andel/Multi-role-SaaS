# ADR-0002: Monorepo; Next.js proxies `/api` to NestJS

- **Status:** Accepted
- **Date:** 2026-10-22
- **Deciders:** Jyotsna
- **Related:** G1, G7 · [ADR-0003](0003-cookie-sessions-with-rotating-refresh-tokens.md)

## Context

The brief requires both Next.js and NestJS. The browser needs to call the API with auth cookies. If the
browser talks to two origins (`:3000` UI, `:4000` API), cookies become cross-origin: CORS with credentials,
`SameSite=None` (weaker CSRF protection), and more configuration that can go wrong.

## Decision

- One repo, two independent apps: `apps/api` (NestJS) and `apps/web` (Next.js), each with its own
  `package.json`; root scripts orchestrate them. No shared-package build tooling.
- Next.js `rewrites` forward `/api/:path*` to `API_URL` ([next.config.ts](../../apps/web/next.config.ts)).
  The browser only ever sees `localhost:3000`; cookies are first-party.
- Server-side code (Server Components, middleware) calls the API directly at `API_URL`, forwarding the
  user's cookies and `X-Forwarded-For`.
- The API trusts `X-Forwarded-For` only from loopback (`trust proxy: 'loopback'`) so rate limits and audit
  logs see the real client IP.

## Consequences

**Positive** — `SameSite=Lax` cookies work; no CORS-with-credentials in the browser path; API can stay on a private network in production.
**Negative** — extra hop through Next for browser API calls; the API must be configured to trust the proxy correctly (wrong config = spoofable IPs).
**Follow-ups** — in production, set `trust proxy` to the real proxy/load-balancer addresses.

## Alternatives considered

| Option | Why not |
|---|---|
| Browser calls API cross-origin | Needs `SameSite=None` + CORS credentials; weaker CSRF posture |
| Turborepo/Nx workspace with shared packages | Tooling overhead not justified for two apps and a few shared types |
| Next.js Route Handlers as the only backend | Brief explicitly requires NestJS |
