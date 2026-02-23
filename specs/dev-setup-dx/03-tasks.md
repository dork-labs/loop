---
slug: dev-setup-dx
number: 8
created: 2026-02-21
status: tasks
last_decompose: 2026-02-21
---

# Tasks: Developer Setup & DX Improvements

## Phase 1: Infrastructure

### Task 1.1: Create Docker Compose configuration for local PostgreSQL

Create `docker-compose.dev.yml` at repository root and add npm scripts for managing the local database.

**Files to create/modify:**

- Create `docker-compose.dev.yml` (new file)
- Modify root `package.json` (add scripts)

**Docker Compose file (`docker-compose.dev.yml`):**

```yaml
# docker-compose.dev.yml — Local development services
# Usage: npm run dx (start) | npm run dx:down (stop) | npm run dx:reset (nuke)
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: loop
      POSTGRES_PASSWORD: loop
      POSTGRES_DB: loop
    ports:
      - '54320:5432'
    volumes:
      - loop_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U loop -d loop']
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  loop_postgres_data:
```

**Root `package.json` script additions:**

```json
"dx": "docker compose -f docker-compose.dev.yml up -d",
"dx:down": "docker compose -f docker-compose.dev.yml down",
"dx:reset": "docker compose -f docker-compose.dev.yml down -v",
"setup": "bash scripts/setup.sh"
```

**Acceptance Criteria:**

- [ ] `docker-compose.dev.yml` exists at repository root
- [ ] Port 54320 maps to container port 5432
- [ ] Credentials are `loop:loop` with database `loop`
- [ ] Named volume `loop_postgres_data` persists data
- [ ] Healthcheck configured with `pg_isready`
- [ ] `npm run dx` starts the container in detached mode
- [ ] `npm run dx:down` stops and removes the container
- [ ] `npm run dx:reset` stops and removes both container and volume
- [ ] `npm run setup` invokes `scripts/setup.sh`

### Task 1.2: Add pg driver as devDependency to API

Install the standard PostgreSQL client for local development.

**Commands:**

```bash
cd apps/api
npm install --save-dev pg @types/pg
```

**Acceptance Criteria:**

- [ ] `pg` appears in `apps/api/package.json` devDependencies as `^8.x`
- [ ] `@types/pg` appears in `apps/api/package.json` devDependencies as `^8.x`
- [ ] `npm install` succeeds with no errors
- [ ] Package is devDependency only (not shipped to production)

## Phase 2: Environment Validation

### Task 2.1: Create API env validation (`apps/api/src/env.ts`)

Create Zod-based environment validation for the API app. Export both the schema (for testing) and the validated `env` object.

**File to create:** `apps/api/src/env.ts`

```typescript
import { z } from 'zod';

export const apiEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  LOOP_API_KEY: z.string().min(1),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4242),
  LOOP_URL: z.string().url().default('http://localhost:4242'),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),
  SENTRY_CLIENT_SECRET: z.string().optional(),
  POSTHOG_WEBHOOK_SECRET: z.string().optional(),
});

const result = apiEnvSchema.safeParse(process.env);

if (!result.success) {
  console.error('\n  Missing or invalid environment variables:\n');
  result.error.issues.forEach((i) => console.error(`  - ${i.path.join('.')}: ${i.message}`));
  console.error('\n  Copy apps/api/.env.example to apps/api/.env\n');
  process.exit(1);
}

export const env = result.data;
export type Env = z.infer<typeof apiEnvSchema>;
```

**Key decisions:**

- Export `apiEnvSchema` so tests can call `safeParse` directly without triggering `process.exit`
- `DATABASE_URL` validates as URL format
- `PORT` coerces from string (env vars are always strings) to number
- Webhook secrets are optional (app starts without them, middleware checks at request time)
- `LOOP_URL` defaults to `http://localhost:4242` for local dev

**Acceptance Criteria:**

- [ ] File exists at `apps/api/src/env.ts`
- [ ] Exports `apiEnvSchema` for direct testing
- [ ] Exports typed `env` object and `Env` type
- [ ] Missing required vars produces formatted error and exits with code 1
- [ ] Defaults applied for `NODE_ENV`, `PORT`, `LOOP_URL`
- [ ] Webhook secrets are optional
- [ ] `PORT` coerces string to number

### Task 2.2: Create App env validation (`apps/app/src/env.ts`)

Create Zod v3 environment validation for the frontend app.

**File to create:** `apps/app/src/env.ts`

```typescript
import { z } from 'zod';

export const appEnvSchema = z.object({
  VITE_API_URL: z.string().url().default('http://localhost:4242'),
  VITE_LOOP_API_KEY: z.string().min(1),
});

const result = appEnvSchema.safeParse(import.meta.env);

if (!result.success) {
  console.error('\n  Missing or invalid environment variables:\n');
  result.error.issues.forEach((i: z.ZodIssue) =>
    console.error(`  - ${i.path.join('.')}: ${i.message}`)
  );
  console.error('\n  Copy apps/app/.env.example to apps/app/.env\n');
  throw new Error('Invalid environment variables');
}

export const env = result.data;
export type Env = z.infer<typeof appEnvSchema>;
```

**Key decisions:**

- Uses `import.meta.env` (Vite convention) instead of `process.env`
- Uses `throw` instead of `process.exit` since this runs in the browser build pipeline
- Zod v3 syntax (the app uses Zod v3)
- `VITE_API_URL` defaults to localhost for local dev

**Acceptance Criteria:**

- [ ] File exists at `apps/app/src/env.ts`
- [ ] Uses `import.meta.env` (not `process.env`)
- [ ] Exports `appEnvSchema` for testing
- [ ] Uses `throw` instead of `process.exit`
- [ ] `VITE_API_URL` defaults to `http://localhost:4242`
- [ ] `VITE_LOOP_API_KEY` is required with min length 1

### Task 2.3: Create Web env validation (`apps/web/src/env.ts`)

Create Zod v4 environment validation for the marketing/docs site.

**File to create:** `apps/web/src/env.ts`

```typescript
import { z } from 'zod';

export const webEnvSchema = z.object({
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

const result = webEnvSchema.safeParse(process.env);

if (!result.success) {
  console.error('\n  Missing or invalid environment variables:\n');
  result.error.issues.forEach((i) => console.error(`  - ${i.path.join('.')}: ${i.message}`));
  console.error('\n  Copy apps/web/.env.example to apps/web/.env\n');
  process.exit(1);
}

export const env = result.data;
export type Env = z.infer<typeof webEnvSchema>;
```

**Key decisions:**

- All PostHog vars are optional (web app works without analytics)
- `NODE_ENV` has a default of `development`
- Uses `process.env` (Next.js convention)

**Acceptance Criteria:**

- [ ] File exists at `apps/web/src/env.ts`
- [ ] All PostHog variables are optional
- [ ] Exports `webEnvSchema` for testing
- [ ] Uses `process.env` (Next.js convention)

## Phase 3: Driver Swap & Wiring

### Task 3.1: Rewrite database connection with conditional driver swap

Rewrite `apps/api/src/db/index.ts` to use the Neon HTTP driver in production and the standard `pg` driver in local development.

**Current file (`apps/api/src/db/index.ts`):**

```typescript
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
export type Database = typeof db;
```

**New file (`apps/api/src/db/index.ts`):**

```typescript
import * as schema from './schema';
import { env } from '../env';

type NeonHttpDatabase = import('drizzle-orm/neon-http').NeonHttpDatabase<typeof schema>;
type NodePgDatabase = import('drizzle-orm/node-postgres').NodePgDatabase<typeof schema>;

export type Database = NeonHttpDatabase | NodePgDatabase;

let db: Database;

if (env.NODE_ENV === 'production') {
  const { neon } = await import('@neondatabase/serverless');
  const { drizzle } = await import('drizzle-orm/neon-http');
  db = drizzle(neon(env.DATABASE_URL), { schema });
} else {
  const { Pool } = await import('pg');
  const { drizzle } = await import('drizzle-orm/node-postgres');
  db = drizzle(new Pool({ connectionString: env.DATABASE_URL }), { schema });
}

export { db };
```

**Key decisions:**

- Top-level `await` with dynamic `import()` — valid because `apps/api` uses `"type": "module"`
- `NODE_ENV === 'production'` gate: only production uses Neon. Development and any other value uses `pg`
- `Database` type is a union; both Drizzle adapters expose the same query API
- `pg` is a devDependency only — not shipped to production
- Tests use PGlite via `withTestDb()` and never touch `db/index.ts` — unaffected

**Acceptance Criteria:**

- [ ] Production uses `@neondatabase/serverless` + `drizzle-orm/neon-http`
- [ ] Non-production uses `pg` + `drizzle-orm/node-postgres`
- [ ] `Database` type is a union of both adapter types
- [ ] Uses `env.DATABASE_URL` and `env.NODE_ENV` from env.ts
- [ ] Top-level await with dynamic imports
- [ ] TypeScript compiles without errors
- [ ] Existing tests still pass (they use PGlite, not this module)

### Task 3.2: Rewrite migration runner with conditional driver swap

Apply the same conditional driver pattern to `apps/api/src/db/migrate.ts`.

**Current file (`apps/api/src/db/migrate.ts`):**

```typescript
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

await migrate(db, { migrationsFolder: './drizzle/migrations' });
console.log('Migrations complete');
process.exit(0);
```

**New file (`apps/api/src/db/migrate.ts`):**

```typescript
import 'dotenv/config';
import { env } from '../env';

if (env.NODE_ENV === 'production') {
  const { neon } = await import('@neondatabase/serverless');
  const { drizzle } = await import('drizzle-orm/neon-http');
  const { migrate } = await import('drizzle-orm/neon-http/migrator');
  const db = drizzle(neon(env.DATABASE_URL));
  await migrate(db, { migrationsFolder: './drizzle/migrations' });
} else {
  const { Pool } = await import('pg');
  const { drizzle } = await import('drizzle-orm/node-postgres');
  const { migrate } = await import('drizzle-orm/node-postgres/migrator');
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: './drizzle/migrations' });
  await pool.end();
}

console.log('Migrations complete');
process.exit(0);
```

**Key decisions:**

- Retains `import 'dotenv/config'` so env vars are loaded before validation
- Pool is properly closed in the local path (`await pool.end()`)
- Uses `env.DATABASE_URL` and `env.NODE_ENV` from validated env

**Acceptance Criteria:**

- [ ] Production path uses Neon HTTP driver and migrator
- [ ] Local path uses pg Pool and node-postgres migrator
- [ ] Pool is closed after migration in local path
- [ ] Uses `env.DATABASE_URL` from env.ts
- [ ] `dotenv/config` is still imported first
- [ ] `npm run db:migrate -w apps/api` works against Docker postgres

### Task 3.3: Wire env.ts into API server entry point

Replace raw `process.env` access in `apps/api/src/index.ts` with typed `env` imports.

**Current file (`apps/api/src/index.ts`):**

```typescript
import { serve } from '@hono/node-server';
import { app } from './app';

// Local dev server (Vercel uses the default export)
if (process.env.NODE_ENV !== 'production') {
  const port = parseInt(process.env.PORT || '4242', 10);
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`Loop API running at http://localhost:${info.port}`);
  });
}

export default app;
```

**New file (`apps/api/src/index.ts`):**

```typescript
import { serve } from '@hono/node-server';
import { app } from './app';
import { env } from './env';

// Local dev server (Vercel uses the default export)
if (env.NODE_ENV !== 'production') {
  serve({ fetch: app.fetch, port: env.PORT }, (info) => {
    console.log(`Loop API running at http://localhost:${info.port}`);
  });
}

export default app;
```

**Changes:**

- Import `env` from `./env`
- Replace `process.env.NODE_ENV` with `env.NODE_ENV`
- Replace `parseInt(process.env.PORT || '4242', 10)` with `env.PORT` (already coerced to number by Zod)

**Acceptance Criteria:**

- [ ] No raw `process.env` access remains in this file
- [ ] `env.PORT` used directly (no parseInt needed — Zod coerces)
- [ ] `env.NODE_ENV` used for production check
- [ ] Server still starts correctly on configured port

### Task 3.4: Wire env.ts into API auth middleware

Replace raw `process.env.LOOP_API_KEY` in `apps/api/src/middleware/auth.ts`.

**Current code (line 16):**

```typescript
const expected = process.env.LOOP_API_KEY;
```

**New code:**

```typescript
import { env } from '../env';
// ... (at line 16)
const expected = env.LOOP_API_KEY;
```

Also remove the null check on line 18-20 since `env.LOOP_API_KEY` is guaranteed to be a non-empty string by Zod validation:

**Remove this block:**

```typescript
if (!expected) {
  throw new HTTPException(500, { message: 'LOOP_API_KEY not configured' });
}
```

**Full new file (`apps/api/src/middleware/auth.ts`):**

```typescript
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { timingSafeEqual } from 'node:crypto';
import type { AppEnv } from '../types';
import { env } from '../env';

/** Bearer token auth middleware that validates requests against LOOP_API_KEY. */
export const apiKeyAuth = createMiddleware<AppEnv>(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new HTTPException(401, {
      message: 'Missing or malformed Authorization header',
    });
  }

  const token = authHeader.slice(7);
  const expected = env.LOOP_API_KEY;

  const tokenBuf = Buffer.from(token);
  const expectedBuf = Buffer.from(expected);

  if (tokenBuf.length !== expectedBuf.length || !timingSafeEqual(tokenBuf, expectedBuf)) {
    throw new HTTPException(401, { message: 'Invalid API key' });
  }

  await next();
});
```

**Acceptance Criteria:**

- [ ] Import `env` from `../env`
- [ ] `env.LOOP_API_KEY` replaces `process.env.LOOP_API_KEY`
- [ ] Null check removed (Zod guarantees non-empty string)
- [ ] No raw `process.env` access remains
- [ ] Auth still works correctly

### Task 3.5: Wire env.ts into webhook middleware

Replace raw `process.env` access in `apps/api/src/middleware/webhooks.ts` for all three webhook secrets.

**Changes required (3 replacements):**

1. Line 39: `const secret = process.env.GITHUB_WEBHOOK_SECRET` becomes `const secret = env.GITHUB_WEBHOOK_SECRET`
2. Line 67: `const secret = process.env.SENTRY_CLIENT_SECRET` becomes `const secret = env.SENTRY_CLIENT_SECRET`
3. Line 97: `const secret = process.env.POSTHOG_WEBHOOK_SECRET` becomes `const secret = env.POSTHOG_WEBHOOK_SECRET`

Add import at top of file:

```typescript
import { env } from '../env';
```

**Important:** Keep the null checks (`if (!secret)`) because these env vars are marked as `z.string().optional()` in the schema. The app starts without them, but the middleware must still throw 500 if the secret is missing when the webhook route is actually hit.

**Acceptance Criteria:**

- [ ] Import `env` from `../env`
- [ ] All three `process.env.*` accesses replaced with `env.*`
- [ ] Null checks retained (secrets are optional in schema)
- [ ] No raw `process.env` access remains
- [ ] All three webhook verifications still work

### Task 3.6: Wire env.ts into prompt engine

Replace raw `process.env` access in `apps/api/src/lib/prompt-engine.ts`.

**Current code (lines 276-277 in `buildHydrationContext`):**

```typescript
loopUrl: process.env.LOOP_URL ?? 'http://localhost:4242',
loopToken: process.env.LOOP_API_KEY ?? '',
```

**New code:**

```typescript
loopUrl: env.LOOP_URL,
loopToken: env.LOOP_API_KEY,
```

Add import at top of file:

```typescript
import { env } from '../env';
```

**Key change:** The `?? 'http://localhost:4242'` fallback is no longer needed because `LOOP_URL` has a default in the Zod schema. Similarly, `LOOP_API_KEY` is guaranteed non-empty.

**Acceptance Criteria:**

- [ ] Import `env` from `../env`
- [ ] `env.LOOP_URL` replaces `process.env.LOOP_URL ?? 'http://localhost:4242'`
- [ ] `env.LOOP_API_KEY` replaces `process.env.LOOP_API_KEY ?? ''`
- [ ] No fallback operators needed (Zod provides defaults/guarantees)
- [ ] No raw `process.env` access remains

### Task 3.7: Wire env.ts into frontend API client

Replace raw `import.meta.env` access in `apps/app/src/lib/api-client.ts`.

**Current code (lines 8-10):**

```typescript
export const api = ky.create({
  prefixUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:4242',
  headers: {
    Authorization: `Bearer ${import.meta.env.VITE_LOOP_API_KEY}`,
  },
```

**New code:**

```typescript
import { env } from '@/env'

export const api = ky.create({
  prefixUrl: env.VITE_API_URL,
  headers: {
    Authorization: `Bearer ${env.VITE_LOOP_API_KEY}`,
  },
```

**Changes:**

- Import `env` from `@/env` (uses the path alias)
- Replace `import.meta.env.VITE_API_URL ?? 'http://localhost:4242'` with `env.VITE_API_URL`
- Replace `import.meta.env.VITE_LOOP_API_KEY` with `env.VITE_LOOP_API_KEY`
- No fallback needed — Zod default handles `VITE_API_URL`

**Acceptance Criteria:**

- [ ] Import `env` from `@/env`
- [ ] `env.VITE_API_URL` replaces `import.meta.env.VITE_API_URL`
- [ ] `env.VITE_LOOP_API_KEY` replaces `import.meta.env.VITE_LOOP_API_KEY`
- [ ] No raw `import.meta.env` access remains
- [ ] API client still connects correctly

### Task 3.8: Wire env.ts into web PostHog files

Replace raw `process.env` access in `apps/web/src/lib/posthog-server.ts` and `apps/web/instrumentation-client.ts` with typed env imports with optional guards.

**File 1: `apps/web/src/lib/posthog-server.ts`**

Current:

```typescript
import { PostHog } from 'posthog-node';

let posthogClient: PostHog | null = null;

export function getPostHogClient() {
  if (!posthogClient) {
    posthogClient = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return posthogClient;
}
```

New:

```typescript
import { PostHog } from 'posthog-node';
import { env } from '../env';

let posthogClient: PostHog | null = null;

export function getPostHogClient() {
  if (!env.NEXT_PUBLIC_POSTHOG_KEY) return null;

  if (!posthogClient) {
    posthogClient = new PostHog(env.NEXT_PUBLIC_POSTHOG_KEY, {
      host: env.NEXT_PUBLIC_POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return posthogClient;
}

export async function shutdownPostHog() {
  if (posthogClient) {
    await posthogClient.shutdown();
  }
}
```

**File 2: `apps/web/instrumentation-client.ts`**

Current:

```typescript
import posthog from 'posthog-js';

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
  api_host: '/ingest',
  ui_host: 'https://us.posthog.com',
  defaults: '2025-11-30',
  capture_exceptions: true,
  debug: process.env.NODE_ENV === 'development',
});
```

New:

```typescript
import posthog from 'posthog-js';
import { env } from './src/env';

if (env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: '/ingest',
    ui_host: 'https://us.posthog.com',
    defaults: '2025-11-30',
    capture_exceptions: true,
    debug: env.NODE_ENV === 'development',
  });
}
```

**Key changes:**

- Both files add optional guards since `NEXT_PUBLIC_POSTHOG_KEY` is optional in the schema
- Removes non-null assertions (`!`) — replaced by optional guard
- `getPostHogClient()` returns `null` when no key is configured (callers must handle this)

**Acceptance Criteria:**

- [ ] Both files import `env` from the web env module
- [ ] Optional guard wraps PostHog initialization (no crash without key)
- [ ] Non-null assertions removed
- [ ] `getPostHogClient()` return type updated to `PostHog | null`
- [ ] No raw `process.env` access remains in either file
- [ ] Web app starts correctly without PostHog keys

## Phase 4: Defaults & Setup

### Task 4.1: Update .env.example files with working local defaults

Update both `.env.example` files so `cp .env.example .env` requires zero editing.

**File 1: `apps/api/.env.example`**

Replace entire contents with:

```env
# Loop API Server
# Copy to .env: cp .env.example .env
# No editing needed for local development!

# Database — works with `npm run dx` (Docker postgres)
DATABASE_URL=postgresql://loop:loop@localhost:54320/loop

# API authentication — shared dev key (change in production!)
LOOP_API_KEY=loop-dev-api-key-insecure

# Webhook secrets (optional — only needed for integrations)
# GITHUB_WEBHOOK_SECRET=your-github-webhook-secret
# SENTRY_CLIENT_SECRET=your-sentry-client-secret
# POSTHOG_WEBHOOK_SECRET=your-posthog-webhook-secret
```

**File 2: `apps/app/.env.example`**

Replace entire contents with:

```env
# Loop Dashboard
# Copy to .env: cp .env.example .env
# No editing needed for local development!

# API base URL (defaults to http://localhost:4242 if not set)
VITE_API_URL=http://localhost:4242

# API key — must match LOOP_API_KEY in apps/api/.env
VITE_LOOP_API_KEY=loop-dev-api-key-insecure
```

**Key changes:**

- `DATABASE_URL` now points to Docker postgres (`localhost:54320`)
- `LOOP_API_KEY` and `VITE_LOOP_API_KEY` use matching dev key `loop-dev-api-key-insecure`
- Comments clearly state no editing needed

**Acceptance Criteria:**

- [ ] `apps/api/.env.example` has `DATABASE_URL=postgresql://loop:loop@localhost:54320/loop`
- [ ] `apps/api/.env.example` has `LOOP_API_KEY=loop-dev-api-key-insecure`
- [ ] `apps/app/.env.example` has `VITE_LOOP_API_KEY=loop-dev-api-key-insecure`
- [ ] API key values match between api and app
- [ ] Comments say "No editing needed for local development!"
- [ ] `cp .env.example .env` produces a working config

### Task 4.2: Create setup script (`scripts/setup.sh`)

Create an idempotent first-run setup script for new contributors.

**File to create:** `scripts/setup.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

# Loop Development Setup
# Idempotent — safe to re-run at any time

echo "Setting up Loop development environment..."

# 1. Check Node.js
if ! command -v node &> /dev/null; then
  echo "Error: Node.js is required. Install from https://nodejs.org"
  exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "Error: Node.js 20+ required (found $(node -v))"
  exit 1
fi

# 2. Check Docker
if ! command -v docker &> /dev/null; then
  echo "Error: Docker is required. Install from https://docker.com"
  exit 1
fi

if ! docker info &> /dev/null; then
  echo "Error: Docker daemon is not running. Start Docker Desktop."
  exit 1
fi

# 3. Install dependencies
echo "Installing dependencies..."
npm install

# 4. Copy .env files (won't overwrite existing)
echo "Setting up environment files..."
cp -n apps/api/.env.example apps/api/.env 2>/dev/null || true
cp -n apps/app/.env.example apps/app/.env 2>/dev/null || true
cp -n apps/web/.env.example apps/web/.env 2>/dev/null || true

# 5. Start Docker services
echo "Starting PostgreSQL..."
npm run dx

# 6. Wait for postgres to be healthy
echo "Waiting for PostgreSQL to be ready..."
RETRIES=30
until docker compose -f docker-compose.dev.yml exec -T postgres pg_isready -U loop -d loop &> /dev/null; do
  RETRIES=$((RETRIES - 1))
  if [ "$RETRIES" -le 0 ]; then
    echo "Error: PostgreSQL did not become ready in time"
    exit 1
  fi
  sleep 1
done

# 7. Run migrations
echo "Running database migrations..."
npm run db:migrate -w apps/api

echo ""
echo "Setup complete! Run 'npm run dev' to start all apps."
echo ""
echo "  API:       http://localhost:4242"
echo "  Dashboard: http://localhost:3000"
echo "  Website:   http://localhost:3001"
```

**Post-creation step:** Make the script executable:

```bash
chmod +x scripts/setup.sh
```

**Acceptance Criteria:**

- [ ] File exists at `scripts/setup.sh`
- [ ] Script is executable (`chmod +x`)
- [ ] Checks for Node.js 20+
- [ ] Checks for Docker and Docker daemon
- [ ] Runs `npm install`
- [ ] Copies `.env.example` to `.env` without overwriting existing
- [ ] Starts Docker postgres via `npm run dx`
- [ ] Waits for postgres to be healthy (up to 30 retries)
- [ ] Runs database migrations
- [ ] Prints success message with URLs
- [ ] Idempotent (safe to re-run)

## Phase 5: Testing & Validation

### Task 5.1: Write env schema validation tests

Create tests for the env schemas. Test the schemas directly (via `safeParse`) rather than importing `env.ts` which has side effects.

**File to create:** `apps/api/src/__tests__/env.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { apiEnvSchema } from '../env';

describe('API env schema', () => {
  it('accepts valid config with all required fields', () => {
    const result = apiEnvSchema.safeParse({
      DATABASE_URL: 'postgresql://loop:loop@localhost:54320/loop',
      LOOP_API_KEY: 'test-key',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing DATABASE_URL', () => {
    const result = apiEnvSchema.safeParse({
      LOOP_API_KEY: 'test-key',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid DATABASE_URL format', () => {
    const result = apiEnvSchema.safeParse({
      DATABASE_URL: 'not-a-url',
      LOOP_API_KEY: 'test-key',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty LOOP_API_KEY', () => {
    const result = apiEnvSchema.safeParse({
      DATABASE_URL: 'postgresql://loop:loop@localhost:54320/loop',
      LOOP_API_KEY: '',
    });
    expect(result.success).toBe(false);
  });

  it('applies defaults for optional fields', () => {
    const result = apiEnvSchema.safeParse({
      DATABASE_URL: 'postgresql://loop:loop@localhost:54320/loop',
      LOOP_API_KEY: 'test-key',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.NODE_ENV).toBe('development');
      expect(result.data.PORT).toBe(4242);
      expect(result.data.LOOP_URL).toBe('http://localhost:4242');
    }
  });

  it('coerces PORT from string to number', () => {
    const result = apiEnvSchema.safeParse({
      DATABASE_URL: 'postgresql://loop:loop@localhost:54320/loop',
      LOOP_API_KEY: 'test-key',
      PORT: '3000',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.PORT).toBe(3000);
    }
  });

  it('rejects PORT outside valid range', () => {
    const result = apiEnvSchema.safeParse({
      DATABASE_URL: 'postgresql://loop:loop@localhost:54320/loop',
      LOOP_API_KEY: 'test-key',
      PORT: '99999',
    });
    expect(result.success).toBe(false);
  });

  it('accepts optional webhook secrets', () => {
    const result = apiEnvSchema.safeParse({
      DATABASE_URL: 'postgresql://loop:loop@localhost:54320/loop',
      LOOP_API_KEY: 'test-key',
      GITHUB_WEBHOOK_SECRET: 'gh-secret',
      SENTRY_CLIENT_SECRET: 'sentry-secret',
      POSTHOG_WEBHOOK_SECRET: 'posthog-secret',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.GITHUB_WEBHOOK_SECRET).toBe('gh-secret');
      expect(result.data.SENTRY_CLIENT_SECRET).toBe('sentry-secret');
      expect(result.data.POSTHOG_WEBHOOK_SECRET).toBe('posthog-secret');
    }
  });

  it('rejects invalid NODE_ENV value', () => {
    const result = apiEnvSchema.safeParse({
      DATABASE_URL: 'postgresql://loop:loop@localhost:54320/loop',
      LOOP_API_KEY: 'test-key',
      NODE_ENV: 'staging',
    });
    expect(result.success).toBe(false);
  });
});
```

**Important note:** These tests import `apiEnvSchema` directly — the exported schema allows calling `safeParse` without triggering the module-level `process.exit` side effect. This is why Task 2.1 exports the schema separately.

**Acceptance Criteria:**

- [ ] File exists at `apps/api/src/__tests__/env.test.ts`
- [ ] Tests valid config acceptance
- [ ] Tests missing required fields rejection
- [ ] Tests invalid format rejection
- [ ] Tests default value application
- [ ] Tests PORT coercion from string
- [ ] Tests PORT range validation
- [ ] Tests optional webhook secrets
- [ ] Tests invalid NODE_ENV rejection
- [ ] All tests pass with `npx vitest run apps/api/src/__tests__/env.test.ts`

### Task 5.2: Verify existing tests and TypeScript compilation

Run full test suite and type-check to ensure no regressions from env and driver changes.

**Commands to run:**

```bash
npm test                 # All tests across api + app
npm run typecheck        # TypeScript compilation check
```

**What to verify:**

- All existing tests in `apps/api/src/__tests__/` still pass (they use PGlite via `withTestDb()`, not the production `db/index.ts`)
- TypeScript compilation succeeds with the new `Database` union type
- No type errors from the `env.*` replacements
- The new env test passes

**Acceptance Criteria:**

- [ ] `npm test` passes with zero failures
- [ ] `npm run typecheck` passes with zero errors
- [ ] No regressions in existing test files

## Phase 6: Documentation

### Task 6.1: Update CLAUDE.md with new commands

Add the new `dx`, `dx:down`, `dx:reset`, and `setup` commands to the Commands section in `CLAUDE.md`.

**Add to the Commands section (after the existing scripts block):**

```bash
npm run dx               # Start local PostgreSQL via Docker Compose
npm run dx:down          # Stop local PostgreSQL
npm run dx:reset         # Stop and delete local PostgreSQL data
npm run setup            # First-run setup (install deps, copy .env, start db, migrate)
```

Also add a "Quick Start" or "First-Time Setup" note near the top:

```bash
# First-time setup (one command does everything):
npm run setup

# Or manual setup:
cp apps/api/.env.example apps/api/.env
cp apps/app/.env.example apps/app/.env
npm run dx               # Start Docker PostgreSQL
npm run db:migrate -w apps/api
npm run dev
```

**Acceptance Criteria:**

- [ ] `dx`, `dx:down`, `dx:reset`, `setup` appear in CLAUDE.md Commands section
- [ ] Description for each new command is clear
- [ ] First-time setup flow is documented

### Task 6.2: Update getting-started and self-hosting docs

Update external documentation files for the new Docker-based setup flow.

**File 1: `docs/getting-started/index.mdx`** (installation)

- Add Docker as a prerequisite
- Document `npm run setup` as the recommended setup path
- Document manual setup as an alternative

**File 2: `docs/getting-started/quickstart.mdx`**

- Update quick-start to include `npm run dx` step
- Show the 4-command setup: clone, setup, dev, open

**File 3: `docs/self-hosting/environment.mdx`**

- Update environment variable reference with new defaults
- Note that `DATABASE_URL` defaults to Docker postgres in `.env.example`
- Note that `LOOP_API_KEY` has a dev default

**File 4: `docs/contributing/index.mdx`**

- Add full developer setup guide with Docker flow
- Document both automated (`npm run setup`) and manual paths
- Include troubleshooting for common Docker issues

**Acceptance Criteria:**

- [ ] Docker listed as prerequisite in installation docs
- [ ] `npm run setup` documented as primary setup path
- [ ] Quick-start updated with Docker database step
- [ ] Environment variable docs updated with new defaults
- [ ] Contributing guide updated with Docker-based dev setup
