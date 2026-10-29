---
name: run-demo
description: Start the full stack (Postgres, Redis, NestJS API, Next.js web), verify health, run the 44-check end-to-end demo, and reset demo data. Use when asked to run, start, demo or verify the app.
---

# Run the stack and the demo

Run from the repo root. Explain each step to the user before running it.

1. **Infra** — `npm run infra:up`. Waits for Postgres (5433) and Redis (6380) healthchecks.
   First run only: `npm run install:all`, copy `apps/api/.env.example` → `apps/api/.env` with a random
   `JWT_ACCESS_SECRET` (≥32 chars), then `npm run db:migrate && npm run db:seed`.
2. **API** — `npm run dev:api` in the background. Ready when the log shows `API listening on http://localhost:4000/api`.
3. **Health** — `GET http://localhost:4000/api/health` must return `{"status":"ok","db":"up","cache":"up"}`.
   If `db` is down: check `docker ps`; if port 4000 is busy, stop the old process.
4. **Web** — `npm run dev:web` in the background; ready when `http://localhost:3000/login` returns 200.
5. **Demo** — `npm run demo`. Takes ~15 s (waits 10 s in the token-theft section). Must end `N passed, 0 failed`.
   On a failure, read the failing section in `scripts/demo.mjs`, fix the code, re-run. Don't edit the check to make it pass unless the check itself is wrong — and say so.
6. **Reset** — `npm run db:seed`. The demo locks `intern@acme.test` for 15 min and creates extra users.
7. Report: pass/fail count, URLs, demo logins (`admin|manager|member@acme.test`, `admin@globex.test`, password `Password123!`).
