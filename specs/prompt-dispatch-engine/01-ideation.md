---
slug: prompt-dispatch-engine
number: 3
created: 2026-02-20
status: ideation
---

# Prompt & Dispatch Engine (MVP Phase 2)

**Slug:** prompt-dispatch-engine
**Author:** Claude Code
**Date:** 2026-02-20
**Branch:** preflight/prompt-dispatch-engine
**Related:** Phase 1 complete — `specs/data-layer-core-api/`

---

## 1) Intent & Assumptions

- **Task brief:** Build Loop's core differentiator — the prompt engine and dispatch system. This selects the right prompt template based on issue context, hydrates it with Handlebars, scores issues by priority, and dispatches work to AI agents via a pull-based API. Also includes prompt reviews with a self-improving feedback loop.
- **Assumptions:**
  - Phase 1 (data layer + CRUD API) is complete. All 11 database tables exist, all CRUD endpoints work, signal ingestion is functional.
  - The prompt template, version, and review schemas already exist (created in Phase 1) with conditions JSONB, specificity integer, usage metrics, and review scores.
  - Existing CRUD for templates/versions/reviews remains unchanged — Phase 2 adds selection logic, hydration, dispatch, and review feedback loops on top.
  - Handlebars is the chosen templating engine (per MVP spec).
  - Bearer token auth (single key) continues from Phase 1.
  - Agents pull work via `GET /api/dispatch/next` — Loop is a pull-based system, not push.
- **Out of scope:**
  - React dashboard (Phase 3)
  - CLI tool (Phase 4)
  - Auto-promote prompt versions (post-MVP)
  - Multi-tenant auth / user management
  - AI/ML-based template selection — this is deterministic logic

---

## 2) Pre-reading Log

**Reference Documents:**
- `meta/loop-mvp.md`: 1187-line MVP specification. Defines prompt selection algorithm (conditions-based matching with specificity), Handlebars hydration with full system state, priority scoring formula, dispatch endpoint response shape, 5 default templates, shared partials architecture. Key emphasis: "Loop has no AI" — it's a deterministic data system with a prompt layer.
- `meta/loop-litepaper.md`: 282-line vision document. Pull-based architecture (agents poll for work), self-improving prompt layer concept, signal-to-outcome feedback loop.
- `specs/mvp-build-plan.md`: 4-phase build plan. Phase 2 depends on Phase 1, Phases 3-4 depend on Phase 2 but are independent of each other.
- `specs/data-layer-core-api/02-specification.md`: 1015-line Phase 1 spec. Documents all schema, migrations, CRUD endpoints, signal ingestion, webhook handlers, and PGlite test infrastructure.

**Phase 1 Implementation (Complete):**
- `apps/api/src/app.ts`: Hono app with global error handler, health check routes, authenticated `/api/*` middleware stack (apiKeyAuth + db injection), and unprotected webhook routes.
- `apps/api/src/index.ts`: Entry point. Port 4242 (dev) or Vercel Functions (prod).
- `apps/api/src/middleware/auth.ts`: Bearer token auth with `crypto.timingSafeEqual` against `LOOP_API_KEY`.
- `apps/api/src/db/schema/_helpers.ts`: Shared column helpers — `timestamps`, `softDelete`, `cuid2Id`.
- `apps/api/src/db/schema/issues.ts`: Issues (type/status/priority enums), Labels, IssueLabels, IssueRelations, Comments. JSONB types for SignalPayload and HypothesisData.
- `apps/api/src/db/schema/projects.ts`: Projects, Goals with bidirectional relations.
- `apps/api/src/db/schema/signals.ts`: Signals table with severity enum and JSONB payload.
- `apps/api/src/db/schema/prompts.ts`: PromptTemplates (slug, conditions JSONB, specificity int), PromptVersions (version auto-increment, status active/draft/retired, usage metrics), PromptReviews (clarity/completeness/relevance 1-5 with CHECK constraints).
- `apps/api/src/routes/issues.ts`: ~200+ lines. Dynamic WHERE clause building, pagination, hierarchy constraint check, label join pattern.
- `apps/api/src/routes/templates.ts`: 358 lines. Full CRUD for templates, versions, reviews. Slug uniqueness, version auto-increment, promote logic.
- `apps/api/src/routes/signals.ts`: Signal ingestion with atomic transaction (Signal + Issue creation).
- `apps/api/src/__tests__/setup.ts`: PGlite-based test infrastructure. `withTestDb()` for per-test isolation, `createTestApp()` for middleware injection.
- `apps/api/package.json`: Dependencies include hono, drizzle-orm, @neondatabase/serverless, zod, @hono/zod-validator, @paralleldrive/cuid2. **No handlebars yet.**

---

## 3) Codebase Map

**Primary Components/Modules:**

| Path | Role |
|------|------|
| `apps/api/src/types.ts` | Shared `AppEnv` and `AnyDb` types — all routes and middleware import from here |
| `apps/api/src/app.ts` | Hono app, middleware composition, route mounting (imports `AppEnv` from `./types`) |
| `apps/api/src/middleware/auth.ts` | Bearer token auth middleware |
| `apps/api/src/db/schema/prompts.ts` | PromptTemplates, PromptVersions, PromptReviews schemas |
| `apps/api/src/db/schema/issues.ts` | Issues, Labels, Relations, Comments schemas |
| `apps/api/src/db/schema/projects.ts` | Projects, Goals schemas |
| `apps/api/src/db/schema/signals.ts` | Signals schema |
| `apps/api/src/db/schema/_helpers.ts` | Shared column helpers (timestamps, softDelete, cuid2Id) |
| `apps/api/src/routes/templates.ts` | Template/Version/Review CRUD (Phase 1) |
| `apps/api/src/routes/issues.ts` | Issues CRUD with filtering and pagination |
| `apps/api/src/routes/prompt-reviews.ts` | Prompt review submission |
| `apps/api/src/__tests__/setup.ts` | PGlite test infrastructure (`TestAppEnv` deprecated, use `AppEnv` from `types.ts`) |

**Shared Dependencies:**
- `drizzle-orm` — ORM used in all route handlers via `c.get('db')`
- `@neondatabase/serverless` — Neon HTTP driver (prod) + Pool driver (transactions)
- `zod` + `@hono/zod-validator` — Request validation throughout
- `@paralleldrive/cuid2` — ID generation in column defaults
- `@electric-sql/pglite` — In-memory Postgres for tests

**Data Flow (Phase 2 — To Build):**
```
Agent polls: GET /api/dispatch/next
  → Fetch all unblocked issues with status='todo'
  → Score each issue (priority + goal + age + type)
  → Atomically claim highest-scoring issue (status → in_progress)
  → Build context object from claimed issue
  → Select template via conditions-based matching
  → Hydrate template with Handlebars
  → Return { issue, prompt, meta }

Agent completes work, submits: POST /api/prompt-reviews
  → Store review → Update version score (EWMA)
  → Check thresholds → Auto-create improvement issue if degraded
```

**Feature Flags/Config:**
- `DATABASE_URL`, `LOOP_API_KEY` (required)
- Webhook secrets: `GITHUB_WEBHOOK_SECRET`, `SENTRY_CLIENT_SECRET`, `POSTHOG_WEBHOOK_SECRET` (optional)
- No new env vars needed for Phase 2

**Potential Blast Radius:**
- **Modify:** `apps/api/package.json` (add handlebars), `apps/api/src/app.ts` (mount new routes)
- **Create:** ~7 new files (dispatch routes, prompt engine lib, priority scoring lib, partials, tests, seed migration)
- **Unchanged:** All existing routes, schema, middleware, tests

---

## 4) Root Cause Analysis

N/A — This is new feature work, not a bug fix.

---

## 5) Research

### Potential Solutions

**1. Atomic Dispatch: `FOR UPDATE SKIP LOCKED` (Recommended)**

- Description: Use PostgreSQL's `SELECT ... FOR UPDATE SKIP LOCKED` in a single transaction to atomically claim the highest-priority issue. Locked rows are silently skipped, preventing double-claims.
- Pros:
  - Zero deadlocks (skipping is non-blocking)
  - Atomic claim (no double-processing)
  - No retry storms (workers move to next available)
  - Industry standard — used by Solid Queue (37signals), PG Boss, Graphile Worker
- Cons:
  - Drizzle doesn't natively support `FOR UPDATE SKIP LOCKED` — requires raw SQL via `db.execute(sql\`...\`)`
  - PGlite tests can't fully simulate multi-connection lock contention (single-process WASM)
- Complexity: Low
- Maintenance: Low

**2. Template Selection: Specificity-Scored Condition Matching (Recommended)**

- Description: Pure function that matches a context object against each template's `conditions` JSONB. All condition keys must match. Sort by project-specific first, then specificity descending. First match wins. Fallback to default template for the issue type.
- Pros:
  - ~20 lines of deterministic logic, trivially unit-testable
  - No database queries in the matching logic (templates fetched once)
  - CSS-specificity mental model is intuitive
  - Specificity already in the schema
- Cons:
  - Condition schema must be validated on write (Zod `.strict()`)
- Complexity: Low
- Maintenance: Low

**3. Review Scoring: EWMA (Exponentially Weighted Moving Average) (Recommended)**

- Description: Each review updates the version's score using `new = α × incoming + (1 − α) × old` with α = 0.3. Weighs recent reviews more heavily, detecting prompt degradation faster than simple averages.
- Pros:
  - O(1) storage and compute per review
  - Same algorithm used by monitoring systems (Redis latency tracking, EWMA control charts)
  - Detects quality drift without needing to re-query all historical reviews
- Cons:
  - Single bad review has outsized impact with α = 0.3 — mitigated by `REVIEW_MIN_SAMPLES = 3`
- Complexity: Low
- Maintenance: Low

**4. Template Hydration: Handlebars with Compiled Cache (Recommended)**

- Description: Compile templates once and cache by versionId. Register shared partials at startup. Use `Handlebars.compile()` with strict mode.
- Pros:
  - Logic-limited (discourages complex template logic)
  - Widely understood, active maintenance (4.7.x)
  - `@types/handlebars` available for TypeScript
  - Partials via `{{> partial_name}}` syntax
- Cons:
  - Must pin >= 4.6.0 for prototype pollution protection
  - Ban triple-braces `{{{` to prevent XSS
- Complexity: Low
- Maintenance: Low

**5. Default Template Seeding: Custom Drizzle Migration (Recommended)**

- Description: Generate a custom migration with `INSERT ... ON CONFLICT DO NOTHING` SQL. Seeds default templates as part of normal `npm run db:migrate`. Idempotent.
- Pros:
  - Runs as part of existing migration flow, zero extra tooling
  - Version-controlled alongside schema
  - Works in CI/CD pipelines
  - Idempotent — safe to run multiple times
- Cons:
  - Hard-coded IDs required (fine for system defaults)
- Complexity: Low
- Maintenance: Low

### Security Considerations

| Risk | Mitigation |
|------|------------|
| SSTI via user-authored templates | Templates authored by humans/agents in trusted DB, never from request input |
| Triple-brace XSS | Ban `{{{` in template content validation |
| Prototype pollution | Pin handlebars >= 4.6.0, never enable `allowProtoPropertiesByDefault` |
| Race condition in dispatch | `FOR UPDATE SKIP LOCKED` eliminates at database level |
| Condition schema injection | Validate conditions JSON with Zod `.strict()` on every insert/update |
| Threshold manipulation | Thresholds are code constants, not DB-configurable |

### Performance Considerations

| Area | Strategy |
|------|----------|
| Template compilation | `Map<versionId, compiled>` cache, compiled once per version per process |
| Dispatch query | Partial index on `(status = 'todo', priority DESC, created_at ASC)` |
| Template selection | In-memory pure function — O(n x c) where n = templates, c = condition fields |
| Review score update | Single UPDATE per review, EWMA is O(1) |
| Partials registration | Register once at module load, reused across all requests |

### Recommendation

All five approaches above are recommended. The architecture is intentionally simple:
- Template selection and priority scoring are pure functions (~20 lines each)
- Dispatch is a single SQL transaction with `FOR UPDATE SKIP LOCKED`
- Hydration is Handlebars with a compile cache
- Reviews use EWMA for O(1) score tracking
- Default templates seeded via migration

The total new code is estimated at ~500-700 lines of implementation + ~400-600 lines of tests.

---

## 6) Clarification (Resolved)

| # | Question | Decision |
|---|----------|----------|
| 1 | Type ordering weights (not specified in MVP doc) | signal=50, hypothesis=40, plan=30, task=20, monitor=10. Spread of 10 between types; a medium-priority signal can outscore a high-priority task, which is intentional (signals = real-time issues). |
| 2 | Blocked issue detection | Derive from relations — an issue is blocked if it has a `blocked_by` relation where the blocking issue's status is not `done` or `canceled`. No schema changes needed. |
| 3 | Review scoring method | EWMA with alpha=0.3. Weights recent reviews more heavily for faster degradation detection. O(1) compute per review. Min-samples=3 before threshold checks. |
| 4 | Score scale and threshold | Raw 1-5 scale, threshold=3.5 as specified in MVP doc. Composite = average of clarity + completeness + relevance. Human-readable. |
| 5 | Default template content | Substantive — write real, usable prompts referencing the litepaper's workflows for each issue type. These are the core product. |
| 6 | Dispatch HTTP method | GET as specified. Simple polling for agents, atomic claim is an implementation detail. |
| 7 | Template preview auth | Same bearer token auth as all other `/api/*` routes. No special handling. |
