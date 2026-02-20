# Research: Loop MVP — Data Layer & Core API

**Date:** 2026-02-19
**Feature:** data-layer-core-api
**Depth:** Deep Research

---

## Research Summary

This report covers best practices for integrating PostgreSQL + Drizzle ORM into the existing Hono API that deploys to Vercel Functions. The primary finding is that **Neon + `@neondatabase/serverless` (HTTP mode) + Drizzle ORM** is the optimal stack for the serverless constraint; the testing story is best served by **PGLite in-memory PostgreSQL** via `@electric-sql/pglite`; and schema organisation should follow a **per-domain-group file structure** with a central `index.ts` barrel export.

---

## Key Findings

1. **Database Hosting**: Neon is the clear winner for a Vercel Functions deployment. It ships a first-party serverless driver (`@neondatabase/serverless`) designed specifically for the short-lived connection model of Vercel/Lambda. It powers Vercel Postgres natively, supports database branching for preview environments, and has a free tier sufficient for MVP development.

2. **Connection Handling in Serverless**: Vercel Server Functions (Node.js runtime, not Edge) can persist up to 15 minutes, enabling connection reuse across invocations when the client is initialised in module scope — outside the request handler. For single, non-interactive queries, the Neon HTTP driver is faster than WebSocket because it avoids handshake overhead. For multi-statement interactive transactions, use the WebSocket driver.

3. **Drizzle Schema Organisation**: Multi-file, per-domain-group schemas are the best fit. Each domain group (e.g. `projects`, `issues`, `signals`, `prompts`) lives in its own file under `src/db/schema/`. A root `src/db/schema/index.ts` re-exports everything. Shared column helpers (timestamps, soft-delete) live in a `src/db/schema/_helpers.ts` file.

4. **Migrations**: Use `drizzle-kit generate` for all schema changes (produces versioned SQL files in `drizzle/migrations/`). Apply them programmatically at startup via `drizzle-orm`'s `migrate()` function inside a one-off Vercel build step or a dedicated migration endpoint, **not** inside the Vercel Function handler itself (latency cost). Use `drizzle-kit push` only for local rapid prototyping.

5. **Testing**: PGLite (`@electric-sql/pglite`) is the best testing database. It runs real WASM-compiled Postgres in-process with no Docker dependency. Each test file gets a fresh in-memory database, migrations are applied with `drizzle push` (no migration files needed), and schema is wiped between tests using `DROP SCHEMA IF EXISTS public CASCADE`. This gives full SQL fidelity with zero external deps.

6. **Hono Auth Middleware**: Hono ships a built-in `bearerAuth` middleware that covers the simple API key case. For hashed key storage, use `verifyToken` option with `crypto.timingSafeEqual` to prevent timing attacks. Pass `db` into handlers via type-safe Hono context variables (`c.set` / `c.get`).

7. **Webhook Signature Verification**: All three providers (GitHub, Sentry, PostHog) use HMAC-SHA256 but differ in header name and signing scope. Implement a per-provider middleware factory so each route gets the correct verification logic. Never use `===` for signature comparison — always use `crypto.timingSafeEqual`.

---

## Detailed Analysis

### 1. PostgreSQL Hosting: Neon vs Supabase vs Docker

#### Neon
- Serverless-first architecture: compute and storage are separated; compute scales to zero when idle.
- Ships `@neondatabase/serverless` — a purpose-built driver for HTTP and WebSocket connections from serverless/edge runtimes.
- Powers Vercel Postgres natively (Vercel Postgres = Neon under the hood).
- Database branching: `neon branch create` mirrors Git branching for staging/preview environments.
- Free tier: 191.9 compute-hours/month + 0.5 GB storage (sufficient for MVP dev).
- Acquired by Databricks in May 2025 (~$1B) — continued investment confirmed.
- **Best fit for Loop's Vercel Functions deployment.**

#### Supabase
- BaaS platform: Postgres + Auth + Storage + Edge Functions + Realtime.
- Uses PgBouncer (transaction mode) for connection pooling.
- Permanent free tier (500 MB DB, 50K monthly active users).
- Better choice if you want auth/realtime/storage managed for you, but Loop is building these itself.
- Slightly heavier integration story; supabase-js client is not needed if using Drizzle.

#### Docker (local dev only)
- Use Docker Compose for local development alongside Neon for staging/prod.
- Run `postgres:16` + `@neondatabase/serverless`'s WebSocket proxy on port 5433 to replicate the Neon connection behaviour locally.
- Store connection strings separately: `LOCAL_DATABASE_URL` vs `DATABASE_URL`.

**Recommendation**: Neon for all cloud environments (dev branch, preview branches, production). Docker for local development using the WebSocket proxy pattern from Neon's guide.

---

### 2. Drizzle ORM + Hono Integration

#### Connection Initialisation Pattern

For Vercel Server Functions (Node.js runtime), initialise the Drizzle client **outside** the request handler at module scope. Vercel Functions can reuse warm instances across invocations, so the client is paid for once:

```typescript
// src/db/index.ts
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

const sql = neon(process.env.DATABASE_URL!)
export const db = drizzle(sql, { schema })
```

For interactive transactions (multi-statement, with rollback), switch to the WebSocket driver:

```typescript
// src/db/index.ts (WebSocket variant for transactions)
import { Pool } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import * as schema from './schema'
import ws from 'ws'

neonConfig.webSocketConstructor = ws  // Node.js only

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
export const db = drizzle(pool, { schema })
```

**Decision**: Start with HTTP (`neon` + `drizzle-orm/neon-http`) for simple CRUD. Upgrade to Pool/WebSocket when interactive transactions are needed (e.g. signal ingestion that writes to multiple tables atomically).

#### Passing `db` to Hono Handlers

Use Hono's type-safe context variables pattern. Define a `Variables` type and inject `db` via middleware:

```typescript
// src/types.ts
import type { db as DbType } from './db'

export type AppVariables = {
  db: typeof DbType
}

// src/app.ts
import { Hono } from 'hono'
import type { AppVariables } from './types'
import { db } from './db'

const app = new Hono<{ Variables: AppVariables }>()

app.use('*', async (c, next) => {
  c.set('db', db)
  await next()
})
```

Handlers access via `const db = c.get('db')`. This pattern also makes testing trivial — inject a PGLite-backed `db` into the test context.

---

### 3. Schema Organisation

#### Recommended Structure: Per-Domain-Group Files

```
src/db/
├── index.ts               # drizzle() client export
├── schema/
│   ├── index.ts           # re-exports all schema files with `export * from`
│   ├── _helpers.ts        # shared columns: timestamps, audit fields
│   ├── projects.ts        # projects, goals tables
│   ├── issues.ts          # issues, labels, issue_labels, issue_relations, comments
│   ├── signals.ts         # signals table
│   └── prompts.ts         # prompt_templates, prompt_versions, prompt_reviews
└── relations/
    └── index.ts           # Drizzle relations() declarations (separate from table defs)
```

`drizzle.config.ts` points to the schema directory:

```typescript
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema',      // recursive discovery
  out: './drizzle/migrations',
  dbCredentials: { url: process.env.DATABASE_URL! }
})
```

#### Shared Column Helpers

```typescript
// src/db/schema/_helpers.ts
import { timestamp } from 'drizzle-orm/pg-core'

export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date', precision: 3 })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date', precision: 3 })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
}
```

#### Enums

Use `pgEnum` with TypeScript `as const` arrays to keep a single source of truth:

```typescript
// src/db/schema/issues.ts
import { pgEnum, pgTable, text, integer } from 'drizzle-orm/pg-core'

export const issueStatusValues = ['open', 'in_progress', 'resolved', 'closed'] as const
export type IssueStatus = (typeof issueStatusValues)[number]
export const issueStatusEnum = pgEnum('issue_status', issueStatusValues)

export const issueTypeValues = ['bug', 'feature', 'task', 'improvement'] as const
export type IssueType = (typeof issueTypeValues)[number]
export const issueTypeEnum = pgEnum('issue_type', issueTypeValues)

export const issuePriorityValues = ['critical', 'high', 'medium', 'low'] as const
export type IssuePriority = (typeof issuePriorityValues)[number]
export const issuePriorityEnum = pgEnum('issue_priority', issuePriorityValues)
```

Exporting both the `as const` array and the `pgEnum` lets you use the values in Zod schemas (`z.enum(issueStatusValues)`) and in Drizzle column definitions.

#### JSONB Fields

Type JSONB columns using `.$type<T>()`. Create GIN indexes for JSONB fields that will be queried:

```typescript
import { jsonb, index } from 'drizzle-orm/pg-core'

export type SignalMetadata = {
  source: string
  rawPayload: Record<string, unknown>
  tags?: string[]
}

export const signals = pgTable('signals', {
  // ...
  metadata: jsonb('metadata').$type<SignalMetadata>().notNull(),
}, (table) => [
  index('signals_metadata_gin_idx').using('gin', table.metadata),
])
```

#### Primary Keys and IDs

Use `text` primary keys with `nanoid` or `cuid2` for external-facing IDs (URL-safe, no sequential enumeration). Use integer identity columns for internal relations:

```typescript
import { pgTable, text, integer } from 'drizzle-orm/pg-core'

// Option A: text CUID2 everywhere (simpler, safer for public IDs)
export const projects = pgTable('projects', {
  id: text('id').primaryKey().$defaultFn(() => createId()),  // cuid2
  // ...
})

// Option B: hybrid (integer PK internal + text publicId for API)
export const projects = pgTable('projects', {
  id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
  publicId: text('public_id').notNull().unique().$defaultFn(() => createId()),
  // ...
})
```

**Recommendation**: For Loop MVP, use text CUID2 primary keys everywhere for simplicity. Internal performance optimisation with integer PKs can come later.

---

### 4. Migrations Workflow

#### Development Workflow

```bash
# 1. Edit schema files in src/db/schema/
# 2. Generate SQL migration file
npx drizzle-kit generate

# 3. Inspect the generated SQL in drizzle/migrations/
# 4. Apply to local Docker Postgres
npx drizzle-kit migrate
```

Use `drizzle-kit push` only for one-off local experiments (does not create versioned files).

#### Production Deployment Strategy

**Option A: Migration script in Vercel build step (recommended)**

Add a `db:migrate` npm script and call it in the Vercel build command:

```json
// package.json (apps/api)
{
  "scripts": {
    "db:migrate": "tsx src/db/migrate.ts",
    "build": "npm run db:migrate && tsc"
  }
}
```

```typescript
// src/db/migrate.ts
import { drizzle } from 'drizzle-orm/neon-http'
import { migrate } from 'drizzle-orm/neon-http/migrator'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)
const db = drizzle(sql)

await migrate(db, { migrationsFolder: './drizzle/migrations' })
console.log('Migrations complete')
process.exit(0)
```

**Option B: Separate migration Vercel Function**

Add a `/admin/migrate` endpoint protected by a strong secret, callable from CI. Less clean but useful when build-time migration isn't feasible.

**Never** run migrations inside a request handler — cold-start latency is unacceptable.

---

### 5. API Key Authentication

#### Approach: Hashed Keys in Database

Store a SHA-256 or bcrypt hash of the API key, never the plaintext. The workflow:

1. On key creation: generate 32-byte random token → return plaintext once → store `sha256(token)` in DB.
2. On each request: hash the incoming bearer token → constant-time compare with stored hash.

Using SHA-256 (fast) is appropriate for API keys (high-entropy, not passwords). Bcrypt adds unnecessary compute cost for keys that are already 256-bit random strings.

#### Hono Implementation

```typescript
// src/middleware/auth.ts
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import { createHash, timingSafeEqual } from 'node:crypto'
import type { AppVariables } from '../types'

export const apiKeyAuth = createMiddleware<{ Variables: AppVariables }>(
  async (c, next) => {
    const authHeader = c.req.header('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      throw new HTTPException(401, { message: 'Missing or malformed Authorization header' })
    }

    const token = authHeader.slice(7)
    const db = c.get('db')

    // Hash incoming token
    const tokenHash = createHash('sha256').update(token).digest('hex')

    // Lookup in DB
    const keyRecord = await db.query.apiKeys.findFirst({
      where: (keys, { eq }) => eq(keys.keyHash, tokenHash),
    })

    if (!keyRecord || !keyRecord.active) {
      throw new HTTPException(401, { message: 'Invalid or inactive API key' })
    }

    // Constant-time comparison (double-check; hashing already ensures this, but belt-and-suspenders)
    const storedHash = Buffer.from(keyRecord.keyHash, 'hex')
    const incomingHash = Buffer.from(tokenHash, 'hex')
    if (storedHash.length !== incomingHash.length || !timingSafeEqual(storedHash, incomingHash)) {
      throw new HTTPException(401, { message: 'Invalid API key' })
    }

    c.set('projectId', keyRecord.projectId)
    await next()
  }
)
```

Apply only to protected route groups:

```typescript
app.use('/api/v1/*', apiKeyAuth)
```

---

### 6. Webhook Signature Verification

#### Per-Provider Middleware Pattern

Each webhook provider has its own signing scheme. Build a middleware factory per provider:

```typescript
// src/middleware/webhooks.ts
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import { createHmac, timingSafeEqual } from 'node:crypto'

// ---- GitHub ----
// Header: X-Hub-Signature-256 (value: "sha256=<hex>")
// Signs: raw request body
export const githubWebhookAuth = (secret: string) =>
  createMiddleware(async (c, next) => {
    const signature = c.req.header('x-hub-signature-256')
    if (!signature) throw new HTTPException(401, { message: 'Missing GitHub signature' })

    const body = await c.req.text()
    const expected = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex')

    const expectedBuf = Buffer.from(expected)
    const signatureBuf = Buffer.from(signature)
    if (
      expectedBuf.length !== signatureBuf.length ||
      !timingSafeEqual(expectedBuf, signatureBuf)
    ) {
      throw new HTTPException(401, { message: 'Invalid GitHub signature' })
    }

    // Re-parse body as JSON for the handler
    c.set('webhookBody', JSON.parse(body))
    await next()
  })

// ---- Sentry ----
// Header: Sentry-Hook-Signature (value: "<hex>")
// Signs: JSON.stringify(request.body) — note: signs the serialised body, not raw bytes
export const sentryWebhookAuth = (clientSecret: string) =>
  createMiddleware(async (c, next) => {
    const signature = c.req.header('sentry-hook-signature')
    if (!signature) throw new HTTPException(401, { message: 'Missing Sentry signature' })

    const body = await c.req.json()
    const expected = createHmac('sha256', clientSecret)
      .update(JSON.stringify(body))
      .digest('hex')

    const expectedBuf = Buffer.from(expected)
    const signatureBuf = Buffer.from(signature)
    if (
      expectedBuf.length !== signatureBuf.length ||
      !timingSafeEqual(expectedBuf, signatureBuf)
    ) {
      throw new HTTPException(401, { message: 'Invalid Sentry signature' })
    }

    c.set('webhookBody', body)
    await next()
  })

// ---- PostHog ----
// PostHog does not currently provide webhook payload signature verification
// (their action webhooks are authenticated by IP allowlist or simply not signed).
// Mitigation: require a secret query parameter or custom header set in the PostHog webhook config.
export const postHogWebhookAuth = (secret: string) =>
  createMiddleware(async (c, next) => {
    const incomingSecret = c.req.header('x-posthog-secret') ?? c.req.query('secret')
    if (!incomingSecret) throw new HTTPException(401, { message: 'Missing PostHog secret' })

    const secretBuf = Buffer.from(secret)
    const incomingBuf = Buffer.from(incomingSecret)
    if (
      secretBuf.length !== incomingBuf.length ||
      !timingSafeEqual(secretBuf, incomingBuf)
    ) {
      throw new HTTPException(401, { message: 'Invalid PostHog secret' })
    }

    await next()
  })
```

Register on specific webhook routes only:

```typescript
app.post('/webhooks/github', githubWebhookAuth(process.env.GITHUB_WEBHOOK_SECRET!), handleGithubWebhook)
app.post('/webhooks/sentry', sentryWebhookAuth(process.env.SENTRY_CLIENT_SECRET!), handleSentryWebhook)
app.post('/webhooks/posthog', postHogWebhookAuth(process.env.POSTHOG_WEBHOOK_SECRET!), handlePostHogWebhook)
```

**Important note on raw body preservation**: GitHub signs the raw byte payload. Hono's `c.req.json()` parses and re-serialises, which may change whitespace. Always use `c.req.text()` for signature verification on raw-body-signed providers (GitHub), then `JSON.parse()` manually.

---

### 7. Hono Error Handling and Validation

#### Global Error Handler

```typescript
// src/app.ts
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { ZodError } from 'zod'

const app = new Hono()

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
```

#### Request Validation with `@hono/zod-validator`

```typescript
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'

const createIssueSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  status: z.enum(issueStatusValues).default('open'),
  priority: z.enum(issuePriorityValues).default('medium'),
  projectId: z.string().cuid2(),
})

app.post(
  '/api/v1/issues',
  apiKeyAuth,
  zValidator('json', createIssueSchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: 'Validation error', details: result.error.flatten() }, 422)
    }
  }),
  async (c) => {
    const body = c.req.valid('json')  // fully typed
    const db = c.get('db')
    // ...
  }
)
```

**Key rule**: Do not apply `zValidator` via `app.use()` globally. It must be per-route to preserve Hono's type inference for `c.req.valid()`.

---

### 8. Testing Strategy

#### Recommended: PGLite In-Memory Database Per Test File

PGLite (`@electric-sql/pglite`) runs real WASM Postgres in-process. No Docker, no network, real SQL constraints and indexes.

**Setup file** (`test/setup.ts`):

```typescript
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { sql } from 'drizzle-orm'
import { afterAll, afterEach, vi } from 'vitest'
import * as schema from '../src/db/schema'

// Replace the real DB module with a PGLite instance
vi.mock('../src/db', async (importOriginal) => {
  const client = new PGlite()
  const db = drizzle(client, { schema })

  // Push schema (no migration files needed for tests)
  // Use drizzle-kit push or apply migrations programmatically
  return {
    ...(await importOriginal<typeof import('../src/db')>()),
    db,
    client,
  }
})

afterEach(async () => {
  const { db } = await import('../src/db')
  // Wipe and recreate public schema between tests
  await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`)
  await db.execute(sql`CREATE SCHEMA public`)
})

afterAll(async () => {
  const { client } = await import('../src/db') as any
  await client.close()
})
```

**Test pattern** (using Hono's `app.request()`):

```typescript
// test/issues.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { app } from '../src/app'

const TEST_API_KEY = 'test-key-12345'

describe('Issues API', () => {
  beforeAll(async () => {
    // Seed: create project and API key in the test DB
  })

  it('POST /api/v1/issues creates an issue', async () => {
    const res = await app.request('/api/v1/issues', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TEST_API_KEY}`,
      },
      body: JSON.stringify({
        title: 'Test issue',
        projectId: 'test-project-id',
      }),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toMatchObject({ title: 'Test issue' })
  })

  it('POST /api/v1/issues returns 422 for invalid body', async () => {
    const res = await app.request('/api/v1/issues', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TEST_API_KEY}`,
      },
      body: JSON.stringify({ title: '' }),  // fails min(1)
    })

    expect(res.status).toBe(422)
  })

  it('GET /api/v1/issues returns 401 without auth', async () => {
    const res = await app.request('/api/v1/issues')
    expect(res.status).toBe(401)
  })
})
```

#### Alternative: Transaction Savepoint Rollback (Real Database)

For integration tests that must run against a real Postgres instance (e.g. CI with a Neon branch), use the savepoint pattern:

- `beforeAll`: `BEGIN` a transaction
- `beforeEach`: `SAVEPOINT test_<uuid>`
- `afterEach`: `ROLLBACK TO SAVEPOINT test_<uuid>`
- `afterAll`: `ROLLBACK` the entire transaction

This is more complex to wire up (requires mocking `NodePgTransaction.prototype.execute`) but gives perfect production fidelity.

**Recommendation for Loop**: Use PGLite for unit/integration tests (speed, no infra). Add a separate CI job that runs against a real Neon branch for end-to-end tests.

---

## Potential Solutions Summary

| Decision Point | Option A | Option B | Option C | Recommendation |
|---|---|---|---|---|
| PostgreSQL hosting | **Neon** (serverless, branching) | Supabase (BaaS) | Self-hosted Docker | **Neon** |
| Local dev DB | Docker Compose + Neon WS proxy | Supabase local CLI | Plain `postgres` Docker | **Docker + Neon WS proxy** |
| Connection driver | `@neondatabase/serverless` HTTP | `@neondatabase/serverless` Pool/WS | `pg` with pool | **HTTP for CRUD, Pool for transactions** |
| Schema organisation | Single `schema.ts` | Per-entity files | **Per-domain-group files** | **Per-domain-group** |
| Migration workflow | `drizzle-kit push` only | `drizzle-kit generate` + CLI | **generate + programmatic `migrate()`** | **generate + programmatic migrate in build step** |
| Testing DB | **PGLite in-memory** | Real DB + transaction rollback | Mocks/stubs | **PGLite** |
| Webhook verification | Single generic middleware | **Per-provider middleware factory** | Third-party library | **Per-provider middleware** |
| API key storage | Plaintext | bcrypt hash | **SHA-256 hash** | **SHA-256** (keys are high-entropy, don't need bcrypt cost) |

---

## Security Considerations

### SQL Injection
Drizzle ORM uses parameterised queries by default. All `db.select()`, `db.insert()`, `db.update()`, `db.delete()` calls are safe. The only risk surface is `db.execute(sql`...`)` with user input — always use tagged template literals (`sql` tag handles escaping) or parameterised `sql.placeholder`.

### API Key Storage
- Never store plaintext API keys.
- Store SHA-256 hash (for high-entropy keys, this is sufficient and avoids bcrypt overhead).
- Return the plaintext key only once on creation (display + copy, never retrievable again).
- Implement key rotation (mark old key inactive, create new key).
- Rate-limit key creation and auth failure endpoints.

### Webhook Signature Verification
- Always verify before processing payload.
- Use `crypto.timingSafeEqual` — never `===` for signature comparison.
- Validate `Content-Type` is `application/json` before parsing.
- Reject payloads larger than a reasonable size (e.g. 1 MB) to prevent DoS.
- For GitHub: read raw body as text before JSON.parse (prevent signature bypass via re-serialisation).
- For Sentry: be aware that issue alert webhooks sign a sub-object, not the full body.
- For PostHog: no HMAC verification available; use a shared secret in a custom header.

### Environment Variables
- Never hardcode secrets in source code.
- Use `.env.local` (git-ignored) for local development.
- Use Vercel environment variables UI for staging/production.
- Scope secrets to environments (avoid production secrets in preview deployments).

### CORS and Route Protection
- Apply `bearerAuth` / `apiKeyAuth` middleware to all `/api/v1/*` routes.
- Webhook routes use their own verification middleware (different auth scheme).
- Admin routes (e.g. `/admin/migrate`) protected by a separate strong secret.

---

## Performance Considerations

### Connection Pooling in Serverless
- With Vercel Fluid Compute (Node.js runtime), warm instances persist and connection can be reused across invocations.
- Initialise `neon()` client **outside** the handler function at module scope.
- For Neon HTTP driver: each call creates a new HTTP request over TCP, but TLS session resumption minimises overhead.
- For the Pool/WebSocket driver: pool must be created and closed within a single request on cold starts; with warm instances it can be reused.
- **Do not double-pool**: do not use client-side pooling AND Neon's built-in connection pooler simultaneously.

### Prepared Statements
- Drizzle supports prepared statements with `.prepare('name')`.
- For frequently-called endpoints (list issues, get project), declare prepared statements at module scope for reuse across warm invocations.

### Index Strategy
- Add B-tree indexes on all foreign keys (Drizzle does not auto-index FKs).
- Add composite indexes for common query patterns: `(project_id, status)` on issues, `(project_id, created_at DESC)` for list queries.
- Add GIN indexes on JSONB `metadata` columns in `signals`.
- Add partial indexes where useful: `WHERE deleted_at IS NULL` for soft-delete patterns.

### Query Optimisation
- Use `db.select({ id: table.id, title: table.title })` (column selection) instead of `db.select()` for list endpoints to reduce payload.
- Use `db.query.*` (Relational API) for deeply nested data (single query with joins vs N+1).
- Paginate all list endpoints — default limit 50, max 200.

---

## Research Gaps and Limitations

1. **PostHog webhook signature**: PostHog's action webhooks (as of early 2026) do not support HMAC signature verification. Mitigation is to use a shared secret in a custom header. This should be re-verified when implementing as PostHog may have added signing.

2. **Drizzle ORM schema splitting in monorepos**: There is a known bug (issue #1558) in drizzle-orm where splitting schemas into a separate package causes TypeScript errors (`Property [IsDrizzleTable] is missing`). Since Loop's schema lives within `apps/api/src/db/`, this should not be an issue (same package), but watch for it if schema is ever extracted to a shared package.

3. **Vercel Fluid Compute**: The new connection pooling behaviour with Fluid Compute (replacing the classic serverless model) is relatively new (2024-2025). Behaviour around connection persistence across invocations is improving but not perfectly documented. Test with `attachDatabasePool` helper if using `pg` instead of Neon's driver.

4. **PGLite WASM limitations**: PGLite does not support all PostgreSQL extensions. If schema uses extensions like `pgcrypto`, `uuid-ossp`, or PostGIS, PGLite tests may diverge from production. For Loop's schema (standard types, enums, JSONB), PGLite should be fully compatible.

---

## Contradictions and Disputes

1. **HTTP vs WebSocket for Neon**: Neon's own docs say HTTP is faster for single queries but WebSocket is required for interactive transactions. Some community guides recommend WebSocket everywhere for simplicity. **Resolution**: Use HTTP for read/single-write operations (the majority of endpoints) and upgrade to WebSocket pool for transaction-heavy signal ingestion.

2. **bcrypt vs SHA-256 for API keys**: Some security literature says always use bcrypt for anything resembling a password. However, the cryptographic consensus is that SHA-256 is appropriate for high-entropy (32+ byte random) secrets because the entropy already makes brute-force infeasible. **Resolution**: Use SHA-256 for API keys (they are randomly generated, not user-chosen). Use bcrypt/argon2 for user passwords.

3. **`drizzle-kit push` vs `drizzle-kit migrate`**: Drizzle docs say push is for development only. Some blog posts use push in production for simplicity. **Resolution**: Never use push in production — it can drop columns and data. Always use versioned migration files.

---

## Search Methodology

- Searches performed: 18 web searches + 10 page fetches
- Most productive search terms:
  - `Drizzle ORM Hono TypeScript best practices 2025`
  - `Neon PostgreSQL serverless driver Drizzle ORM integration 2025`
  - `PGlite in-memory PostgreSQL Drizzle testing vitest 2025 setup`
  - `Hono middleware auth bearer token API key best practices`
  - `Drizzle ORM migrations Vercel Functions serverless 2025`
- Primary information sources:
  - orm.drizzle.team (official Drizzle docs)
  - neon.com/docs (official Neon docs)
  - hono.dev (official Hono docs)
  - gist.github.com/productdevbook (Drizzle PG best practices 2025)
  - github.com/rphlmr/drizzle-vitest-pg (PGLite Vitest integration example)
  - github.com/chimame (transaction rollback Vitest pattern)
  - docs.github.com (GitHub webhook verification)
  - docs.sentry.io (Sentry webhook verification)

---

## Sources

- [Drizzle ORM PostgreSQL Best Practices Guide (2025)](https://gist.github.com/productdevbook/7c9ce3bbeb96b3fabc3c7c2aa2abc717)
- [Drizzle ORM - Schema Declaration](https://orm.drizzle.team/docs/sql-schema-declaration)
- [Drizzle ORM - Migrations](https://orm.drizzle.team/docs/migrations)
- [Drizzle ORM - Serverless Performance](https://orm.drizzle.team/docs/perf-serverless)
- [Drizzle ORM - PGLite](https://orm.drizzle.team/docs/connect-pglite)
- [Drizzle ORM - Connect Neon](https://orm.drizzle.team/docs/connect-neon)
- [Drizzle ORM - Vercel Edge Functions](https://orm.drizzle.team/docs/tutorials/drizzle-with-vercel-edge-functions)
- [Drizzle with Local and Serverless Postgres - Neon Guides](https://neon.com/guides/drizzle-local-vercel)
- [Neon Serverless Driver](https://neon.com/docs/serverless/serverless-driver)
- [Connecting to Neon from Vercel](https://neon.com/docs/guides/vercel-connection-methods)
- [GitHub - rphlmr/drizzle-vitest-pg: Drizzle & PGLite with Vitest](https://github.com/rphlmr/drizzle-vitest-pg)
- [Automatic rollback of Vitest using Drizzle (gist)](https://gist.github.com/chimame/f8ab9ae3172ded0e97f64010cad3d578)
- [Hono Bearer Auth Middleware](https://hono.dev/docs/middleware/builtin/bearer-auth)
- [Hono Testing Guide](https://hono.dev/docs/guides/testing)
- [Hono Context API](https://hono.dev/docs/api/context)
- [Hono Validation Guide](https://hono.dev/docs/guides/validation)
- [Validating GitHub Webhook Deliveries](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries)
- [Sentry Webhooks Documentation](https://docs.sentry.io/organization/integrations/integration-platform/webhooks/)
- [Connection Pooling with Vercel Functions](https://vercel.com/kb/guide/connection-pooling-with-functions)
- [Neon vs Supabase PostgreSQL Comparison](https://www.devtoolsacademy.com/blog/neon-vs-supabase/)
- [ENUM with TypeScript, Zod AND Drizzle ORM](https://medium.com/@lior_amsalem/enum-with-typescript-zod-and-drizzle-orm-f7449a8b37d5)
