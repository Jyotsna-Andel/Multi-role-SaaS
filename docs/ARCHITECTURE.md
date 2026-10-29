# Architecture

TeamSpace is a multi-tenant SaaS: many organizations share one deployment, and users inside each
organization have one of three roles. This page shows how the pieces fit; the *why* behind each choice
is in the [ADRs](adr/README.md). Project context and scope: [CONTEXT.md](CONTEXT.md).

## 1. System overview

```mermaid
flowchart LR
    U(["Browser"])

    subgraph WEB["apps/web — Next.js 15 App Router :3000"]
        MW["middleware.ts<br/>route gate + silent refresh"]
        RSC["Server Components<br/>pages and layouts"]
        CC["Client Components<br/>forms, buttons"]
        RW["rewrites<br/>/api/* proxy"]
    end

    subgraph API["apps/api — NestJS 11 :4000"]
        G["Global guards<br/>rate limit, auth, RBAC"]
        M["Modules<br/>auth, users, projects, audit"]
        P["Prisma 6"]
        R["ioredis"]
    end

    PG[("PostgreSQL 16 :5433<br/>orgs, users, projects,<br/>refresh tokens, audit log")]
    RD[("Redis 7 :6380<br/>cache, sessions,<br/>rate-limit counters")]

    U -- "pages (HTML)" --> MW --> RSC
    U -- "fetch /api/* with httpOnly cookies" --> RW
    CC -. "runs in browser" .-> RW
    RSC -- "serverApi(): forwards cookies + client IP" --> G
    MW -- "POST /api/auth/refresh" --> G
    RW -- "proxied, same origin" --> G
    G --> M
    M --> P --> PG
    M --> R --> RD
    G --> R
```

- The browser only ever talks to **:3000**. Next.js proxies `/api/*`, so auth cookies are first-party ([ADR-0002](adr/0002-monorepo-with-next-proxy-to-nest.md)).
- Server Components call the API directly, forwarding the user's cookies and IP ([ADR-0010](adr/0010-app-router-data-fetching-and-route-protection.md)).
- Postgres is the source of truth. Everything in Redis can be rebuilt ([ADR-0007](adr/0007-redis-for-cache-sessions-and-rate-limits.md)).

## 2. API request pipeline

Every request to NestJS passes these layers in order; any layer can stop it.

```mermaid
flowchart TB
    IN(["HTTP request"]) --> H["helmet<br/>security headers"]
    H --> C["CORS + cookie-parser<br/>JSON body ≤ 100 kB"]
    C --> O{"Origin check<br/>unsafe method from<br/>foreign origin?"}
    O -- yes --> X403a["403"]
    O -- no --> T{"ThrottlerGuard<br/>Redis counters"}
    T -- over limit --> X429["429 + Retry-After"]
    T -- ok --> A{"JwtAuthGuard<br/>@Public?"}
    A -- public --> V
    A -- protected --> J{"JWT valid AND<br/>session active AND<br/>tokenVersion matches?"}
    J -- no --> X401["401"]
    J -- yes --> PM{"PermissionsGuard<br/>role grants required<br/>permissions?"}
    PM -- no --> X403b["403 + audit access.denied"]
    PM -- yes --> V{"ValidationPipe<br/>DTO whitelist"}
    V -- invalid / unknown field --> X400["400"]
    V -- ok --> S["Controller → Service<br/>org-scoped queries"]
    S --> TX["prisma.$transaction<br/>write + audit row"]
    TX --> AFTER["after commit:<br/>bump cache version,<br/>invalidate session"]
    AFTER --> OUT(["Response"])
```

Code: [main.ts](../apps/api/src/main.ts), [app.module.ts](../apps/api/src/app.module.ts), [guards.ts](../apps/api/src/common/guards.ts).

## 3. Authentication flows

Login, silent refresh and stolen-token detection ([ADR-0003](adr/0003-cookie-sessions-with-rotating-refresh-tokens.md)).

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Web as Next.js
    participant API as NestJS
    participant DB as Postgres
    participant RC as Redis

    Note over User,RC: Login
    User->>Web: POST /api/auth/login {email, password}
    Web->>API: proxied
    API->>DB: find user, bcrypt compare
    alt wrong password or unknown email
        API->>DB: failedLogins += 1 (lock at 5) + audit
        API-->>User: 401 "Invalid email or password" (same message either way)
    else correct
        API->>DB: store SHA-256(refresh token), new family + audit auth.login
        API-->>User: Set-Cookie access_token (15 min) + refresh_token (7 d), httpOnly
    end

    Note over User,RC: Any request after 15 min (access cookie expired)
    User->>Web: GET /dashboard (only refresh cookie)
    Web->>API: middleware: POST /api/auth/refresh
    API->>DB: tx: create new token, revoke old WHERE revokedAt IS NULL
    API-->>Web: new cookies
    Web->>API: Server Component fetch with new cookies
    API->>RC: session:user:{id} (role, active, tokenVersion)
    API-->>Web: data
    Web-->>User: page + Set-Cookie

    Note over User,RC: Attacker replays an old (already rotated) refresh token
    User->>API: POST /api/auth/refresh (stolen token)
    API->>DB: token found but revoked → reuse!
    API->>DB: revoke whole family, tokenVersion += 1, audit auth.refresh_reuse_detected
    API->>RC: delete session cache
    API-->>User: 401, attacker and victim both signed out
```

## 4. Data model

```mermaid
erDiagram
    Organization ||--o{ User : "has members"
    Organization ||--o{ Project : owns
    Organization ||--o{ AuditLog : records
    User ||--o{ RefreshToken : "has sessions"
    User ||--o{ Project : created
    User ||--o{ AuditLog : "acted in"

    Organization {
        uuid id PK
        string name
        string slug UK
    }
    User {
        uuid id PK
        uuid orgId FK
        string email UK
        string passwordHash "bcrypt cost 12"
        enum role "ADMIN | MANAGER | MEMBER"
        bool isActive
        int tokenVersion "bump = revoke access tokens"
        int failedLogins
        datetime lockedUntil
    }
    RefreshToken {
        uuid id PK
        string tokenHash UK "SHA-256, never the raw token"
        uuid familyId "one per login"
        datetime expiresAt
        datetime revokedAt
        uuid replacedBy
    }
    Project {
        uuid id PK
        uuid orgId FK
        string name
        enum status "ACTIVE | ON_HOLD | COMPLETED | ARCHIVED"
        uuid createdById FK
    }
    AuditLog {
        uuid id PK
        uuid orgId FK
        uuid actorId FK
        string action "e.g. user.role_changed"
        json metadata "before/after diff"
        string ip
        datetime createdAt
    }
```

Every tenant-owned table carries `orgId`, and every query filters by the `orgId` from the session, never
from the request ([ADR-0005](adr/0005-shared-schema-multi-tenancy.md)). Schema: [schema.prisma](../apps/api/prisma/schema.prisma).

## 5. Roles and permissions

| Permission | ADMIN | MANAGER | MEMBER | Used by |
|---|:-:|:-:|:-:|---|
| `project:read` | ✓ | ✓ | ✓ | Dashboard, project list |
| `project:write` | ✓ | ✓ | | Create / edit project |
| `project:delete` | ✓ | | | Delete project |
| `user:read` | ✓ | ✓ | | List team members (API) |
| `user:manage` | ✓ | | | Invite, change role, deactivate; admin area |
| `audit:read` | ✓ | | | Audit log |

Single source of truth: [rbac.ts](../apps/api/src/common/rbac.ts). The role is re-read from the Redis
session cache on each request, so changes apply immediately ([ADR-0004](adr/0004-permission-based-rbac.md)).
Rule enforced in a Serializable transaction: an organization always keeps at least one active admin
([ADR-0006](adr/0006-transactions-and-append-only-audit-log.md)).

## 6. Caching

```mermaid
flowchart LR
    REQ(["GET /api/projects?page=2"]) --> VER["read ver:org:{id}:projects → n"]
    VER --> KEY["key = cache:org:{id}:projects:v{n}:{hash(query)}"]
    KEY --> HIT{"in Redis?"}
    HIT -- "yes" --> RET1(["return cached<br/>X-Cache: HIT"])
    HIT -- "no" --> DBQ["Postgres: findMany + count<br/>(one snapshot)"] --> SET["SET key, TTL 60 s"] --> RET2(["return<br/>X-Cache: MISS"])

    W(["POST / PATCH / DELETE project"]) --> TXW["transaction: write + audit"] --> INC["INCR ver:org:{id}:projects"]
    INC -. "old keys unreachable,<br/>expire by TTL" .-> KEY
```

| What | Redis key | TTL | Invalidated by |
|---|---|---|---|
| Project list pages | `cache:org:{id}:projects:v{n}:{hash}` | 60 s | version bump on any project write |
| Dashboard stats | `cache:org:{id}:projects:v{n}:stats` | 30 s | same version bump |
| User session (role, active, tokenVersion) | `session:user:{id}` | 300 s | role/status change, token reuse |
| Rate-limit counters | `rl:default:{hash}:hits` / `:block` | per limit | expiry |

If Redis is unavailable, cache reads fall through to Postgres. Known gap: the rate limiter does not yet
degrade gracefully ([PROGRESS.md](PROGRESS.md#known-limitations--next-ideas)).

## 7. Security controls

| Threat | Control | Where |
|---|---|---|
| Token theft via XSS | Tokens only in `httpOnly` cookies, never in JSON or `localStorage` | [cookies.ts](../apps/api/src/auth/cookies.ts) |
| CSRF | `SameSite=Lax` + Origin check on unsafe methods | [main.ts](../apps/api/src/main.ts) |
| Stolen refresh token | Rotation on every use, family revoke on reuse, hashed at rest | [auth.service.ts](../apps/api/src/auth/auth.service.ts) |
| Brute force / credential stuffing | 5 logins/min per IP (Redis), lockout after 5 failures | [auth.controller.ts](../apps/api/src/auth/auth.controller.ts) |
| User enumeration | Same error + dummy bcrypt compare for unknown emails | [auth.service.ts](../apps/api/src/auth/auth.service.ts) |
| Privilege escalation | Permission guard on every route; role from server-side session | [guards.ts](../apps/api/src/common/guards.ts) |
| Cross-tenant access | `orgId` from session in every query; foreign ids → 404 | services |
| Mass assignment | DTO whitelist + `forbidNonWhitelisted` | [main.ts](../apps/api/src/main.ts) |
| Instant revocation | `tokenVersion` + `isActive` checked per request | [session.service.ts](../apps/api/src/auth/session.service.ts) |
| Open redirect after login | `safeNext()` allows same-site paths only | [safe-next.ts](../apps/web/src/lib/safe-next.ts) |
| Clickjacking / sniffing | `X-Frame-Options: DENY`, `nosniff`, helmet headers | [next.config.ts](../apps/web/next.config.ts) |
| Weak config | Env validated at boot; JWT secret ≥ 32 chars; `Secure` cookies required in prod | [env.ts](../apps/api/src/config/env.ts) |
| Repudiation | Append-only audit log with actor, IP, user agent, before/after diff | [audit.service.ts](../apps/api/src/audit/audit.service.ts) |

## 8. Repository layout

```
├── apps/
│   ├── api/                 NestJS API
│   │   ├── prisma/          schema, migrations, seed
│   │   └── src/
│   │       ├── auth/        login, refresh rotation, cookies, session cache
│   │       ├── users/       admin flows
│   │       ├── projects/    CRUD, cache, dashboard stats
│   │       ├── audit/       append-only log + cursor pagination
│   │       ├── common/      guards, RBAC, decorators, pagination, filters
│   │       ├── redis/       cache helpers
│   │       └── main.ts      security middleware, global pipes
│   └── web/                 Next.js App Router
│       └── src/
│           ├── app/(auth)/  login, register
│           ├── app/(app)/   dashboard, projects, admin/{users,audit}
│           ├── components/  Sidebar, SessionProvider, Modal, Pagination
│           ├── lib/         api.ts (browser), server-api.ts (server)
│           └── middleware.ts
├── scripts/                 demo.mjs (44 checks), ui-check.mjs (11 checks)
├── docs/                    CONTEXT, PROGRESS, ARCHITECTURE, adr/
└── docker-compose.yml       Postgres + Redis
```
