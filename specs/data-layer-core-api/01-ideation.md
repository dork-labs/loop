---
slug: data-layer-core-api
number: 2
created: 2026-02-19
status: ideation
---

# Loop MVP Phase 1: Data Layer & Core API

**Slug:** data-layer-core-api
**Author:** Claude Code
**Date:** 2026-02-19
**Branch:** preflight/data-layer-core-api
**Related:** N/A

---

## 1) Intent & Assumptions

- **Task brief:** Set up PostgreSQL + Drizzle ORM in the existing Hono API (`apps/api/`) and implement the full data layer (10 entities) and core CRUD API endpoints, signal ingestion webhooks, and API key auth. This is Phase 1 of 4 — the foundation that everything else builds on.

- **Assumptions:**
  - PostgreSQL will be hosted on Neon (serverless, Vercel-native)
  - Drizzle ORM for type-safe schema, migrations, and queries
  - Hono API already exists at `apps/api/` with basic health/info endpoints on port 4242
  - Single API key auth (Bearer token) is sufficient for MVP
  - All 10+ entity tables created now even though some features (prompt selection, dispatch) come in Phase 2
  - Neon HTTP driver for simple CRUD, WebSocket/Pool driver for multi-table transactions (signal ingestion)
  - PGLite for test database (WASM Postgres in-process, no Docker)
  - Text CUID2 primary keys for simplicity (no integer PKs for MVP)
  - `@hono/zod-validator` for request body validation

- **Out of scope:**
  - Prompt selection/hydration logic (Phase 2)
  - Dispatch endpoint `/api/dispatch/next` and priority scoring (Phase 2)
  - Prompt review submission behavior beyond basic CRUD (Phase 2)
  - Dashboard API endpoints `/api/dashboard/*` (Phase 3)
  - React frontend (Phase 3)
  - CLI tool (Phase 4)

---

## 2) Pre-reading Log

- `CLAUDE.md`: Monorepo structure (Turborepo, 3 apps), tech stack (Hono, React 19, Next.js 16), commands, testing with Vitest, path aliases
- `meta/loop-litepaper.md`: Vision document — "everything is an issue" philosophy, pull architecture, signal → triage → hypothesis → plan → execute → monitor loop, "Loop has no AI" key insight
- `meta/loop-mvp.md`: Complete MVP spec — 10 entities with field definitions, ~30+ API endpoints, prompt system (selection, hydration, versioning, reviews), priority logic, React dashboard (5 views), CLI commands, default templates
- `specs/mvp-build-plan.md`: 4-phase build plan with dependency chain and `/ideate` prompts for each phase
- `apps/api/package.json`: `@loop/api@0.1.0`, Hono ^4, `@hono/node-server`, type: "module"
- `apps/api/src/index.ts`: 23-line Hono app with `GET /health` and `GET /` endpoints, serves on port 4242
- `apps/api/tsconfig.json`: ES2022 target, ESNext modules, `@/*` path alias to `./src/*`
- `decisions/001-use-hono-over-express.md`: ADR choosing Hono (14KB vs 57KB, zero-config Vercel, type-safe middleware)
- `decisions/002-deploy-as-two-vercel-projects.md`: ADR for separate Vercel projects (api + app from monorepo)
- `turbo.json`: Build pipeline with caching for dev, build, test, typecheck, lint
- `vitest.workspace.ts`: Workspace configured for `apps/api` and `apps/app`

---

## 3) Codebase Map

**Primary Components/Modules:**

- `apps/api/src/index.ts` — Main Hono app entry point (2 endpoints: `/health`, `/`)
- `apps/api/package.json` — API package config (Hono ^4, @hono/node-server)
- `apps/api/tsconfig.json` — TypeScript config (ES2022, `@/*` alias)

**Shared Dependencies:**

- `turbo.json` — Turborepo task pipeline (dev, build, test, typecheck, lint)
- `vitest.workspace.ts` — Test workspace for api + app
- `eslint.config.js` — ESLint 9 flat config (TypeScript, React, Prettier)
- `.prettierrc` — Print width 100, single quotes, Tailwind plugin

**Data Flow:**

Currently minimal — Hono serves static JSON responses. After Phase 1:
HTTP Request → Hono middleware (auth) → Route handler → Drizzle ORM → PostgreSQL (Neon) → JSON response

**Feature Flags/Config:**

- None currently. Will need `DATABASE_URL`, `API_KEY`, webhook secrets as environment variables.

**Potential Blast Radius:**

- **Direct:** ~15 new files in `apps/api/src/` (schema, routes, middleware, db config, tests)
- **Modified:** `apps/api/src/index.ts` (add middleware, route imports), `apps/api/package.json` (new deps)
- **Root-level:** Possibly `turbo.json` (add `db:migrate` task), root `package.json` (migration scripts)
- **Downstream:** Phase 2 (prompt engine) and Phase 3 (dashboard) depend on schema types and CRUD endpoints being correct

---

## 4) Root Cause Analysis

N/A — this is a new feature, not a bug fix.

---

## 5) Research

Full research documented in `research/20260219_data-layer-core-api.md` (18 searches, 10 page fetches).

### Key Decisions

| Decision             | Recommendation                                                          | Rationale                                                                                                                     |
| -------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| PostgreSQL hosting   | **Neon**                                                                | Serverless-first, powers Vercel Postgres natively, database branching, free tier sufficient for MVP                           |
| Local dev DB         | **Docker Compose** or **PGLite**                                        | Docker with Neon WS proxy for full fidelity, or PGLite for zero-infra local dev                                               |
| Connection driver    | **Neon HTTP** for CRUD, **Pool/WS** for transactions                    | HTTP avoids handshake overhead for single queries; Pool needed for multi-table atomic writes                                  |
| Drizzle integration  | **Module-scope client** + **Hono context variables**                    | Warm instance reuse on Vercel; type-safe `c.set('db', db)` / `c.get('db')` pattern                                            |
| Schema organisation  | **Per-domain-group files** with barrel export                           | `schema/issues.ts`, `schema/projects.ts`, `schema/signals.ts`, `schema/prompts.ts` + `schema/_helpers.ts` + `schema/index.ts` |
| Primary keys         | **Text CUID2** everywhere                                               | Simpler for MVP, URL-safe, no sequential enumeration risk                                                                     |
| Enums                | **`pgEnum` + `as const` arrays**                                        | Single source of truth for both Drizzle columns and Zod validation schemas                                                    |
| JSONB typing         | **`.$type<T>()`** on jsonb columns                                      | Type-safe JSONB with GIN indexes for queryable fields                                                                         |
| Migrations           | **`drizzle-kit generate`** + **programmatic `migrate()` in build step** | Versioned SQL files, applied via `tsx src/db/migrate.ts` before build                                                         |
| Request validation   | **`@hono/zod-validator`** per-route                                     | Type-safe validated bodies, 422 errors with details                                                                           |
| API key auth         | **SHA-256 hash** + `crypto.timingSafeEqual`                             | High-entropy keys don't need bcrypt cost; constant-time comparison prevents timing attacks                                    |
| Webhook verification | **Per-provider middleware factory**                                     | GitHub (HMAC-SHA256 on raw body), Sentry (HMAC-SHA256 on serialized JSON), PostHog (shared secret header — no HMAC support)   |
| Testing DB           | **PGLite in-memory** per test file                                      | Real WASM Postgres, no Docker, schema wipe between tests, full SQL fidelity                                                   |
| Test pattern         | **`app.request()`** (Hono native)                                       | No HTTP server needed, direct request/response testing                                                                        |
| Error handling       | **Global `app.onError()`** + per-route Zod                              | HTTPException → status + message, ZodError → 422 + details, catch-all → 500                                                   |

### Security Considerations

- **SQL injection**: Drizzle ORM uses parameterized queries. Only risk is raw `db.execute(sql`...`)` — always use tagged template literals
- **API key storage**: SHA-256 hash stored, plaintext returned once on creation, never retrievable again
- **Webhook signatures**: `crypto.timingSafeEqual` for all signature comparisons. GitHub uses raw body (`c.req.text()`), Sentry uses serialized JSON. PostHog lacks HMAC — use shared secret header
- **Environment variables**: `.env.local` for dev (git-ignored), Vercel env UI for prod. Never hardcode secrets

### Performance Considerations

- **Connection reuse**: Module-scope Neon client initialization persists across warm Vercel invocations
- **Prepared statements**: Declare at module scope for frequent queries (list issues, get project)
- **Indexes**: B-tree on all FKs (Drizzle doesn't auto-index), composite `(project_id, status)` on issues, GIN on JSONB metadata
- **Pagination**: Default limit 50, max 200 on all list endpoints
- **Column selection**: Use explicit `.select({ id, title })` for list endpoints to reduce payload

---

## 6) Clarification

1. **Neon vs Docker for local development**: Should we use Neon's free tier for local dev (simpler, no Docker needed) or Docker Compose with a local Postgres (offline capable, faster)? Recommendation: Start with Neon for simplicity, add Docker later if needed.

2. **API key model**: The MVP spec says "single bearer token." Should this be a hardcoded environment variable (`LOOP_API_KEY`) compared at runtime, or a database-backed API keys table with SHA-256 hashes? The env var approach is simpler for MVP; the DB approach is more extensible. Recommendation: Environment variable for MVP, since there's only one key.

3. **Signal ingestion atomicity**: Creating a Signal + triage Issue in a single webhook request requires a transaction (multi-table write). This means using the Neon WebSocket/Pool driver for signal endpoints specifically. Is this acceptable complexity, or should we use eventual consistency (create Signal first, then Issue in a separate step)? Recommendation: Use transaction — data integrity is more important than simplicity here.

4. **Issue `number` field**: The MVP spec mentions issue numbers (e.g., "loop show 42"). Should issues have an auto-incrementing integer `number` field (separate from the CUID2 `id`) for human-friendly references? Recommendation: Yes, add a `number` serial column alongside the CUID2 `id`.

5. **Soft delete vs hard delete**: Should `DELETE` endpoints perform soft delete (set `deletedAt` timestamp) or hard delete (remove row)? The litepaper emphasizes auditability. Recommendation: Soft delete with `deletedAt` column, filter out in queries.

6. **PromptReview entity**: The MVP spec lists `PromptReview` as a separate entity but also mentions it in Phase 2 context. Should we create the table + basic CRUD now, or just the table schema with no endpoints? Recommendation: Create table + basic CRUD (POST to create a review, GET to list reviews for a version). The smart aggregation and improvement-loop trigger logic comes in Phase 2.

7. **Database provider setup**: Should we set up Neon during this phase (create project, configure connection string, set up Vercel integration) or defer that to deployment time and use PGLite/Docker for all development? Recommendation: Set up Neon now — it takes 5 minutes and ensures the connection driver code is tested against the real target.
