---
slug: data-layer-core-api
number: 2
created: 2026-02-19
status: draft
---

# Specification: Data Layer & Core API

**Status:** Draft
**Author:** Claude Code
**Date:** 2026-02-19
**Spec:** `specs/data-layer-core-api/`
**Ideation:** `specs/data-layer-core-api/01-ideation.md`
**Phase:** 1 of 4 (see `specs/mvp-build-plan.md`)

---

## Overview

Set up PostgreSQL (Neon) + Drizzle ORM in the existing Hono API (`apps/api/`) and implement the complete data layer and CRUD API for Loop's 11 database tables. This is the foundation phase — every subsequent phase (prompt engine, dashboard, CLI) depends on the schema and endpoints built here.

The API will support full CRUD for issues, projects, goals, labels, relations, and comments; signal ingestion via generic and provider-specific webhook endpoints; basic CRUD for prompt templates, versions, and reviews; and Bearer token authentication on all protected routes.

---

## Background / Problem Statement

Loop is an autonomous improvement engine that closes the feedback loop for AI-powered development. It needs a robust data layer to store issues (the atomic unit of work), projects, goals, signals, prompt templates, and their relationships. Currently, `apps/api/` has only a health check and service info endpoint with no database.

This phase establishes the complete schema for all 11 entities defined in the MVP spec, along with the CRUD API that agents and humans will use to create, read, update, and manage work items. Without this foundation, no other Loop functionality can be built.

---

## Goals

- Establish PostgreSQL + Drizzle ORM as the persistence layer for the Loop API
- Implement the complete database schema for all 11 entities with proper types, constraints, indexes, and relations
- Provide full CRUD API endpoints for all entity types
- Enable signal ingestion from PostHog, GitHub, Sentry, and manual sources
- Enforce the 1-level issue hierarchy constraint at the API level
- Protect all API routes with Bearer token authentication
- Implement soft delete across all entities for auditability
- Achieve comprehensive test coverage using PGLite (in-memory Postgres)
- Generate versioned Drizzle migrations that can be applied programmatically

---

## Non-Goals

- Prompt template selection algorithm and conditions matching (Phase 2)
- Handlebars template hydration (Phase 2)
- Dispatch endpoint `/api/dispatch/next` and priority scoring (Phase 2)
- Prompt improvement loop trigger (auto-create issue on low scores) (Phase 2)
- Template preview endpoint `/api/templates/preview/:issueId` (Phase 2)
- Dashboard aggregate endpoints `/api/dashboard/*` (Phase 3)
- React frontend (Phase 3)
- CLI tool (Phase 4)
- Multi-user authentication (post-MVP)
- Signal deduplication (post-MVP)
- Auto-promote prompt versions (post-MVP)

---

## Technical Dependencies

| Dependency                 | Version | Purpose                                  |
| -------------------------- | ------- | ---------------------------------------- |
| `hono`                     | ^4      | HTTP framework (already installed)       |
| `@hono/node-server`        | ^1      | Local dev server (already installed)     |
| `drizzle-orm`              | ^0.38   | Type-safe ORM                            |
| `@neondatabase/serverless` | ^1      | Neon PostgreSQL serverless driver        |
| `drizzle-kit`              | ^0.30   | Schema migration generator (dev)         |
| `@electric-sql/pglite`     | ^0.2    | In-memory Postgres for tests (dev)       |
| `@paralleldrive/cuid2`     | ^2      | CUID2 ID generation                      |
| `zod`                      | ^3      | Request validation schemas               |
| `@hono/zod-validator`      | ^0.4    | Hono + Zod integration                   |
| `ws`                       | ^8      | WebSocket for Neon Pool driver (Node.js) |
| `dotenv`                   | ^16     | Environment variable loading             |

---

## Detailed Design

### 1. Project Structure

All new code lives in `apps/api/src/`. The structure follows per-domain-group schema organization:

```
apps/api/
├── src/
│   ├── index.ts                    # App entry point (modified)
│   ├── app.ts                      # Hono app instance + middleware (new)
│   ├── db/
│   │   ├── index.ts                # Drizzle client export
│   │   ├── migrate.ts              # Programmatic migration runner
│   │   └── schema/
│   │       ├── index.ts            # Barrel re-export
│   │       ├── _helpers.ts         # Shared columns (timestamps, soft delete, IDs)
│   │       ├── issues.ts           # issues, labels, issue_labels, issue_relations, comments
│   │       ├── projects.ts         # projects, goals
│   │       ├── signals.ts          # signals
│   │       └── prompts.ts          # prompt_templates, prompt_versions, prompt_reviews
│   ├── routes/
│   │   ├── issues.ts               # Issue CRUD + filtering
│   │   ├── projects.ts             # Project CRUD
│   │   ├── goals.ts                # Goal CRUD
│   │   ├── labels.ts               # Label CRUD
│   │   ├── comments.ts             # Comment CRUD (nested under issues)
│   │   ├── relations.ts            # Relation CRUD (nested under issues)
│   │   ├── signals.ts              # Signal ingestion + webhook handlers
│   │   └── templates.ts            # Template + Version + Review CRUD
│   ├── middleware/
│   │   ├── auth.ts                 # Bearer token auth
│   │   └── webhooks.ts             # Per-provider webhook signature verification
│   └── __tests__/
│       ├── setup.ts                # PGLite test database setup
│       ├── issues.test.ts
│       ├── projects.test.ts
│       ├── goals.test.ts
│       ├── labels.test.ts
│       ├── comments.test.ts
│       ├── relations.test.ts
│       ├── signals.test.ts
│       └── templates.test.ts
├── drizzle/
│   └── migrations/                 # Generated SQL migration files
├── drizzle.config.ts               # Drizzle Kit configuration
├── .env.example                    # Example environment variables
└── package.json                    # Updated with new dependencies
```

### 2. Database Schema

#### 2.1 Shared Helpers (`_helpers.ts`)

```typescript
// Reusable column definitions
export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
};

export const softDelete = {
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
};

export const cuid2Id = {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
};
```

#### 2.2 Issues Domain (`issues.ts`)

**Enums:**

```typescript
export const issueTypeValues = ['signal', 'hypothesis', 'plan', 'task', 'monitor'] as const;
export const issueTypeEnum = pgEnum('issue_type', issueTypeValues);

export const issueStatusValues = [
  'triage',
  'backlog',
  'todo',
  'in_progress',
  'done',
  'canceled',
] as const;
export const issueStatusEnum = pgEnum('issue_status', issueStatusValues);

export const relationTypeValues = ['blocks', 'blocked_by', 'related', 'duplicate'] as const;
export const relationTypeEnum = pgEnum('relation_type', relationTypeValues);

export const authorTypeValues = ['human', 'agent'] as const;
export const authorTypeEnum = pgEnum('author_type', authorTypeValues);
```

**Issues table:**

| Column             | Type              | Constraints                                                     |
| ------------------ | ----------------- | --------------------------------------------------------------- |
| `id`               | text (CUID2)      | PK                                                              |
| `number`           | serial            | unique, auto-increment, immutable                               |
| `title`            | text              | not null                                                        |
| `description`      | text              | nullable                                                        |
| `type`             | issue_type enum   | not null                                                        |
| `status`           | issue_status enum | not null, default 'triage'                                      |
| `priority`         | integer           | not null, default 0 (0=none, 1=urgent, 2=high, 3=medium, 4=low) |
| `parent_id`        | text              | FK → issues.id, nullable                                        |
| `project_id`       | text              | FK → projects.id, nullable                                      |
| `signal_source`    | text              | nullable                                                        |
| `signal_payload`   | jsonb             | nullable, typed `SignalPayload`                                 |
| `hypothesis`       | jsonb             | nullable, typed `HypothesisData`                                |
| `agent_session_id` | text              | nullable                                                        |
| `agent_summary`    | text              | nullable                                                        |
| `commits`          | jsonb             | nullable, typed `CommitRef[]`                                   |
| `pull_requests`    | jsonb             | nullable, typed `PullRequestRef[]`                              |
| `completed_at`     | timestamptz       | nullable                                                        |
| `created_at`       | timestamptz       | not null, default now                                           |
| `updated_at`       | timestamptz       | not null, default now                                           |
| `deleted_at`       | timestamptz       | nullable (soft delete)                                          |

**Indexes:**

- `idx_issues_project_status` — composite `(project_id, status)` for filtered list queries
- `idx_issues_parent_id` — for child lookups
- `idx_issues_type` — for type-filtered queries
- `idx_issues_status` — for status-filtered queries
- `idx_issues_number` — unique, for human-friendly lookups

**JSONB types:**

```typescript
export type SignalPayload = Record<string, unknown>;

export type HypothesisData = {
  statement: string;
  confidence: number;
  evidence: string[];
  validationCriteria: string;
  prediction?: string;
};

export type CommitRef = { sha: string; message: string; url?: string };
export type PullRequestRef = { number: number; url: string; status: string; merged: boolean };
```

**Labels table:**

| Column       | Type         | Constraints      |
| ------------ | ------------ | ---------------- |
| `id`         | text (CUID2) | PK               |
| `name`       | text         | not null, unique |
| `color`      | text         | not null         |
| `created_at` | timestamptz  | not null         |
| `deleted_at` | timestamptz  | nullable         |

**IssueLabels table (join):**

| Column      | Type      | Constraints              |
| ----------- | --------- | ------------------------ |
| `issue_id`  | text      | FK → issues.id, not null |
| `label_id`  | text      | FK → labels.id, not null |
| Primary key | composite | (issue_id, label_id)     |

**IssueRelations table:**

| Column             | Type               | Constraints              |
| ------------------ | ------------------ | ------------------------ |
| `id`               | text (CUID2)       | PK                       |
| `type`             | relation_type enum | not null                 |
| `issue_id`         | text               | FK → issues.id, not null |
| `related_issue_id` | text               | FK → issues.id, not null |
| `created_at`       | timestamptz        | not null                 |

**Indexes:**

- `idx_relations_issue_id` — for looking up relations for an issue
- `idx_relations_related_issue_id` — for reverse lookups

**Comments table:**

| Column        | Type             | Constraints                            |
| ------------- | ---------------- | -------------------------------------- |
| `id`          | text (CUID2)     | PK                                     |
| `body`        | text             | not null                               |
| `issue_id`    | text             | FK → issues.id, not null               |
| `author_name` | text             | not null                               |
| `author_type` | author_type enum | not null                               |
| `parent_id`   | text             | FK → comments.id, nullable (threading) |
| `created_at`  | timestamptz      | not null                               |

**Indexes:**

- `idx_comments_issue_id` — for listing comments on an issue

#### 2.3 Projects Domain (`projects.ts`)

**Enums:**

```typescript
export const projectStatusValues = [
  'backlog',
  'planned',
  'active',
  'paused',
  'completed',
  'canceled',
] as const;
export const projectStatusEnum = pgEnum('project_status', projectStatusValues);

export const projectHealthValues = ['on_track', 'at_risk', 'off_track'] as const;
export const projectHealthEnum = pgEnum('project_health', projectHealthValues);

export const goalStatusValues = ['active', 'achieved', 'abandoned'] as const;
export const goalStatusEnum = pgEnum('goal_status', goalStatusValues);
```

**Projects table:**

| Column        | Type                | Constraints                  |
| ------------- | ------------------- | ---------------------------- |
| `id`          | text (CUID2)        | PK                           |
| `name`        | text                | not null                     |
| `description` | text                | nullable                     |
| `status`      | project_status enum | not null, default 'backlog'  |
| `health`      | project_health enum | not null, default 'on_track' |
| `goal_id`     | text                | FK → goals.id, nullable      |
| `created_at`  | timestamptz         | not null                     |
| `updated_at`  | timestamptz         | not null                     |
| `deleted_at`  | timestamptz         | nullable                     |

**Goals table:**

| Column          | Type             | Constraints                |
| --------------- | ---------------- | -------------------------- |
| `id`            | text (CUID2)     | PK                         |
| `title`         | text             | not null                   |
| `description`   | text             | nullable                   |
| `metric`        | text             | nullable                   |
| `target_value`  | double precision | nullable                   |
| `current_value` | double precision | nullable                   |
| `unit`          | text             | nullable                   |
| `status`        | goal_status enum | not null, default 'active' |
| `project_id`    | text             | FK → projects.id, nullable |
| `created_at`    | timestamptz      | not null                   |
| `updated_at`    | timestamptz      | not null                   |
| `deleted_at`    | timestamptz      | nullable                   |

#### 2.4 Signals Domain (`signals.ts`)

**Enums:**

```typescript
export const signalSeverityValues = ['low', 'medium', 'high', 'critical'] as const;
export const signalSeverityEnum = pgEnum('signal_severity', signalSeverityValues);
```

**Signals table:**

| Column       | Type                 | Constraints              |
| ------------ | -------------------- | ------------------------ |
| `id`         | text (CUID2)         | PK                       |
| `source`     | text                 | not null                 |
| `source_id`  | text                 | nullable                 |
| `type`       | text                 | not null                 |
| `severity`   | signal_severity enum | not null                 |
| `payload`    | jsonb                | not null                 |
| `issue_id`   | text                 | FK → issues.id, not null |
| `created_at` | timestamptz          | not null                 |

**Indexes:**

- `idx_signals_issue_id` — for looking up signal by issue
- `idx_signals_source` — for filtering by source
- `idx_signals_payload_gin` — GIN index on payload for JSONB queries

#### 2.5 Prompts Domain (`prompts.ts`)

**Enums:**

```typescript
export const promptVersionStatusValues = ['active', 'draft', 'retired'] as const;
export const promptVersionStatusEnum = pgEnum('prompt_version_status', promptVersionStatusValues);
```

**PromptTemplates table:**

| Column              | Type         | Constraints                                   |
| ------------------- | ------------ | --------------------------------------------- |
| `id`                | text (CUID2) | PK                                            |
| `slug`              | text         | not null, unique                              |
| `name`              | text         | not null                                      |
| `description`       | text         | nullable                                      |
| `conditions`        | jsonb        | not null, default `{}`                        |
| `specificity`       | integer      | not null, default 10                          |
| `project_id`        | text         | FK → projects.id, nullable                    |
| `active_version_id` | text         | nullable (FK set after first version created) |
| `created_at`        | timestamptz  | not null                                      |
| `updated_at`        | timestamptz  | not null                                      |
| `deleted_at`        | timestamptz  | nullable                                      |

**PromptVersions table:**

| Column            | Type                       | Constraints                        |
| ----------------- | -------------------------- | ---------------------------------- |
| `id`              | text (CUID2)               | PK                                 |
| `template_id`     | text                       | FK → prompt_templates.id, not null |
| `version`         | integer                    | not null                           |
| `content`         | text                       | not null                           |
| `changelog`       | text                       | nullable                           |
| `author_type`     | author_type enum           | not null                           |
| `author_name`     | text                       | not null                           |
| `status`          | prompt_version_status enum | not null, default 'draft'          |
| `usage_count`     | integer                    | not null, default 0                |
| `completion_rate` | double precision           | nullable                           |
| `avg_duration_ms` | double precision           | nullable                           |
| `review_score`    | double precision           | nullable                           |
| `created_at`      | timestamptz                | not null                           |

**Indexes:**

- `idx_prompt_versions_template_id` — for listing versions of a template
- Unique constraint: `(template_id, version)` — no duplicate version numbers per template

**PromptReviews table:**

| Column         | Type             | Constraints                       |
| -------------- | ---------------- | --------------------------------- |
| `id`           | text (CUID2)     | PK                                |
| `version_id`   | text             | FK → prompt_versions.id, not null |
| `issue_id`     | text             | FK → issues.id, not null          |
| `clarity`      | integer          | not null, check 1-5               |
| `completeness` | integer          | not null, check 1-5               |
| `relevance`    | integer          | not null, check 1-5               |
| `feedback`     | text             | nullable                          |
| `author_type`  | author_type enum | not null                          |
| `created_at`   | timestamptz      | not null                          |

**Indexes:**

- `idx_prompt_reviews_version_id` — for listing reviews of a version

### 3. Database Connection

#### 3.1 Production/Dev: Neon HTTP Driver

```typescript
// src/db/index.ts
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
export type Database = typeof db;
```

#### 3.2 Transactions: Neon Pool Driver

For endpoints that require multi-table atomicity (signal ingestion), use the Pool driver:

```typescript
// src/db/pool.ts
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from './schema';

neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const poolDb = drizzle(pool, { schema });
```

#### 3.3 Migrations

```typescript
// src/db/migrate.ts
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

await migrate(db, { migrationsFolder: './drizzle/migrations' });
console.log('Migrations complete');
process.exit(0);
```

**Drizzle Kit config:**

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema',
  out: './drizzle/migrations',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

**Migration scripts in `package.json`:**

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

### 4. App Structure

#### 4.1 App Instance (`app.ts`)

Separate the Hono app from the server entry point for testability:

```typescript
// src/app.ts
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';
import { apiKeyAuth } from './middleware/auth';
import { issueRoutes } from './routes/issues';
import { projectRoutes } from './routes/projects';
// ... other route imports

export type AppEnv = {
  Variables: {
    // Empty for now — db is imported directly
  };
};

const app = new Hono<AppEnv>();

// Global error handler
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  if (err instanceof ZodError) {
    return c.json({ error: 'Validation error', details: err.flatten() }, 422);
  }
  console.error(err);
  return c.json({ error: 'Internal server error' }, 500);
});

// Health check (no auth)
app.get('/health', (c) =>
  c.json({ ok: true, service: 'loop-api', timestamp: new Date().toISOString() })
);
app.get('/', (c) => c.json({ name: 'Loop API', version: '0.1.0' }));

// Protected API routes
const api = new Hono<AppEnv>();
api.use('*', apiKeyAuth);
api.route('/issues', issueRoutes);
api.route('/projects', projectRoutes);
api.route('/goals', goalRoutes);
api.route('/labels', labelRoutes);
api.route('/templates', templateRoutes);
api.route('/prompt-reviews', promptReviewRoutes);

app.route('/api', api);

// Signal webhooks (separate auth — provider-specific verification)
app.route('/api/signals', signalRoutes);

export { app };
```

#### 4.2 Server Entry Point (`index.ts`)

```typescript
// src/index.ts
import { serve } from '@hono/node-server';
import { app } from './app';

if (process.env.NODE_ENV !== 'production') {
  const port = parseInt(process.env.PORT || '4242', 10);
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`Loop API running at http://localhost:${info.port}`);
  });
}

export default app;
```

### 5. Authentication Middleware

#### 5.1 Bearer Token Auth (`middleware/auth.ts`)

Simple environment variable comparison using `crypto.timingSafeEqual`:

```typescript
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { timingSafeEqual } from 'node:crypto';
import type { AppEnv } from '../app';

export const apiKeyAuth = createMiddleware<AppEnv>(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: 'Missing or malformed Authorization header' });
  }

  const token = authHeader.slice(7);
  const expected = process.env.LOOP_API_KEY;

  if (!expected) {
    throw new HTTPException(500, { message: 'LOOP_API_KEY not configured' });
  }

  const tokenBuf = Buffer.from(token);
  const expectedBuf = Buffer.from(expected);

  if (tokenBuf.length !== expectedBuf.length || !timingSafeEqual(tokenBuf, expectedBuf)) {
    throw new HTTPException(401, { message: 'Invalid API key' });
  }

  await next();
});
```

#### 5.2 Webhook Verification (`middleware/webhooks.ts`)

Per-provider middleware factories:

- **GitHub**: HMAC-SHA256 on raw body (`X-Hub-Signature-256` header). Read body with `c.req.text()`, verify, then `JSON.parse()`.
- **Sentry**: HMAC-SHA256 on serialized JSON (`Sentry-Hook-Signature` header). Parse body, re-serialize for verification.
- **PostHog**: Shared secret in custom header (`X-PostHog-Secret`) or query param. No HMAC available.

All comparisons use `crypto.timingSafeEqual`.

### 6. API Endpoints

#### 6.1 Shared Patterns

All list endpoints support:

- **Pagination**: `?limit=50&offset=0` (default limit 50, max 200)
- **Soft delete filtering**: Automatically exclude `deleted_at IS NOT NULL`
- **Response format**: `{ data: T[], total: number }` for lists, `{ data: T }` for single items
- **Error format**: `{ error: string, details?: object }` with appropriate HTTP status

All mutation endpoints:

- Validate request body with Zod via `@hono/zod-validator`
- Return 201 for creates, 200 for updates, 204 for deletes
- Soft delete: set `deletedAt = new Date()` instead of removing the row

#### 6.2 Issues (`/api/issues`)

| Method   | Path              | Description                                        |
| -------- | ----------------- | -------------------------------------------------- |
| `GET`    | `/api/issues`     | List issues with filtering                         |
| `POST`   | `/api/issues`     | Create issue (enforces 1-level hierarchy)          |
| `GET`    | `/api/issues/:id` | Get issue with parent, children, relations, labels |
| `PATCH`  | `/api/issues/:id` | Update issue fields                                |
| `DELETE` | `/api/issues/:id` | Soft delete issue                                  |

**Filters (query params):**

- `status` — filter by status (comma-separated for multiple)
- `type` — filter by type (comma-separated)
- `projectId` — filter by project
- `labelId` — filter by label (via join)
- `priority` — filter by priority
- `parentId` — filter by parent (get children)
- `limit` — pagination limit (default 50, max 200)
- `offset` — pagination offset (default 0)

**Hierarchy constraint enforcement:**

On `POST /api/issues` with a `parentId`:

1. Look up the parent issue
2. If the parent has a `parentId` itself (i.e., it's a child), reject with 422: `"Cannot create a child of an issue that already has a parent (1-level hierarchy limit)"`
3. Otherwise, allow the creation

**Create issue Zod schema:**

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
  hypothesis: z
    .object({
      statement: z.string(),
      confidence: z.number().min(0).max(1),
      evidence: z.array(z.string()),
      validationCriteria: z.string(),
      prediction: z.string().optional(),
    })
    .optional(),
  labelIds: z.array(z.string()).optional(),
});
```

**GET `/api/issues/:id` response shape:**

```json
{
  "data": {
    "id": "cuid2...",
    "number": 42,
    "title": "...",
    "type": "task",
    "status": "todo",
    "priority": 2,
    "parent": { "id": "...", "number": 31, "title": "...", "type": "signal" },
    "children": [{ "id": "...", "number": 43, "title": "...", "status": "todo" }],
    "project": { "id": "...", "name": "Improve onboarding" },
    "labels": [{ "id": "...", "name": "bug", "color": "#ff0000" }],
    "relations": [
      {
        "id": "...",
        "type": "blocks",
        "relatedIssue": { "id": "...", "number": 46, "title": "..." }
      }
    ],
    "signalSource": null,
    "signalPayload": null,
    "hypothesis": null,
    "agentSessionId": null,
    "agentSummary": null,
    "commits": null,
    "pullRequests": null,
    "completedAt": null,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

#### 6.3 Projects (`/api/projects`)

| Method   | Path                | Description                            |
| -------- | ------------------- | -------------------------------------- |
| `GET`    | `/api/projects`     | List projects                          |
| `POST`   | `/api/projects`     | Create project                         |
| `GET`    | `/api/projects/:id` | Get project with goal and issue counts |
| `PATCH`  | `/api/projects/:id` | Update project                         |
| `DELETE` | `/api/projects/:id` | Soft delete project                    |

#### 6.4 Goals (`/api/goals`)

| Method   | Path             | Description                        |
| -------- | ---------------- | ---------------------------------- |
| `GET`    | `/api/goals`     | List goals                         |
| `POST`   | `/api/goals`     | Create goal                        |
| `PATCH`  | `/api/goals/:id` | Update goal (currentValue, status) |
| `DELETE` | `/api/goals/:id` | Soft delete goal                   |

#### 6.5 Labels (`/api/labels`)

| Method   | Path              | Description       |
| -------- | ----------------- | ----------------- |
| `GET`    | `/api/labels`     | List labels       |
| `POST`   | `/api/labels`     | Create label      |
| `DELETE` | `/api/labels/:id` | Soft delete label |

#### 6.6 Relations (`/api/issues/:id/relations`)

| Method   | Path                        | Description                                                    |
| -------- | --------------------------- | -------------------------------------------------------------- |
| `POST`   | `/api/issues/:id/relations` | Create relation                                                |
| `DELETE` | `/api/relations/:id`        | Delete relation (hard delete — relations are not soft deleted) |

**Create relation schema:**

```typescript
const createRelationSchema = z.object({
  type: z.enum(relationTypeValues),
  relatedIssueId: z.string(),
});
```

#### 6.7 Comments (`/api/issues/:id/comments`)

| Method | Path                       | Description              |
| ------ | -------------------------- | ------------------------ |
| `GET`  | `/api/issues/:id/comments` | List comments (threaded) |
| `POST` | `/api/issues/:id/comments` | Add comment              |

**Create comment schema:**

```typescript
const createCommentSchema = z.object({
  body: z.string().min(1),
  authorName: z.string().min(1),
  authorType: z.enum(authorTypeValues),
  parentId: z.string().optional(),
});
```

#### 6.8 Signals (`/api/signals`)

Signal endpoints use webhook-specific auth instead of Bearer token auth:

| Method | Path                   | Auth                  | Description              |
| ------ | ---------------------- | --------------------- | ------------------------ |
| `POST` | `/api/signals`         | Bearer token          | Generic signal ingestion |
| `POST` | `/api/signals/posthog` | PostHog shared secret | PostHog webhook          |
| `POST` | `/api/signals/github`  | GitHub HMAC           | GitHub webhook           |
| `POST` | `/api/signals/sentry`  | Sentry HMAC           | Sentry webhook           |

**Generic signal create schema:**

```typescript
const createSignalSchema = z.object({
  source: z.string().min(1),
  sourceId: z.string().optional(),
  type: z.string().min(1),
  severity: z.enum(signalSeverityValues),
  payload: z.record(z.unknown()),
  projectId: z.string().optional(),
});
```

**Signal ingestion flow (atomic transaction):**

1. Validate incoming payload
2. Begin transaction (using Neon Pool driver)
3. Derive issue title from signal data (e.g., `"PostHog: sign-up conversion -12% (24h)"`)
4. Derive priority from severity: `critical → 1, high → 2, medium → 3, low → 4`
5. Create Issue with `type: 'signal'`, `status: 'triage'`, derived priority, signal data
6. Create Signal record with `issueId` pointing to the new issue
7. Commit transaction
8. Return both Signal and Issue in response

**Webhook handlers** normalize provider-specific payloads into the generic signal format:

- **PostHog**: Extract metric name, values, change percentage from action payload
- **GitHub**: Extract event type (push, PR, issue), repository, actor from webhook payload
- **Sentry**: Extract error group, count, first/last seen from issue alert payload

#### 6.9 Templates (`/api/templates`)

| Method   | Path                               | Description                             |
| -------- | ---------------------------------- | --------------------------------------- |
| `GET`    | `/api/templates`                   | List templates with active version info |
| `POST`   | `/api/templates`                   | Create template                         |
| `PATCH`  | `/api/templates/:id`               | Update template metadata                |
| `DELETE` | `/api/templates/:id`               | Soft delete template                    |
| `GET`    | `/api/templates/:id/versions`      | List versions for a template            |
| `POST`   | `/api/templates/:id/versions`      | Create new version                      |
| `PATCH`  | `/api/templates/:id/versions/:vid` | Update version (promote/retire)         |
| `POST`   | `/api/prompt-reviews`              | Submit a prompt review                  |
| `GET`    | `/api/templates/:id/reviews`       | List reviews for a template             |

### 7. Environment Variables

```
DATABASE_URL=postgresql://user:pass@host/dbname    # Neon connection string
LOOP_API_KEY=tok_...                                # Bearer token for API auth
GITHUB_WEBHOOK_SECRET=whsec_...                     # GitHub webhook HMAC secret
SENTRY_CLIENT_SECRET=...                            # Sentry webhook HMAC secret
POSTHOG_WEBHOOK_SECRET=...                          # PostHog shared secret
```

---

## User Experience

This phase is API-only — no UI. The primary users are:

1. **AI agents** (DorkOS, Claude Code, etc.) that call the API to create/update issues, submit signals, and manage work
2. **Developers** testing the API via `curl`, Postman, or the CLI (Phase 4)
3. **Webhook providers** (PostHog, GitHub, Sentry) sending signals

All interactions happen via JSON REST API with Bearer token auth.

---

## Testing Strategy

### Test Infrastructure

- **PGLite** (`@electric-sql/pglite`) provides in-memory WASM Postgres per test file
- No Docker, no network, no external database required
- Full SQL fidelity (real Postgres constraints, indexes, enums)

### Test Setup (`__tests__/setup.ts`)

1. Create PGLite instance (in-memory)
2. Create Drizzle client from PGLite
3. Apply schema using `drizzle-kit push` equivalent (or run migrations)
4. Export test database and test app
5. `beforeEach`: Wipe and recreate schema (`DROP SCHEMA public CASCADE; CREATE SCHEMA public`)
6. `afterAll`: Close PGLite client

### Test Pattern

Use Hono's `app.request()` for endpoint testing — no HTTP server needed:

```typescript
it('POST /api/issues creates an issue', async () => {
  // Purpose: Verify that creating an issue with valid data returns 201 and the correct fields
  const res = await app.request('/api/issues', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TEST_KEY}` },
    body: JSON.stringify({ title: 'Test issue', type: 'task' }),
  });
  expect(res.status).toBe(201);
  const body = await res.json();
  expect(body.data).toMatchObject({ title: 'Test issue', type: 'task' });
  expect(body.data.number).toBeGreaterThan(0);
});
```

### Test Coverage

| Test File           | Covers                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------- |
| `issues.test.ts`    | CRUD, filtering, hierarchy constraint enforcement, soft delete, pagination, label association |
| `projects.test.ts`  | CRUD, soft delete, goal linking                                                               |
| `goals.test.ts`     | CRUD, currentValue update, soft delete                                                        |
| `labels.test.ts`    | CRUD, uniqueness constraint                                                                   |
| `comments.test.ts`  | Create, list, threading (parentId)                                                            |
| `relations.test.ts` | Create, delete, duplicate prevention                                                          |
| `signals.test.ts`   | Generic signal ingestion (atomic Signal + Issue creation), webhook payload normalization      |
| `templates.test.ts` | Template CRUD, version creation/promotion, review submission                                  |

### Key Test Scenarios

- **Hierarchy constraint**: Attempt to create a grandchild issue → expect 422
- **Auth**: Request without Bearer token → expect 401
- **Validation**: Invalid request body → expect 422 with details
- **Soft delete**: Delete issue, then GET → expect 404; list → expect not in results
- **Pagination**: Create 60 issues, request with limit=50 → expect 50 results + total=60
- **Signal atomicity**: Signal ingestion creates both Signal and Issue in one transaction
- **Webhook verification**: Invalid signature → expect 401

---

## Performance Considerations

- **Module-scope client**: Neon HTTP client initialized at module scope for warm Vercel instance reuse
- **Indexes**: B-tree on all foreign keys, composite indexes for common filter patterns, GIN on JSONB payload
- **Pagination**: Enforced on all list endpoints (default 50, max 200) to prevent unbounded queries
- **Column selection**: List endpoints select only necessary columns (not full JSONB payloads)
- **Prepared statements**: Consider for high-frequency queries (issue list, project list)

---

## Security Considerations

- **API key**: Compared using `crypto.timingSafeEqual` to prevent timing attacks
- **Webhook signatures**: Per-provider HMAC verification; never use `===` for signature comparison
- **SQL injection**: Drizzle ORM uses parameterized queries exclusively; no raw SQL with user input
- **Input validation**: All request bodies validated with Zod schemas before processing
- **Environment secrets**: Never hardcoded; loaded from environment variables
- **Payload size**: Webhook payloads should be rejected if exceeding 1 MB
- **CORS**: Not needed for Phase 1 (API-to-API communication); will be added in Phase 3 for dashboard

---

## Documentation

- Update `CLAUDE.md` with:
  - Database setup instructions (Neon connection string)
  - New npm scripts (`db:generate`, `db:migrate`, `db:push`, `db:studio`)
  - API endpoint reference summary
  - Environment variables documentation
- Create `apps/api/.env.example` with all required environment variables
- TSDoc on all exported functions per project conventions

---

## Implementation Phases

### Phase A: Database Foundation

1. Install dependencies (`drizzle-orm`, `@neondatabase/serverless`, `@paralleldrive/cuid2`, `zod`, `@hono/zod-validator`, `ws`, `dotenv`, `drizzle-kit`, `@electric-sql/pglite`)
2. Create `drizzle.config.ts`
3. Create schema files (`_helpers.ts`, `issues.ts`, `projects.ts`, `signals.ts`, `prompts.ts`, `index.ts`)
4. Create `db/index.ts` (Neon HTTP client) and `db/pool.ts` (Neon Pool client)
5. Create `db/migrate.ts`
6. Generate initial migration with `drizzle-kit generate`
7. Set up PGLite test infrastructure (`__tests__/setup.ts`)

### Phase B: App Restructure + Auth

1. Extract app from `index.ts` into `app.ts` (for testability)
2. Update `index.ts` to import from `app.ts`
3. Create `middleware/auth.ts` (Bearer token auth)
4. Create `middleware/webhooks.ts` (per-provider signature verification)
5. Set up global error handler in `app.ts`
6. Create `.env.example`

### Phase C: Core CRUD Endpoints

1. Implement `/api/issues` routes (CRUD + filtering + hierarchy constraint)
2. Implement `/api/projects` routes
3. Implement `/api/goals` routes
4. Implement `/api/labels` routes
5. Implement `/api/issues/:id/relations` routes
6. Implement `/api/issues/:id/comments` routes
7. Write tests for each route file

### Phase D: Signal Ingestion

1. Implement `POST /api/signals` (generic, with transaction)
2. Implement PostHog webhook handler
3. Implement GitHub webhook handler
4. Implement Sentry webhook handler
5. Write tests for signal ingestion and webhook handlers

### Phase E: Template CRUD + Polish

1. Implement template CRUD routes
2. Implement version CRUD routes
3. Implement prompt review submission
4. Write tests for template routes
5. Update `CLAUDE.md` with database docs
6. Run full test suite, fix any issues
7. Generate final migration

---

## Open Questions

_None — all clarifications resolved during ideation._

---

## Related ADRs

- **ADR-001**: Use Hono over Express (`decisions/0001-use-hono-over-express.md`) — Confirms Hono as the API framework
- **ADR-002**: Deploy as two Vercel projects (`decisions/0002-deploy-two-vercel-projects.md`) — API deploys as Vercel Functions

New ADRs to extract from this spec:

- Use Neon PostgreSQL as the database provider
- Use Drizzle ORM for database access
- Use CUID2 text primary keys
- Use soft delete with `deletedAt` column
- Use PGLite for test database

---

## References

- [Loop MVP Spec](../../meta/loop-mvp.md) — Complete MVP specification
- [Loop Litepaper](../../meta/loop-litepaper.md) — Vision and architecture
- [Ideation Document](./01-ideation.md) — Research findings and decisions
- [Research Document](../../research/20260219_data-layer-core-api.md) — Deep technical research
- [Build Plan](../mvp-build-plan.md) — 4-phase MVP build plan
- [Drizzle ORM Docs](https://orm.drizzle.team/docs/overview)
- [Neon Serverless Driver](https://neon.com/docs/serverless/serverless-driver)
- [Hono Docs](https://hono.dev/docs/)
- [PGLite](https://pglite.dev/)
