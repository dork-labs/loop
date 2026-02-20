---
slug: data-layer-core-api
type: tasks
created: 2026-02-19
last-decompose: 2026-02-19
---

# Tasks: Data Layer & Core API

**Spec:** `specs/data-layer-core-api/02-specification.md`
**Decomposed:** 2026-02-19
**Mode:** Full

---

## Phase A: Database Foundation

### Task A1: Install Dependencies and Configure Drizzle Kit

**Objective:** Add all required npm packages and create the Drizzle Kit configuration file.

**Steps:**

1. Install production dependencies in `apps/api/`:
   ```bash
   npm install drizzle-orm @neondatabase/serverless @paralleldrive/cuid2 zod @hono/zod-validator ws dotenv
   ```

2. Install dev dependencies in `apps/api/`:
   ```bash
   npm install -D drizzle-kit @electric-sql/pglite @types/ws
   ```

3. Create `apps/api/drizzle.config.ts`:
   ```typescript
   import { defineConfig } from 'drizzle-kit'

   export default defineConfig({
     dialect: 'postgresql',
     schema: './src/db/schema',
     out: './drizzle/migrations',
     dbCredentials: { url: process.env.DATABASE_URL! },
   })
   ```

4. Add migration scripts to `apps/api/package.json`:
   ```json
   {
     "scripts": {
       "db:generate": "drizzle-kit generate",
       "db:migrate": "node --experimental-strip-types src/db/migrate.ts",
       "db:push": "drizzle-kit push",
       "db:studio": "drizzle-kit studio"
     }
   }
   ```

5. Create `apps/api/.env.example`:
   ```
   DATABASE_URL=postgresql://user:pass@host/dbname
   LOOP_API_KEY=tok_...
   GITHUB_WEBHOOK_SECRET=whsec_...
   SENTRY_CLIENT_SECRET=...
   POSTHOG_WEBHOOK_SECRET=...
   ```

**Acceptance Criteria:**
- All dependencies install without errors
- `drizzle.config.ts` exists and exports a valid config
- `package.json` has `db:generate`, `db:migrate`, `db:push`, `db:studio` scripts
- `.env.example` documents all required environment variables
- `npm run typecheck` passes in `apps/api/`

---

### Task A2: Create Database Schema — Shared Helpers and Issues Domain

**Objective:** Create the schema helper utilities and the complete issues domain schema (issues, labels, issue_labels, issue_relations, comments tables).

**Steps:**

1. Create `apps/api/src/db/schema/_helpers.ts`:
   ```typescript
   import { timestamp, text } from 'drizzle-orm/pg-core'
   import { createId } from '@paralleldrive/cuid2'

   export const timestamps = {
     createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
       .defaultNow().notNull(),
     updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
       .defaultNow().notNull().$onUpdate(() => new Date()),
   }

   export const softDelete = {
     deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
   }

   export const cuid2Id = {
     id: text('id').primaryKey().$defaultFn(() => createId()),
   }
   ```

2. Create `apps/api/src/db/schema/issues.ts` with:
   - Enums: `issue_type` (signal, hypothesis, plan, task, monitor), `issue_status` (triage, backlog, todo, in_progress, done, canceled), `relation_type` (blocks, blocked_by, related, duplicate), `author_type` (human, agent)
   - Export `as const` value arrays for Zod reuse
   - Issues table with all columns: id, number (serial unique), title, description, type, status, priority, parent_id, project_id, signal_source, signal_payload (jsonb), hypothesis (jsonb), agent_session_id, agent_summary, commits (jsonb), pull_requests (jsonb), completed_at, timestamps, soft delete
   - JSONB types: `SignalPayload`, `HypothesisData`, `CommitRef`, `PullRequestRef`
   - Indexes: `idx_issues_project_status` composite, `idx_issues_parent_id`, `idx_issues_type`, `idx_issues_status`, `idx_issues_number` unique
   - Labels table: id, name (unique), color, created_at, deleted_at
   - IssueLabels join table: composite PK (issue_id, label_id)
   - IssueRelations table: id, type, issue_id, related_issue_id, created_at; indexes on issue_id and related_issue_id
   - Comments table: id, body, issue_id, author_name, author_type, parent_id (self-ref for threading), created_at; index on issue_id
   - Drizzle `relations()` definitions for all foreign keys

**Acceptance Criteria:**
- Schema file exports all tables and enums
- Enum value arrays exported for Zod reuse
- All JSONB columns have `.$type<T>()` typing
- All indexes defined
- `npm run typecheck` passes

---

### Task A3: Create Database Schema — Projects, Signals, and Prompts Domains

**Objective:** Create the remaining schema files for projects/goals, signals, and prompt templates/versions/reviews.

**Steps:**

1. Create `apps/api/src/db/schema/projects.ts`:
   - Enums: `project_status` (backlog, planned, active, paused, completed, canceled), `project_health` (on_track, at_risk, off_track), `goal_status` (active, achieved, abandoned)
   - Projects table: id, name, description, status, health, goal_id (FK→goals), timestamps, soft delete
   - Goals table: id, title, description, metric, target_value (double), current_value (double), unit, status, project_id (FK→projects), timestamps, soft delete
   - Drizzle `relations()` for project↔goal

2. Create `apps/api/src/db/schema/signals.ts`:
   - Enum: `signal_severity` (low, medium, high, critical)
   - Signals table: id, source, source_id, type, severity, payload (jsonb not null), issue_id (FK→issues), created_at
   - Indexes: `idx_signals_issue_id`, `idx_signals_source`, `idx_signals_payload_gin` (GIN index)

3. Create `apps/api/src/db/schema/prompts.ts`:
   - Enum: `prompt_version_status` (active, draft, retired)
   - PromptTemplates table: id, slug (unique), name, description, conditions (jsonb default {}), specificity (int default 10), project_id, active_version_id, timestamps, soft delete
   - PromptVersions table: id, template_id (FK), version (int), content, changelog, author_type, author_name, status, usage_count (default 0), completion_rate, avg_duration_ms, review_score, created_at
   - Unique constraint on (template_id, version)
   - Index: `idx_prompt_versions_template_id`
   - PromptReviews table: id, version_id (FK), issue_id (FK), clarity (1-5 check), completeness (1-5 check), relevance (1-5 check), feedback, author_type, created_at
   - Index: `idx_prompt_reviews_version_id`

4. Create `apps/api/src/db/schema/index.ts` barrel export:
   ```typescript
   export * from './_helpers'
   export * from './issues'
   export * from './projects'
   export * from './signals'
   export * from './prompts'
   ```

**Acceptance Criteria:**
- All 11 tables defined across schema files
- All enums with exported value arrays
- All indexes and constraints defined
- Barrel export re-exports everything
- `npm run typecheck` passes

---

### Task A4: Create Database Connection and Migration Infrastructure

**Objective:** Set up the Neon database client, pool client for transactions, and programmatic migration runner.

**Steps:**

1. Create `apps/api/src/db/index.ts`:
   ```typescript
   import { neon } from '@neondatabase/serverless'
   import { drizzle } from 'drizzle-orm/neon-http'
   import * as schema from './schema'

   const sql = neon(process.env.DATABASE_URL!)
   export const db = drizzle(sql, { schema })
   export type Database = typeof db
   ```

2. Create `apps/api/src/db/pool.ts`:
   ```typescript
   import { Pool, neonConfig } from '@neondatabase/serverless'
   import { drizzle } from 'drizzle-orm/neon-serverless'
   import ws from 'ws'
   import * as schema from './schema'

   neonConfig.webSocketConstructor = ws

   const pool = new Pool({ connectionString: process.env.DATABASE_URL })
   export const poolDb = drizzle(pool, { schema })
   ```

3. Create `apps/api/src/db/migrate.ts`:
   ```typescript
   import { neon } from '@neondatabase/serverless'
   import { drizzle } from 'drizzle-orm/neon-http'
   import { migrate } from 'drizzle-orm/neon-http/migrator'

   const sql = neon(process.env.DATABASE_URL!)
   const db = drizzle(sql)

   await migrate(db, { migrationsFolder: './drizzle/migrations' })
   console.log('Migrations complete')
   process.exit(0)
   ```

**Acceptance Criteria:**
- `db/index.ts` exports `db` and `Database` type
- `db/pool.ts` exports `poolDb` for transactional use
- `db/migrate.ts` runs programmatic migrations
- `npm run typecheck` passes

---

### Task A5: Set Up PGLite Test Infrastructure

**Objective:** Create the test setup file that provides an in-memory Postgres database for all API tests.

**Steps:**

1. Create `apps/api/src/__tests__/setup.ts`:
   - Import PGLite and create an in-memory instance
   - Create a Drizzle client from PGLite
   - Push schema to the in-memory database (using `drizzle-kit push` equivalent or running SQL)
   - Export the test database client and a function to create a test Hono app that uses the test DB
   - Implement `beforeEach` hook to wipe schema (`DROP SCHEMA public CASCADE; CREATE SCHEMA public;` then re-push)
   - Implement `afterAll` to close PGLite
   - Set `LOOP_API_KEY` environment variable to a test value (e.g., `test-api-key-1234`)

2. Configure the test app to use the PGLite-backed Drizzle client instead of the Neon client. This requires the app/routes to accept a database instance (via dependency injection or Hono context variable).

**Design consideration:** The database client needs to be injectable for testing. Two approaches:
- **Option A (Hono context):** Set `db` in Hono context via middleware, routes read from `c.get('db')`
- **Option B (Module override):** Export a `setDb()` function from `db/index.ts` that tests call to swap the client

Choose the approach that best fits Hono patterns while keeping production code clean.

**Acceptance Criteria:**
- Test setup creates an in-memory Postgres database
- Schema is applied to the test database
- Database is wiped between tests
- A test API key is configured
- Test app instance is available for route testing
- Running `npx vitest run apps/api/src/__tests__/setup.ts` doesn't error

---

## Phase B: App Restructure + Auth

### Task B1: Extract Hono App and Add Global Error Handler

**Objective:** Separate the Hono app instance from the server entry point for testability, and add the global error handler.

**Steps:**

1. Create `apps/api/src/app.ts`:
   ```typescript
   import { Hono } from 'hono'
   import { HTTPException } from 'hono/http-exception'
   import { ZodError } from 'zod'

   export type AppEnv = {
     Variables: {
       // Empty for now — db is imported directly
     }
   }

   const app = new Hono<AppEnv>()

   // Global error handler
   app.onError((err, c) => {
     if (err instanceof HTTPException) {
       return c.json({ error: err.message }, err.status)
     }
     if (err instanceof ZodError) {
       return c.json({ error: 'Validation error', details: err.flatten() }, 422)
     }
     console.error(err)
     return c.json({ error: 'Internal server error' }, 500)
   })

   // Health check (no auth)
   app.get('/health', (c) => c.json({ ok: true, service: 'loop-api', timestamp: new Date().toISOString() }))
   app.get('/', (c) => c.json({ name: 'Loop API', version: '0.1.0' }))

   export { app }
   ```

2. Update `apps/api/src/index.ts`:
   ```typescript
   import { serve } from '@hono/node-server'
   import { app } from './app'

   if (process.env.NODE_ENV !== 'production') {
     const port = parseInt(process.env.PORT || '4242', 10)
     serve({ fetch: app.fetch, port }, (info) => {
       console.log(`Loop API running at http://localhost:${info.port}`)
     })
   }

   export default app
   ```

3. Verify existing health check and root endpoints still work.

**Acceptance Criteria:**
- `app.ts` exports the Hono app instance
- `index.ts` imports from `app.ts` and only handles server startup
- Health check and root endpoints function identically
- Global error handler catches HTTPException, ZodError, and unknown errors
- `npm run typecheck` passes
- Existing tests still pass

---

### Task B2: Implement Bearer Token Authentication Middleware

**Objective:** Create the API key auth middleware using `crypto.timingSafeEqual`.

**Steps:**

1. Create `apps/api/src/middleware/auth.ts`:
   ```typescript
   import { createMiddleware } from 'hono/factory'
   import { HTTPException } from 'hono/http-exception'
   import { timingSafeEqual } from 'node:crypto'
   import type { AppEnv } from '../app'

   export const apiKeyAuth = createMiddleware<AppEnv>(async (c, next) => {
     const authHeader = c.req.header('Authorization')
     if (!authHeader?.startsWith('Bearer ')) {
       throw new HTTPException(401, { message: 'Missing or malformed Authorization header' })
     }

     const token = authHeader.slice(7)
     const expected = process.env.LOOP_API_KEY

     if (!expected) {
       throw new HTTPException(500, { message: 'LOOP_API_KEY not configured' })
     }

     const tokenBuf = Buffer.from(token)
     const expectedBuf = Buffer.from(expected)

     if (tokenBuf.length !== expectedBuf.length || !timingSafeEqual(tokenBuf, expectedBuf)) {
       throw new HTTPException(401, { message: 'Invalid API key' })
     }

     await next()
   })
   ```

2. Wire up auth middleware in `app.ts`:
   ```typescript
   import { apiKeyAuth } from './middleware/auth'

   // Protected API routes
   const api = new Hono<AppEnv>()
   api.use('*', apiKeyAuth)
   // ... routes will be added in subsequent tasks
   app.route('/api', api)
   ```

3. Write tests in the auth test section:
   - Request without Authorization header → 401
   - Request with malformed Authorization header (no "Bearer " prefix) → 401
   - Request with wrong API key → 401
   - Request with correct API key → passes through to route handler

**Acceptance Criteria:**
- Auth middleware rejects missing, malformed, and invalid tokens with 401
- Valid tokens pass through
- Comparison uses `timingSafeEqual` (no `===`)
- LOOP_API_KEY not configured returns 500
- Tests pass

---

### Task B3: Implement Webhook Verification Middleware

**Objective:** Create per-provider webhook signature verification middleware for GitHub, Sentry, and PostHog.

**Steps:**

1. Create `apps/api/src/middleware/webhooks.ts` with three middleware factories:

   **GitHub** (`verifyGitHubWebhook`):
   - Read raw body with `c.req.text()`
   - Get signature from `X-Hub-Signature-256` header
   - Compute HMAC-SHA256 of raw body using `GITHUB_WEBHOOK_SECRET`
   - Compare using `crypto.timingSafeEqual`
   - If valid, parse body as JSON and set on context
   - If invalid, throw HTTPException 401

   **Sentry** (`verifySentryWebhook`):
   - Read body, parse JSON
   - Get signature from `Sentry-Hook-Signature` header
   - Re-serialize JSON for HMAC computation
   - Compute HMAC-SHA256 using `SENTRY_CLIENT_SECRET`
   - Compare using `crypto.timingSafeEqual`

   **PostHog** (`verifyPostHogWebhook`):
   - Check `X-PostHog-Secret` header or query param against `POSTHOG_WEBHOOK_SECRET`
   - Use `crypto.timingSafeEqual` for comparison
   - No HMAC — just shared secret matching

2. Write tests for each webhook verification:
   - Valid signature → passes through
   - Invalid signature → 401
   - Missing signature header → 401
   - Missing environment secret → 500

**Acceptance Criteria:**
- Each provider has a dedicated middleware factory
- All comparisons use `crypto.timingSafeEqual`
- Tests cover valid, invalid, and missing scenarios
- Middleware can be composed per-route

---

## Phase C: Core CRUD Endpoints

### Task C1: Implement Issues CRUD Routes

**Objective:** Create the full issues CRUD API with filtering, hierarchy constraint enforcement, and label association.

**Steps:**

1. Create `apps/api/src/routes/issues.ts` implementing:

   **GET `/api/issues`** — List issues with filtering:
   - Query params: `status` (comma-separated), `type` (comma-separated), `projectId`, `labelId`, `priority`, `parentId`, `limit` (default 50, max 200), `offset` (default 0)
   - Auto-exclude soft-deleted (`deleted_at IS NULL`)
   - Response: `{ data: Issue[], total: number }`

   **POST `/api/issues`** — Create issue:
   - Validate with `createIssueSchema`:
     ```typescript
     const createIssueSchema = z.object({
       title: z.string().min(1).max(500),
       description: z.string().optional(),
       type: z.enum(issueTypeValues),
       status: z.enum(issueStatusValues).default('triage'),
       priority: z.number().int().min(0).max(4).default(0),
       parentId: z.string().optional(),
       projectId: z.string().optional(),
       signalSource: z.string().optional(),
       signalPayload: z.record(z.unknown()).optional(),
       hypothesis: z.object({
         statement: z.string(),
         confidence: z.number().min(0).max(1),
         evidence: z.array(z.string()),
         validationCriteria: z.string(),
         prediction: z.string().optional(),
       }).optional(),
       labelIds: z.array(z.string()).optional(),
     })
     ```
   - **Hierarchy constraint**: If `parentId` is provided, look up the parent. If parent has a `parentId` itself, reject with 422: `"Cannot create a child of an issue that already has a parent (1-level hierarchy limit)"`
   - If `labelIds` provided, insert into `issue_labels` join table
   - Return 201 with `{ data: Issue }`

   **GET `/api/issues/:id`** — Get issue with relations:
   - Include: parent, children, project, labels, relations (with related issue info)
   - Exclude soft-deleted
   - Return 404 if not found or soft-deleted

   **PATCH `/api/issues/:id`** — Update issue fields:
   - Partial update schema (all fields optional)
   - Return 200 with updated issue

   **DELETE `/api/issues/:id`** — Soft delete:
   - Set `deletedAt = new Date()`
   - Return 204

2. Create `apps/api/src/__tests__/issues.test.ts`:
   - Create issue with valid data → 201
   - Create issue with all fields → 201
   - Create child issue (1 level) → 201
   - Create grandchild (2 levels) → 422
   - List issues with no filters → returns all non-deleted
   - List with status filter → returns filtered results
   - List with type filter → returns filtered results
   - List with projectId filter → returns filtered results
   - List with labelId filter → returns filtered results
   - List with pagination (limit=2, offset=1) → returns correct slice and total
   - Get issue by ID → includes parent, children, labels, relations
   - Get soft-deleted issue → 404
   - Update issue → 200 with updated fields
   - Soft delete issue → 204, subsequent GET → 404
   - Create issue with label IDs → labels associated
   - Auth: no token → 401

**Acceptance Criteria:**
- All CRUD operations work correctly
- Hierarchy constraint enforced (no grandchildren)
- Filtering works for all supported query params
- Pagination returns correct slice and total count
- Soft delete excludes from list and get
- Label association works on create
- All tests pass

---

### Task C2: Implement Projects CRUD Routes

**Objective:** Create the projects CRUD API with goal linking and issue count.

**Steps:**

1. Create `apps/api/src/routes/projects.ts` implementing:

   **GET `/api/projects`** — List projects:
   - Pagination: `limit` (default 50, max 200), `offset`
   - Exclude soft-deleted
   - Response: `{ data: Project[], total: number }`

   **POST `/api/projects`** — Create project:
   - Validate: `name` (required string), `description` (optional), `status` (default 'backlog'), `health` (default 'on_track'), `goalId` (optional)
   - Return 201

   **GET `/api/projects/:id`** — Get project with goal and issue counts:
   - Include linked goal info
   - Include count of issues in the project (by status)
   - Return 404 if not found or soft-deleted

   **PATCH `/api/projects/:id`** — Update project
   **DELETE `/api/projects/:id`** — Soft delete

2. Create `apps/api/src/__tests__/projects.test.ts`:
   - CRUD operations
   - Goal linking
   - Soft delete behavior
   - Pagination

**Acceptance Criteria:**
- Full CRUD works
- Goal linking works
- Soft delete filters correctly
- Tests pass

---

### Task C3: Implement Goals CRUD Routes

**Objective:** Create the goals CRUD API with progress tracking.

**Steps:**

1. Create `apps/api/src/routes/goals.ts` implementing:

   **GET `/api/goals`** — List goals with pagination
   **POST `/api/goals`** — Create goal:
   - Validate: `title` (required), `description`, `metric`, `targetValue`, `currentValue`, `unit`, `status` (default 'active'), `projectId`
   - Return 201

   **PATCH `/api/goals/:id`** — Update goal (currentValue, status, etc.)
   **DELETE `/api/goals/:id`** — Soft delete

2. Create `apps/api/src/__tests__/goals.test.ts`:
   - CRUD operations
   - Current value updates
   - Soft delete behavior

**Acceptance Criteria:**
- Full CRUD works
- Progress tracking (currentValue update) works
- Soft delete filters correctly
- Tests pass

---

### Task C4: Implement Labels CRUD Routes

**Objective:** Create the labels CRUD API with uniqueness enforcement.

**Steps:**

1. Create `apps/api/src/routes/labels.ts` implementing:

   **GET `/api/labels`** — List labels (pagination, exclude soft-deleted)
   **POST `/api/labels`** — Create label:
   - Validate: `name` (required, unique), `color` (required)
   - Return 201
   **DELETE `/api/labels/:id`** — Soft delete

2. Create `apps/api/src/__tests__/labels.test.ts`:
   - Create label → 201
   - Create duplicate name → error (unique constraint)
   - List labels → returns non-deleted
   - Soft delete → 204

**Acceptance Criteria:**
- CRUD works
- Unique name constraint enforced
- Tests pass

---

### Task C5: Implement Relations and Comments Routes

**Objective:** Create the issue relations and comments APIs.

**Steps:**

1. Create `apps/api/src/routes/relations.ts`:

   **POST `/api/issues/:id/relations`** — Create relation:
   ```typescript
   const createRelationSchema = z.object({
     type: z.enum(relationTypeValues),
     relatedIssueId: z.string(),
   })
   ```
   - Return 201

   **DELETE `/api/relations/:id`** — Hard delete relation (not soft delete)
   - Return 204

2. Create `apps/api/src/routes/comments.ts`:

   **GET `/api/issues/:id/comments`** — List comments (threaded by parentId)
   **POST `/api/issues/:id/comments`** — Add comment:
   ```typescript
   const createCommentSchema = z.object({
     body: z.string().min(1),
     authorName: z.string().min(1),
     authorType: z.enum(authorTypeValues),
     parentId: z.string().optional(),
   })
   ```
   - Return 201

3. Create `apps/api/src/__tests__/relations.test.ts`:
   - Create relation → 201
   - Delete relation (hard delete) → 204
   - Duplicate prevention (if applicable)

4. Create `apps/api/src/__tests__/comments.test.ts`:
   - Create comment → 201
   - List comments → threaded structure
   - Comment with parentId (reply) → 201

**Acceptance Criteria:**
- Relations create and hard-delete work
- Comments create and list with threading work
- Tests pass

---

### Task C6: Wire All CRUD Routes into App

**Objective:** Connect all route modules to the main Hono app with proper auth middleware.

**Steps:**

1. Update `apps/api/src/app.ts` to import and mount all routes:
   ```typescript
   import { apiKeyAuth } from './middleware/auth'
   import { issueRoutes } from './routes/issues'
   import { projectRoutes } from './routes/projects'
   import { goalRoutes } from './routes/goals'
   import { labelRoutes } from './routes/labels'
   import { templateRoutes } from './routes/templates'
   import { promptReviewRoutes } from './routes/templates' // or separate

   const api = new Hono<AppEnv>()
   api.use('*', apiKeyAuth)
   api.route('/issues', issueRoutes)
   api.route('/projects', projectRoutes)
   api.route('/goals', goalRoutes)
   api.route('/labels', labelRoutes)
   api.route('/templates', templateRoutes)
   api.route('/prompt-reviews', promptReviewRoutes)

   app.route('/api', api)

   // Signal webhooks (separate auth)
   app.route('/api/signals', signalRoutes)
   ```

2. Ensure comments and relations are nested under issues:
   - `/api/issues/:id/comments` — handled within issueRoutes or mounted separately
   - `/api/issues/:id/relations` — handled within issueRoutes or mounted separately

3. Verify all routes are accessible with correct auth.

**Acceptance Criteria:**
- All routes mounted at correct paths
- Auth middleware applied to all `/api/*` routes except signals (which use webhook auth)
- Health check and root endpoint remain unprotected
- `npm run typecheck` passes

---

## Phase D: Signal Ingestion

### Task D1: Implement Generic Signal Ingestion Endpoint

**Objective:** Create the `POST /api/signals` endpoint with atomic Signal + Issue creation in a transaction.

**Steps:**

1. Create `apps/api/src/routes/signals.ts` implementing:

   **POST `/api/signals`** (Bearer token auth):
   ```typescript
   const createSignalSchema = z.object({
     source: z.string().min(1),
     sourceId: z.string().optional(),
     type: z.string().min(1),
     severity: z.enum(signalSeverityValues),
     payload: z.record(z.unknown()),
     projectId: z.string().optional(),
   })
   ```

   **Signal ingestion flow (atomic transaction using poolDb):**
   1. Validate incoming payload
   2. Begin transaction
   3. Derive issue title from signal data (e.g., `"[source] type: [summary from payload]"`)
   4. Derive priority from severity: `critical → 1, high → 2, medium → 3, low → 4`
   5. Create Issue with `type: 'signal'`, `status: 'triage'`, derived priority, signal data
   6. Create Signal record with `issueId` pointing to the new issue
   7. Commit transaction
   8. Return 201 with both Signal and Issue in response: `{ data: { signal: Signal, issue: Issue } }`

2. Create `apps/api/src/__tests__/signals.test.ts`:
   - Generic signal ingestion → 201, creates both Signal and Issue
   - Signal with projectId → Issue inherits projectId
   - Severity-to-priority mapping: critical→1, high→2, medium→3, low→4
   - Transaction atomicity: if Issue creation fails, Signal is not created
   - Auth: no token → 401
   - Validation: missing required fields → 422

**Acceptance Criteria:**
- Signal ingestion creates both Signal and Issue atomically
- Priority derived from severity correctly
- Transaction rolls back on failure
- Tests pass

---

### Task D2: Implement Webhook Signal Handlers (PostHog, GitHub, Sentry)

**Objective:** Create provider-specific webhook endpoints that normalize payloads and delegate to signal ingestion.

**Steps:**

1. Add to `apps/api/src/routes/signals.ts`:

   **POST `/api/signals/posthog`** (PostHog webhook auth):
   - Use `verifyPostHogWebhook` middleware
   - Extract: metric name, values, change percentage from action payload
   - Derive title: e.g., `"PostHog: [metric] [change]% ([timeframe])"`
   - Derive severity from change magnitude
   - Create signal via the same atomic flow

   **POST `/api/signals/github`** (GitHub webhook auth):
   - Use `verifyGitHubWebhook` middleware
   - Extract: event type (from `X-GitHub-Event` header), repository, actor
   - Derive title: e.g., `"GitHub: [event_type] on [repo] by [actor]"`
   - Map event types to severity (e.g., security alert → critical)
   - Create signal via the same atomic flow

   **POST `/api/signals/sentry`** (Sentry webhook auth):
   - Use `verifySentryWebhook` middleware
   - Extract: error group title, count, first/last seen
   - Derive title: e.g., `"Sentry: [error_title] ([count] events)"`
   - Map error frequency/level to severity
   - Create signal via the same atomic flow

2. Add webhook tests to `apps/api/src/__tests__/signals.test.ts`:
   - PostHog webhook with valid secret → 201
   - GitHub webhook with valid signature → 201
   - Sentry webhook with valid signature → 201
   - Invalid signatures → 401 for each provider
   - Payload normalization produces correct signal fields

**Acceptance Criteria:**
- Each provider endpoint normalizes payload correctly
- Webhook verification middleware applied per-route
- Signal + Issue created atomically for each provider
- Tests pass

---

## Phase E: Templates, Reviews, and Polish

### Task E1: Implement Template and Version CRUD Routes

**Objective:** Create the prompt templates and versions CRUD API.

**Steps:**

1. Create `apps/api/src/routes/templates.ts` implementing:

   **GET `/api/templates`** — List templates with active version info
   **POST `/api/templates`** — Create template:
   - Validate: `slug` (unique), `name`, `description`, `conditions` (default {}), `specificity` (default 10), `projectId`
   - Return 201

   **PATCH `/api/templates/:id`** — Update template metadata
   **DELETE `/api/templates/:id`** — Soft delete template

   **GET `/api/templates/:id/versions`** — List versions for a template
   **POST `/api/templates/:id/versions`** — Create new version:
   - Auto-increment `version` number based on highest existing version for template
   - Validate: `content` (required), `changelog`, `authorType`, `authorName`, `status` (default 'draft')
   - If this is the first version, set it as `active_version_id` on the template
   - Return 201

   **PATCH `/api/templates/:id/versions/:vid`** — Update version:
   - Allow promoting to 'active' (sets `active_version_id` on template, retires previously active)
   - Allow setting status to 'retired'

   **GET `/api/templates/:id/reviews`** — List reviews for a template (via versions)

2. Create `apps/api/src/__tests__/templates.test.ts`:
   - Template CRUD
   - Slug uniqueness
   - Version auto-increment
   - First version becomes active
   - Version promotion (active_version_id updated, old version retired)
   - Soft delete template

**Acceptance Criteria:**
- Template CRUD works with slug uniqueness
- Version numbering auto-increments
- Version promotion updates template's active_version_id
- Tests pass

---

### Task E2: Implement Prompt Review Submission

**Objective:** Create the prompt review submission endpoint.

**Steps:**

1. Add to routes (either in `templates.ts` or separate `reviews.ts`):

   **POST `/api/prompt-reviews`** — Submit a prompt review:
   - Validate:
     ```typescript
     const createReviewSchema = z.object({
       versionId: z.string(),
       issueId: z.string(),
       clarity: z.number().int().min(1).max(5),
       completeness: z.number().int().min(1).max(5),
       relevance: z.number().int().min(1).max(5),
       feedback: z.string().optional(),
       authorType: z.enum(authorTypeValues),
     })
     ```
   - After creating review, update the version's `review_score` (average of all reviews' average scores)
   - Return 201

2. Add tests:
   - Submit review → 201
   - Review score updated on version
   - Validation: scores outside 1-5 → 422
   - Missing required fields → 422

**Acceptance Criteria:**
- Review creation works
- Version review_score updated after review submission
- Validation enforces 1-5 range
- Tests pass

---

### Task E3: Update Documentation and Run Full Test Suite

**Objective:** Update CLAUDE.md with database docs, verify all tests pass, and generate final migration.

**Steps:**

1. Update `CLAUDE.md` with:
   - Database setup instructions (Neon connection string configuration)
   - New npm scripts (`db:generate`, `db:migrate`, `db:push`, `db:studio`)
   - API endpoint reference summary (table of all endpoints)
   - Environment variables documentation

2. Run full test suite: `npm test`
3. Run typecheck: `npm run typecheck`
4. Run lint: `npm run lint`
5. Fix any issues found
6. Generate migration: `cd apps/api && npm run db:generate`

**Acceptance Criteria:**
- CLAUDE.md updated with database and API documentation
- All tests pass
- Typecheck passes
- Lint passes
- Migration generated successfully

---

## Dependency Graph

```
A1 (Dependencies + Config)
├── A2 (Schema: Issues) ──────────┐
├── A3 (Schema: Projects+Signals+Prompts) ──┤
├── A4 (DB Connection + Migration) ─────────┤
└── A5 (PGLite Test Setup) ────────────────┘
                                            │
B1 (App Restructure) ──────────────────────┤
B2 (Auth Middleware) ──────────────┐        │
B3 (Webhook Middleware) ───────────┤        │
                                   │        │
C1 (Issues CRUD) ←─────────────────┤←───────┘
C2 (Projects CRUD) ←──────────────┤
C3 (Goals CRUD) ←─────────────────┤
C4 (Labels CRUD) ←────────────────┤
C5 (Relations+Comments) ←─────────┤
C6 (Wire Routes) ←────────────────┘
    │
D1 (Signal Ingestion) ←───────────── C6, B3
D2 (Webhook Handlers) ←───────────── D1
    │
E1 (Template CRUD) ←──────────────── C6
E2 (Prompt Reviews) ←─────────────── E1
E3 (Docs + Polish) ←──────────────── ALL
```

## Parallel Execution Opportunities

- **A2, A3, A4** can run in parallel after A1
- **B1, B2, B3** can run in parallel (B1 depends on nothing within Phase B; B2 and B3 are independent middleware)
- **C1, C2, C3, C4** can run in parallel after B2 and A5 are complete
- **C5** can run in parallel with C1-C4
- **D1 and E1** can run in parallel after C6
- **D2** depends on D1; **E2** depends on E1
