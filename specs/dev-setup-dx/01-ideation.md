---
slug: dev-setup-dx
number: 8
created: 2026-02-21
status: ideation
---

# Developer Setup & DX Improvements

**Slug:** dev-setup-dx
**Author:** Claude Code
**Date:** 2026-02-21
**Branch:** main
**Related:** N/A

---

## 1) Intent & Assumptions

- **Task brief:** Implement the ranked developer setup improvements from `.temp/dev-setup-recommendations.md`: Docker Compose for local PostgreSQL, Zod env validation per app, pre-filled `.env.example` files with working local defaults, optional setup script, and documentation updates.
- **Assumptions:**
  - Docker is acceptable as a local dev dependency (but the project should still be usable with Neon directly)
  - Zod is already available in all three apps (no new deps for env validation)
  - The API's `@neondatabase/serverless` driver will NOT connect to a plain Docker postgres — requires a conditional driver swap
  - `pg` package will be added as a dev dependency to `apps/api/`
  - PGlite test infrastructure is unaffected (tests don't use Docker postgres)
  - The CLI app (`apps/cli/`) already has its own config management and is out of scope
- **Out of scope:**
  - `.devcontainer/devcontainer.json` (can add later once the base is solid)
  - CLI wizard / interactive setup tool
  - Full Docker Compose for all services (only postgres)
  - Automated secret generation
  - t3-env / envalid / znv (Zod direct is sufficient)

## 2) Pre-reading Log

- `.temp/dev-setup-recommendations.md`: Full recommendations doc from earlier research — ranked improvements with code examples
- `apps/api/src/db/index.ts`: Uses `@neondatabase/serverless` + `drizzle-orm/neon-http` — CRITICAL: won't work with plain Docker postgres
- `apps/api/src/db/migrate.ts`: Uses `dotenv` + `@neondatabase/serverless` — same driver issue
- `apps/api/drizzle.config.ts`: Uses `process.env.DATABASE_URL!` — drizzle-kit should work with standard pg URLs
- `apps/api/src/index.ts`: Entry point — reads `process.env.NODE_ENV` and `process.env.PORT`
- `apps/api/src/middleware/auth.ts`: Reads `process.env.LOOP_API_KEY` for Bearer token validation
- `apps/api/src/middleware/webhooks.ts`: Reads `GITHUB_WEBHOOK_SECRET`, `SENTRY_CLIENT_SECRET`, `POSTHOG_WEBHOOK_SECRET`
- `apps/api/src/lib/prompt-engine.ts`: Reads `process.env.LOOP_URL` and `process.env.LOOP_API_KEY`
- `apps/app/src/lib/api-client.ts`: Reads `import.meta.env.VITE_API_URL` and `import.meta.env.VITE_LOOP_API_KEY`
- `apps/web/src/lib/posthog-server.ts`: Reads `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST`
- `apps/web/instrumentation-client.ts`: Reads `NEXT_PUBLIC_POSTHOG_KEY` and `NODE_ENV`
- `apps/api/src/__tests__/setup.ts`: Sets `process.env.LOOP_API_KEY` if not set — test infra unaffected
- `apps/api/.env.example`: Currently has placeholder values requiring manual editing
- `apps/app/.env.example`: Has `VITE_API_URL` pre-filled, `VITE_LOOP_API_KEY` as placeholder
- `apps/web/.env.example`: PostHog keys commented out (all optional)
- `package.json` (root): Missing `dx`, `dx:down`, `setup` scripts
- `apps/api/package.json`: Has Zod ^4.3.6, dotenv, `@neondatabase/serverless`
- `apps/app/package.json`: Has Zod ^3.25.76
- `apps/web/package.json`: Has Zod ^4.1.13
- `research/20260221_dev-setup-dx.md`: Full research on Docker Compose, Neon driver, Zod env, setup scripts
- `docs/getting-started/installation.mdx`: Existing getting-started docs that will need updating
- `docs/getting-started/quickstart.mdx`: Existing quickstart docs that will need updating
- `contributing/setup.md`: Developer setup guide (if exists) needs updating

## 3) Codebase Map

- **Primary components/modules:**
  - `apps/api/src/db/index.ts` — Database connection (needs conditional driver swap)
  - `apps/api/src/db/migrate.ts` — Migration runner (needs driver swap for local dev)
  - `apps/api/src/index.ts` — API entry point (import env.ts first)
  - `apps/api/src/middleware/auth.ts` — API key auth (wire to env.ts)
  - `apps/api/src/middleware/webhooks.ts` — Webhook auth (wire to env.ts)
  - `apps/api/src/lib/prompt-engine.ts` — Prompt engine (wire to env.ts)
  - `apps/app/src/lib/api-client.ts` — Dashboard API client (wire to env.ts)
  - `apps/web/src/lib/posthog-server.ts` — PostHog init (wire to env.ts)
  - `apps/web/instrumentation-client.ts` — PostHog client init (wire to env.ts)

- **Shared dependencies:**
  - `zod` — Already in all three apps (v4 in api/web, v3 in app)
  - `drizzle-orm` — ORM layer in API
  - `@neondatabase/serverless` — Neon HTTP driver (production only after change)

- **Data flow:**
  - `.env.example` → `cp` → `.env` → `process.env` / `import.meta.env` → `env.ts` (validation) → app code
  - `docker-compose.dev.yml` → `npm run dx` → PostgreSQL container → `DATABASE_URL` → `db/index.ts` (conditional driver) → Drizzle ORM

- **Feature flags/config:**
  - `NODE_ENV` — Will gate the conditional driver swap (`production` = Neon, else = `pg`)
  - No other feature flags affected

- **Potential blast radius:**
  - Direct: ~12 files need changes (new files + wiring existing process.env to env.ts)
  - Indirect: All API route files import from `db/index.ts` (but the export interface is unchanged)
  - Tests: No changes needed — PGlite test setup is independent of the Docker postgres path
  - Docs: Getting-started guides, quickstart, and contributing docs need updating

## 4) Root Cause Analysis

N/A — this is a DX improvement, not a bug fix.

## 5) Research

Full research at `research/20260221_dev-setup-dx.md`.

- **Potential solutions:**

  1. **Conditional driver swap in `db/index.ts`** (recommended)
     - Pros: Simple (~15 lines), works offline, no extra containers, dev dep only
     - Cons: Doesn't exercise production Neon code path locally
     - Complexity: Low

  2. **Neon HTTP proxy via Docker** (`timowilhelm/local-neon-http-proxy`)
     - Pros: Exercises exact production code path, no code changes
     - Cons: Extra container, `localtest.me` DNS (fails offline), more complex docker-compose
     - Complexity: Medium

  3. **Neon dev branch (cloud-only dev)** — Use Neon branching for each dev
     - Pros: Zero local setup, exact production behavior
     - Cons: Requires internet, Neon account per dev, can't work offline
     - Complexity: Low (but external dependency)

- **Recommendation:** Option 1 (conditional driver swap). For a project this size, the simplicity wins. The production Neon path is exercised in CI and staging — local dev doesn't need to mirror it exactly.

- **Env validation recommendation:** Raw Zod `safeParse` with formatted errors. Zero new deps, ~30 lines per app. t3-env is overkill at this scale.

- **Key finding:** Zod v4 is in `apps/api` and `apps/web`, Zod v3 is in `apps/app`. The env validation pattern works identically in both, but care needed when copying code between apps.

## 6) Clarification

1. **Port conflict handling**: Should `docker-compose.dev.yml` use standard port `5432:5432` or an alternate like `54320:5432` to avoid conflicts with locally-installed PostgreSQL? Recommendation: `5432:5432` since contributors are expected to use Docker, not a local install.

2. **`NODE_ENV` as driver gate**: The conditional driver swap uses `NODE_ENV !== 'production'` to select the pg driver for local dev. This means `NODE_ENV=test` (used by Vitest) would also try to use the pg driver — but tests use PGlite and never touch `db/index.ts` directly. Confirm this is acceptable.

3. **`drizzle.config.ts` driver**: The Drizzle Kit config (`drizzle.config.ts`) uses `dialect: 'postgresql'` with the `DATABASE_URL`. Drizzle Kit uses its own internal postgres connection — it should work with both Neon and local URLs. Confirm no special handling needed.

4. **Shared dev API key**: Both `apps/api` and `apps/app` will default to `loop-dev-api-key-insecure`. This is intentional so `cp .env.example .env` across both apps creates a working pair. Confirm this convention is acceptable.

5. **Documentation updates scope**: The following docs should be updated:
   - `docs/getting-started/installation.mdx` — Add Docker prerequisite, `npm run dx` step
   - `docs/getting-started/quickstart.mdx` — Update the quick-start flow with new commands
   - `docs/self-hosting/index.mdx` — Update environment variable reference
   - `CLAUDE.md` — Add `dx`, `dx:down`, `setup` commands to the Commands section
   - `README.md` (if it has setup instructions) — Update getting-started steps
   - `contributing/` — Update developer setup guide with Docker flow

   Confirm this scope, or flag any docs that should be excluded/added.
