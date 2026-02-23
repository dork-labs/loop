---
slug: dev-setup-dx
number: 8
created: 2026-02-21
status: specification
---

# Specification: Developer Setup & DX Improvements

**Status:** Draft
**Authors:** Claude Code, 2026-02-21
**Spec Number:** 8
**Related Ideation:** `specs/dev-setup-dx/01-ideation.md`

---

## 1. Overview

Implement developer setup improvements for the Loop monorepo so that a new contributor can go from `git clone` to a running dev environment with zero manual configuration. This covers six areas: Docker Compose for local PostgreSQL, conditional database driver swap, Zod environment validation per app, pre-filled `.env.example` files, a first-run setup script, and documentation updates.

## 2. Background / Problem Statement

Currently, setting up the Loop development environment requires:

1. Creating a Neon database account and provisioning a database
2. Manually editing `.env.example` files with real credentials
3. Understanding which environment variables each app needs
4. No validation — misspelled or missing env vars produce cryptic runtime errors

The `@neondatabase/serverless` driver used in production speaks Neon's HTTP-over-WebSocket protocol, which cannot connect to a standard PostgreSQL instance. This means contributors cannot simply run a local Docker postgres — the driver itself must be swapped for local development.

The goal is a setup flow where `cp .env.example .env` requires zero editing and `npm run dx` starts all backing services.

## 3. Goals

- Zero-edit local setup: `cp .env.example .env` works immediately for local dev
- One-command database: `npm run dx` starts a local PostgreSQL via Docker Compose
- Fast-fail validation: Missing or invalid env vars produce clear, formatted error messages at startup
- Type-safe env access: All apps import a typed `env` object instead of raw `process.env`
- First-run automation: `npm run setup` handles everything for new contributors
- Transparent driver swap: Same Drizzle ORM API regardless of production (Neon) or local (pg) driver
- Comprehensive documentation updates across all guides

## 4. Non-Goals

- `.devcontainer/devcontainer.json` (deferred — add once base is solid)
- CLI wizard / interactive setup tool
- Full Docker Compose for all services (only PostgreSQL)
- Automated secret generation in setup script
- t3-env / envalid / znv (Zod direct is sufficient)
- Changing test infrastructure (PGlite stays per ADR 0007)
- Multi-user authentication
- Light mode for dashboard

## 5. Technical Dependencies

| Dependency                  | Version                    | Purpose                                                  |
| --------------------------- | -------------------------- | -------------------------------------------------------- |
| `pg`                        | `^8.x`                     | Standard PostgreSQL client for local dev (devDependency) |
| `@types/pg`                 | `^8.x`                     | TypeScript types for pg (devDependency)                  |
| `zod`                       | v4 (api, web), v3 (app)    | Already installed — env validation                       |
| `drizzle-orm/node-postgres` | (bundled with drizzle-orm) | Drizzle adapter for standard pg driver                   |
| Docker / Docker Compose     | v2+                        | Local PostgreSQL container                               |
| PostgreSQL                  | 16-alpine                  | Database image                                           |

## 6. Detailed Design

### 6.1 Docker Compose (`docker-compose.dev.yml`)

Create at repository root:

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

Port `54320` on the host avoids conflicts with other Docker Compose projects or a locally-installed PostgreSQL.

**Root `package.json` scripts:**

```json
"dx": "docker compose -f docker-compose.dev.yml up -d",
"dx:down": "docker compose -f docker-compose.dev.yml down",
"dx:reset": "docker compose -f docker-compose.dev.yml down -v",
"setup": "bash scripts/setup.sh"
```

### 6.2 Conditional Driver Swap (`apps/api/src/db/index.ts`)

The critical change: use `NODE_ENV` to gate between the Neon HTTP driver (production) and the standard `pg` driver (local dev/staging).

**Current code:**

```typescript
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
export type Database = typeof db;
```

**New code:**

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

**Key design decisions:**

- Top-level `await` with dynamic `import()` — valid because `apps/api` uses `"type": "module"`
- `NODE_ENV === 'production'` gate: only production uses Neon. Development and any other value uses `pg`
- Tests use PGlite via `withTestDb()` and never touch `db/index.ts` — unaffected
- The `Database` type is a union; both Drizzle adapters expose the same query API
- `pg` is added as a `devDependency` only — not shipped to production

**Migration runner (`apps/api/src/db/migrate.ts`):**

Apply the same conditional pattern:

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

**`drizzle.config.ts`:** No changes needed. Drizzle Kit uses its own internal postgres connection that works with standard `postgresql://` URLs from both Neon and local Docker.

### 6.3 Zod Environment Validation

Create one `env.ts` per app that validates and exports a typed env object. All apps already have Zod installed.

#### `apps/api/src/env.ts` (Zod v4)

```typescript
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().url(),
  LOOP_API_KEY: z.string().min(1),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4242),
  LOOP_URL: z.string().url().default('http://localhost:4242'),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),
  SENTRY_CLIENT_SECRET: z.string().optional(),
  POSTHOG_WEBHOOK_SECRET: z.string().optional(),
});

const result = schema.safeParse(process.env);

if (!result.success) {
  console.error('\n  Missing or invalid environment variables:\n');
  result.error.issues.forEach((i) => console.error(`  - ${i.path.join('.')}: ${i.message}`));
  console.error('\n  Copy apps/api/.env.example to apps/api/.env\n');
  process.exit(1);
}

export const env = result.data;
export type Env = z.infer<typeof schema>;
```

#### `apps/app/src/env.ts` (Zod v3)

```typescript
import { z } from 'zod';

const schema = z.object({
  VITE_API_URL: z.string().url().default('http://localhost:4242'),
  VITE_LOOP_API_KEY: z.string().min(1),
});

const result = schema.safeParse(import.meta.env);

if (!result.success) {
  console.error('\n  Missing or invalid environment variables:\n');
  result.error.issues.forEach((i: z.ZodIssue) =>
    console.error(`  - ${i.path.join('.')}: ${i.message}`)
  );
  console.error('\n  Copy apps/app/.env.example to apps/app/.env\n');
  throw new Error('Invalid environment variables');
}

export const env = result.data;
export type Env = z.infer<typeof schema>;
```

Note: Vite apps use `import.meta.env` not `process.env`. Using `throw` instead of `process.exit` since this runs in the browser build pipeline.

#### `apps/web/src/env.ts` (Zod v4)

```typescript
import { z } from 'zod';

const schema = z.object({
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

const result = schema.safeParse(process.env);

if (!result.success) {
  console.error('\n  Missing or invalid environment variables:\n');
  result.error.issues.forEach((i) => console.error(`  - ${i.path.join('.')}: ${i.message}`));
  console.error('\n  Copy apps/web/.env.example to apps/web/.env\n');
  process.exit(1);
}

export const env = result.data;
export type Env = z.infer<typeof schema>;
```

All PostHog vars are optional — the web app works without analytics.

### 6.4 Wire `env.ts` Into Existing Code

Replace all raw `process.env` / `import.meta.env` access with typed `env` imports:

| File                                  | Current                                                             | New                                                 |
| ------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------- |
| `apps/api/src/index.ts`               | `process.env.PORT`, `process.env.NODE_ENV`                          | `env.PORT`, `env.NODE_ENV`                          |
| `apps/api/src/middleware/auth.ts`     | `process.env.LOOP_API_KEY`                                          | `env.LOOP_API_KEY`                                  |
| `apps/api/src/middleware/webhooks.ts` | `process.env.GITHUB_WEBHOOK_SECRET`, etc.                           | `env.GITHUB_WEBHOOK_SECRET`, etc.                   |
| `apps/api/src/lib/prompt-engine.ts`   | `process.env.LOOP_URL`, `process.env.LOOP_API_KEY`                  | `env.LOOP_URL`, `env.LOOP_API_KEY`                  |
| `apps/api/src/db/index.ts`            | `process.env.DATABASE_URL!`                                         | `env.DATABASE_URL`                                  |
| `apps/api/src/db/migrate.ts`          | `process.env.DATABASE_URL!`                                         | `env.DATABASE_URL`                                  |
| `apps/app/src/lib/api-client.ts`      | `import.meta.env.VITE_API_URL`, `import.meta.env.VITE_LOOP_API_KEY` | `env.VITE_API_URL`, `env.VITE_LOOP_API_KEY`         |
| `apps/web/src/lib/posthog-server.ts`  | `process.env.NEXT_PUBLIC_POSTHOG_KEY!`                              | `env.NEXT_PUBLIC_POSTHOG_KEY` (with optional guard) |
| `apps/web/instrumentation-client.ts`  | `process.env.NEXT_PUBLIC_POSTHOG_KEY!`                              | `env.NEXT_PUBLIC_POSTHOG_KEY` (with optional guard) |

**Important:** For webhook middleware, the optional secrets (`GITHUB_WEBHOOK_SECRET`, etc.) are validated at runtime — the middleware already throws 500 if the secret is not configured. The `env.ts` marks them as `z.string().optional()` so the app can start without them, but the middleware enforces presence when the webhook route is actually hit.

### 6.5 Pre-filled `.env.example` Files

#### `apps/api/.env.example`

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

#### `apps/app/.env.example`

```env
# Loop Dashboard
# Copy to .env: cp .env.example .env
# No editing needed for local development!

# API base URL (defaults to http://localhost:4242 if not set)
VITE_API_URL=http://localhost:4242

# API key — must match LOOP_API_KEY in apps/api/.env
VITE_LOOP_API_KEY=loop-dev-api-key-insecure
```

#### `apps/web/.env.example`

No changes needed — PostHog keys remain commented out (all optional).

### 6.6 Setup Script (`scripts/setup.sh`)

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

### 6.7 Documentation Updates

The following documentation files need updating:

1. **`CLAUDE.md`** — Add `dx`, `dx:down`, `dx:reset`, `setup` commands to the Commands section
2. **`docs/getting-started/installation.mdx`** — Add Docker as a prerequisite, document `npm run setup` and manual setup flow
3. **`docs/getting-started/quickstart.mdx`** — Update the quick-start with `npm run dx` step
4. **`docs/self-hosting/index.mdx`** — Update environment variable reference with new defaults
5. **Contributing guides** — Update developer setup instructions with Docker-based flow

## 7. User Experience

### New Contributor Flow (Automated)

```bash
git clone https://github.com/dork-labs/loop.git
cd loop
npm run setup    # installs deps, copies .env, starts postgres, runs migrations
npm run dev      # starts all apps
```

### New Contributor Flow (Manual)

```bash
git clone https://github.com/dork-labs/loop.git
cd loop
npm install
cp apps/api/.env.example apps/api/.env
cp apps/app/.env.example apps/app/.env
npm run dx                        # starts postgres at localhost:54320
npm run db:migrate -w apps/api    # applies schema
npm run dev                       # starts all apps
```

### Missing Env Var Experience

Instead of a cryptic runtime error, contributors see:

```
  Missing or invalid environment variables:

  - DATABASE_URL: Required
  - LOOP_API_KEY: String must contain at least 1 character(s)

  Copy apps/api/.env.example to apps/api/.env
```

## 8. Testing Strategy

### What Doesn't Change

- All existing tests continue using PGlite via `withTestDb()` — completely unaffected
- Test setup (`apps/api/src/__tests__/setup.ts`) remains independent of Docker postgres
- No test files need modification

### What to Test

1. **Env validation tests** — Verify `safeParse` rejects invalid configs and accepts valid ones. Test in isolation by calling the schema's `safeParse` directly (not by importing `env.ts` which calls `process.exit`).

2. **Driver swap type compatibility** — Verify that both `NeonHttpDatabase` and `NodePgDatabase` satisfy the `Database` type union. This is a compile-time check (TypeScript), not a runtime test.

3. **Setup script** — Manual verification that `scripts/setup.sh` is idempotent (safe to re-run). Not suitable for automated testing since it requires Docker.

### Test Examples

```typescript
// env.test.ts — test the schema, not the module side effect
import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Re-declare the schema (or export it separately from env.ts)
const apiEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  LOOP_API_KEY: z.string().min(1),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4242),
  LOOP_URL: z.string().url().default('http://localhost:4242'),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),
  SENTRY_CLIENT_SECRET: z.string().optional(),
  POSTHOG_WEBHOOK_SECRET: z.string().optional(),
});

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
});
```

## 9. Performance Considerations

- **Startup time:** The conditional `import()` adds negligible overhead (~5ms) to server startup
- **Connection pooling:** The `pg` driver creates a `Pool` which manages connections efficiently for local dev. The Neon HTTP driver is stateless (no pool needed)
- **Docker resource usage:** PostgreSQL 16-alpine uses ~30MB RAM at idle — minimal impact
- **No runtime cost in production:** The `pg` package is a devDependency and is not bundled for production deployment

## 10. Security Considerations

- **Dev API key (`loop-dev-api-key-insecure`):** Intentionally insecure and clearly named. Only used for local development. Production deployments must set a real key.
- **Docker postgres credentials (`loop:loop`):** Local-only, not exposed to the network. The container only binds to `localhost:54320`.
- **`.env` files:** Already in `.gitignore` — never committed to the repository
- **No secrets in `.env.example`:** All values are safe defaults or commented-out placeholders
- **Webhook secrets remain optional:** The app starts without them; webhook middleware enforces their presence at request time

## 11. Documentation

Files that need creation or updates:

| File                                    | Action | Description                                                  |
| --------------------------------------- | ------ | ------------------------------------------------------------ |
| `CLAUDE.md`                             | Update | Add `dx`, `dx:down`, `dx:reset`, `setup` to Commands section |
| `docs/getting-started/installation.mdx` | Update | Add Docker prerequisite, `npm run setup` flow                |
| `docs/getting-started/quickstart.mdx`   | Update | Add `npm run dx` step to quick-start                         |
| `docs/self-hosting/index.mdx`           | Update | Update env var reference with defaults                       |
| `docs/contributing/setup.mdx`           | Update | Full developer setup guide with Docker flow                  |

## 12. Implementation Phases

### Phase 1: Infrastructure

1. Create `docker-compose.dev.yml`
2. Add `pg` and `@types/pg` as devDependencies to `apps/api`
3. Add `dx`, `dx:down`, `dx:reset`, `setup` scripts to root `package.json`

### Phase 2: Environment Validation

4. Create `apps/api/src/env.ts` with Zod validation
5. Create `apps/app/src/env.ts` with Zod validation
6. Create `apps/web/src/env.ts` with Zod validation

### Phase 3: Driver Swap & Wiring

7. Rewrite `apps/api/src/db/index.ts` with conditional driver swap
8. Rewrite `apps/api/src/db/migrate.ts` with conditional driver swap
9. Wire `env.ts` into `apps/api/src/index.ts`
10. Wire `env.ts` into `apps/api/src/middleware/auth.ts`
11. Wire `env.ts` into `apps/api/src/middleware/webhooks.ts`
12. Wire `env.ts` into `apps/api/src/lib/prompt-engine.ts`
13. Wire `env.ts` into `apps/app/src/lib/api-client.ts`
14. Wire `env.ts` into `apps/web/src/lib/posthog-server.ts` and `instrumentation-client.ts`

### Phase 4: Defaults & Setup

15. Update `apps/api/.env.example` with working local defaults
16. Update `apps/app/.env.example` with working local defaults
17. Create `scripts/setup.sh`

### Phase 5: Testing & Validation

18. Write env schema validation tests
19. Verify all existing tests still pass
20. Verify TypeScript compilation succeeds

### Phase 6: Documentation

21. Update `CLAUDE.md` with new commands
22. Update `docs/getting-started/installation.mdx`
23. Update `docs/getting-started/quickstart.mdx`
24. Update `docs/self-hosting/index.mdx`
25. Update contributing guides

## 13. Open Questions

None — all clarifications resolved during ideation:

1. ~~**Port mapping**~~ (RESOLVED) → 54320:5432
2. ~~**Driver gate**~~ (RESOLVED) → `NODE_ENV !== 'production'`
3. ~~**Shared dev API key**~~ (RESOLVED) → `loop-dev-api-key-insecure`
4. ~~**Drizzle config**~~ (RESOLVED) → No special handling needed
5. ~~**Docs scope**~~ (RESOLVED) → All documentation

## 14. Related ADRs

| ADR  | Title                                          | Relevance                                                                     |
| ---- | ---------------------------------------------- | ----------------------------------------------------------------------------- |
| 0003 | Use Neon PostgreSQL as the database provider   | The Neon driver incompatibility is the reason for the conditional driver swap |
| 0004 | Use Drizzle ORM for database access            | Drizzle's adapter pattern enables the driver swap                             |
| 0007 | Use PGLite for test database instead of Docker | Tests are unaffected — PGlite path is independent                             |

## 15. References

- **Ideation:** `specs/dev-setup-dx/01-ideation.md`
- **Research:** `research/20260221_dev-setup-dx.md`
- **Recommendations:** `.temp/dev-setup-recommendations.md`
- **Documenso `dx` pattern:** Convention for developer experience scripts
- **Cal.com Docker Compose:** Inspiration for local development services
- **Drizzle ORM drivers:** `drizzle-orm/neon-http` and `drizzle-orm/node-postgres`
