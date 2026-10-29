# ADR-0003: Cookie sessions — short JWT + rotating refresh tokens

- **Status:** Accepted
- **Date:** 2026-10-22
- **Deciders:** Jyotsna
- **Related:** G2, G8 · [ADR-0002](0002-monorepo-with-next-proxy-to-nest.md), [ADR-0004](0004-permission-based-rbac.md)

## Context

"Secure auth" must resist the common web attacks: XSS stealing tokens, CSRF, stolen long-lived tokens,
credential stuffing / brute force, and user enumeration. We also need instant revocation (deactivating
a user must log them out now, not in an hour).

## Decision

- **Transport:** both tokens in `httpOnly`, `SameSite=Lax`, `Secure` (prod) cookies. Tokens never appear in
  JSON responses or `localStorage`. ([cookies.ts](../../apps/api/src/auth/cookies.ts))
- **Access token:** HS256 JWT, 15 min, claims `sub`, `org`, `tv` (token version); issuer/audience/algorithm pinned on verify.
- **Refresh token:** 48 random bytes, 7 days; only its **SHA-256 hash** is stored. **Rotated on every use**
  inside a transaction with a conditional update (`WHERE revokedAt IS NULL`) so two concurrent refreshes
  can't both succeed.
- **Reuse detection:** presenting an already-rotated token revokes the whole **token family**, bumps the
  user's `tokenVersion` (killing live access tokens) and writes `auth.refresh_reuse_detected` to the audit log.
  A 10-second grace window treats near-simultaneous reuse (two tabs) as benign.
- **Instant revocation:** every request checks `tokenVersion` and `isActive` via the Redis session cache ([ADR-0004](0004-permission-based-rbac.md)).
- **Login hardening:** bcrypt (cost 12); identical error and a dummy bcrypt compare for unknown emails
  (no enumeration via message or timing); 5 failures → 15-min account lockout; 5 logins/min per IP.
- **CSRF:** `SameSite=Lax` plus an Origin check on unsafe methods in [main.ts](../../apps/api/src/main.ts).

## Consequences

**Positive** — XSS can't read tokens; stolen refresh tokens are detected on first reuse; deactivation is immediate; passwords and tokens are never stored in plain text.
**Negative** — one Redis/DB lookup per request (mitigated by the session cache); refresh races need careful client handling (`api()` de-duplicates refreshes); lockout can be abused to lock a known account (accepted for this scope; production would add CAPTCHA/step-up).
**Follow-ups** — MFA, password reset, email verification (out of scope, see CONTEXT §4).

## Alternatives considered

| Option | Why not |
|---|---|
| Bearer token in `localStorage` | Readable by any XSS payload |
| Long-lived JWT only | Can't revoke; stolen token valid until expiry |
| Refresh token as JWT | Stateless = can't revoke or detect reuse |
| Server-side sessions only (opaque session ID) | Viable; JWT + session cache chosen to demonstrate both stateless verification and revocation |
| Auth-as-a-service (Auth0/Clerk) | The brief assesses implementing secure auth |
