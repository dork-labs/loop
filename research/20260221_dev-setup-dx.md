# Research: Developer Setup DX Improvements

**Date:** 2026-02-21
**Feature Slug:** dev-setup-dx
**Research Depth:** Deep
**Searches Performed:** 14
**Sources Found:** 22 high-quality sources

---

## Research Summary

This report covers four implementation areas for improving local developer setup in the Loop Turborepo monorepo: (1) Docker Compose for local PostgreSQL, (2) Zod env validation per app, (3) pre-filled `.env.example` files with working local defaults, and (4) an optional `setup.sh` script. The core complexity lies in adapting the production Neon serverless driver to work against a local Docker PostgreSQL instance. The recommended approach uses the Neon HTTP proxy pattern alongside a conditional driver swap so the same `DATABASE_URL` format works in both environments.

---

## Key Findings

### 1. Docker Compose for Local PostgreSQL

The standard `docker-compose.dev.yml` pattern with `postgres:16-alpine`, named volumes, and `pg_isready` healthchecks is well-established. The non-obvious challenge for Loop specifically is that `apps/api/src/db/index.ts` uses `@neondatabase/serverless` with `drizzle-orm/neon-http`, which speaks the Neon HTTP-over-WebSocket protocol — not standard `libpq`. Two approaches exist:

**Option A — Neon HTTP Proxy (full protocol fidelity):**
Run `ghcr.io/timowilhelm/local-neon-http-proxy:main` alongside vanilla postgres. The proxy translates Neon serverless wire protocol into standard PostgreSQL. The `DATABASE_URL` stays in the same `postgresql://` format. This keeps the production code path identical. Neon themselves recommend this pattern in their local dev guide.

**Option B — Conditional driver swap (simpler, less moving parts):**
Check `NODE_ENV` or a `LOCAL_DB` flag, and import `drizzle-orm/node-postgres` with the `pg` package for local dev, and `drizzle-orm/neon-http` for production. The `DATABASE_URL` format is the same. This is simpler but adds a conditional branch to `db/index.ts`.

**Recommendation:** Option B (conditional driver swap) is cleaner for a project this size. The Neon proxy adds a third container and DNS tricks (`localtest.me`) that create friction. A slim `if (process.env.NODE_ENV !== 'production')` branch in `db/index.ts` is straightforward, testable, and eliminates the proxy dependency entirely.

**Key docker-compose.dev.yml patterns:**

- Use `postgres:16-alpine` (pinned version, never `latest`)
- Named volume (`loop_postgres_data`) so data persists across `docker compose down` restarts
- `pg_isready` healthcheck so dependent services wait for readiness
- `restart: unless-stopped` (not `always` — prevents zombie containers after a clean `docker compose down`)
- Port `5432:5432` is fine for dev; if developers run local postgres already, use `54320:5432` (Documenso convention)
- Define `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` explicitly — do not rely on defaults

### 2. Zod Env Validation Pattern

Three viable approaches exist:

**Approach A — Raw Zod with `safeParse` + formatted errors (recommended):**
A hand-rolled `env.ts` using `z.object().safeParse(process.env)` with explicit error formatting via `error.flatten().fieldErrors`. This keeps zero new dependencies (Zod is already in all three apps). Fail fast: if validation fails, log each missing/invalid variable and call `process.exit(1)` before the app starts.

**Approach B — t3-env (`@t3-oss/env-core`, `@t3-oss/env-nextjs`):**
A wrapper library that adds server/client separation, prefix enforcement for `VITE_`/`NEXT_PUBLIC_`, and build-time validation via `next.config.ts` or `vite.config.ts` import. Adds a dependency but removes boilerplate for the client/server split concern. ESM-only; requires TypeScript 5+.

**Approach C — `@t3-oss/env-nextjs` for Next.js, raw Zod for the others:**
A mixed approach — t3-env for the Next.js web app (where `NEXT_PUBLIC_` prefix enforcement matters) and hand-rolled for API and app.

**Recommendation:** Approach A (raw Zod) for all three apps. Loop already has Zod in every app. The code is under 40 lines per file, fully transparent, and zero new dependencies. The `VITE_` prefix concern is addressed by only putting `VITE_`-prefixed vars in the Vite app's schema. `t3-env` is worth adding when you have 20+ env vars with complex server/client splitting — not at this scale.

**Handling `import.meta.env` in Vite:**
Vite exposes env vars as strings on `import.meta.env`. For the `env.ts` pattern, pass `import.meta.env` instead of `process.env` to the Zod schema. Vite's `vite-env.d.ts` augmentation (`interface ImportMetaEnv`) can be dropped — the Zod schema becomes the source of truth for types. Keep `VITE_` prefix on all client vars.

**Handling `process.env` in Next.js:**
Next.js only bundles explicitly accessed env vars. Import `env.ts` in `next.config.ts` to trigger validation at build time. Use `process.env.VAR_NAME` references directly in the `runtimeEnv` object to satisfy the bundler's static analysis.

**`parse` vs `safeParse`:**
Use `safeParse` + explicit `process.exit(1)` over `parse`. The reason: `parse` throws a raw Zod exception with a stack trace that buries the actual missing-variable message. `safeParse` lets you format `error.flatten().fieldErrors` into a human-readable list of exactly which variables are missing or invalid, then exit cleanly. This is dramatically better DX for a new contributor's first `npm run dev`.

### 3. Pre-filled `.env.example` Patterns

The current `.env.example` files have placeholder values that require editing (`your-api-key-here`, `postgresql://user:pass@host/dbname`). The goal is zero-edit for local dev after `cp .env.example .env`.

**Safe to pre-fill with real working values:**

- `DATABASE_URL=postgresql://loop:loop@localhost:5432/loop` (matches docker-compose defaults)
- `LOOP_API_KEY=loop-dev-api-key-insecure` (clearly non-production, fixed for local convenience)
- `VITE_API_URL=http://localhost:4242` (already pre-filled — keep it)
- `VITE_LOOP_API_KEY=loop-dev-api-key-insecure` (matches `LOOP_API_KEY`)
- `NODE_ENV=development` (optional, Hono/Node default)

**What to mark clearly as production-only:**

- Webhook secrets (`GITHUB_WEBHOOK_SECRET`, `SENTRY_CLIENT_SECRET`, `POSTHOG_WEBHOOK_SECRET`)
- Use the comment convention: `# PRODUCTION ONLY — not needed for local dev`

**What to never pre-fill:**

- Real credentials of any kind
- Private keys that look like real keys (e.g., a real-looking JWT secret)
- Service API keys that could be scraped from GitHub

**Cal.com convention observed:** Most vars left blank (`VAR=`) with comments explaining where to get them. For optional integrations (webhooks), vars are fully commented out with `# VAR_NAME=`. Functional defaults (database URL, local URLs) are pre-filled. Loop should adopt this: pre-fill everything needed for `npm run dev` locally; leave integration vars blank or commented.

**Security note:** A value like `loop-dev-api-key-insecure` in `.env.example` is safe — it's clearly not a real key, it's in a public repo, and it only works against a local dev instance. This is the Documenso/Cal.com pattern. Never use random-looking strings (e.g., `sk-proj-abc123`) that could be mistaken for real credentials.

### 4. Setup Script (`scripts/setup.sh`)

**What a good setup.sh covers (in order):**

1. Node version check (compare against `.node-version` or `engines` in `package.json`)
2. Docker availability check (`docker info` or `docker compose version`)
3. `.env` file copying for each app (idempotent — skip if file already exists)
4. `npm install` (idempotent — npm is already idempotent)
5. `docker compose -f docker-compose.dev.yml up -d` (idempotent — compose handles this)
6. Wait for PostgreSQL to be healthy (poll `docker compose exec postgres pg_isready`)
7. Run migrations (`npm run db:migrate` from `apps/api/`)
8. Print next steps

**Idempotency requirements:**

- `.env` copy: `[ -f apps/api/.env ] || cp apps/api/.env.example apps/api/.env`
- Docker compose: `docker compose up -d` is already idempotent
- Migrations: Drizzle migrations track applied migrations — re-running is safe
- Node install: `npm install` is idempotent

**`dx` script convention (Documenso pattern):**
Add `"dx": "docker compose -f docker-compose.dev.yml up -d"` to root `package.json`. This is the minimal "spin up the dev stack" shortcut. `setup.sh` is the full first-run experience; `dx` is what developers run daily.

---

## Detailed Analysis

### Neon Serverless Driver with Local Docker Postgres

This is the most project-specific complexity in the entire feature. The current `apps/api/src/db/index.ts`:

```typescript
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
```

`neon()` from `@neondatabase/serverless` speaks an HTTP-over-WebSocket protocol to Neon's edge servers. It does not speak standard `libpq` TCP. Therefore, `DATABASE_URL=postgresql://loop:loop@localhost:5432/loop` will **not work** with the current code — the Neon client will try to connect to `localhost` using the Neon wire protocol and fail.

**Recommended db/index.ts pattern:**

```typescript
import * as schema from './schema';

function createDb() {
  const url = process.env.DATABASE_URL!;
  // In local dev, use the standard pg driver so we can connect to Docker postgres.
  // In production (Vercel/Neon), use the serverless HTTP driver.
  if (process.env.NODE_ENV !== 'production') {
    const { drizzle } = await import('drizzle-orm/node-postgres');
    const { Pool } = await import('pg');
    return drizzle(new Pool({ connectionString: url }), { schema });
  }
  const { neon } = await import('@neondatabase/serverless');
  const { drizzle } = await import('drizzle-orm/neon-http');
  return drizzle(neon(url), { schema });
}
```

Since the module is ESM (`"type": "module"` in `apps/api/package.json`), dynamic imports work. However, since `createDb` would be async and `db` is used synchronously as a module export, the simpler pattern is a top-level conditional using `process.env.NODE_ENV`:

```typescript
// Synchronous version using static imports gated on NODE_ENV
// This requires adding 'pg' as a dev dependency in apps/api
import * as schema from './schema';

let db: Database;

if (process.env.NODE_ENV === 'production') {
  const { neon } = await import('@neondatabase/serverless');
  const { drizzle } = await import('drizzle-orm/neon-http');
  db = drizzle(neon(process.env.DATABASE_URL!), { schema });
} else {
  const { Pool } = await import('pg');
  const { drizzle } = await import('drizzle-orm/node-postgres');
  db = drizzle(new Pool({ connectionString: process.env.DATABASE_URL! }), { schema });
}

export { db };
```

Top-level `await` is valid in ESM modules with Node.js 14.8+. This approach adds `pg` as a dev dependency (not production), which is clean.

**Alternative — Neon local proxy docker-compose service:**
Add `timowilhelm/local-neon-http-proxy` to docker-compose.dev.yml. The proxy listens on port 4444, proxies HTTP/WebSocket Neon protocol to standard postgres on port 5432. No code changes to `db/index.ts`. The tradeoff is a second container, the `localtest.me` DNS trick (fails offline), and more complex `docker-compose.dev.yml`. For a simple project where all developers can be trusted to set `NODE_ENV=development`, the conditional driver is significantly simpler.

### Zod env.ts Per App

**API (`apps/api/src/env.ts`) — Node.js / Hono:**

```typescript
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  LOOP_API_KEY: z.string().min(1),
  // Webhook secrets are optional — only required in production
  GITHUB_WEBHOOK_SECRET: z.string().optional(),
  SENTRY_CLIENT_SECRET: z.string().optional(),
  POSTHOG_WEBHOOK_SECRET: z.string().optional(),
});

const result = schema.safeParse(process.env);

if (!result.success) {
  const errors = result.error.flatten().fieldErrors;
  const messages = Object.entries(errors)
    .map(([key, msgs]) => `  ${key}: ${msgs?.join(', ')}`)
    .join('\n');
  console.error(`\nInvalid environment variables:\n${messages}\n`);
  process.exit(1);
}

export const env = result.data;
export type Env = typeof result.data;
```

Import at the top of `src/index.ts` (or wherever the server bootstraps) before any other imports that touch `process.env`.

**App (`apps/app/src/env.ts`) — Vite / React:**

```typescript
import { z } from 'zod';

// Vite exposes env vars on import.meta.env; only VITE_-prefixed vars are available.
const schema = z.object({
  VITE_API_URL: z.string().url().default('http://localhost:4242'),
  VITE_LOOP_API_KEY: z.string().min(1),
});

const result = schema.safeParse(import.meta.env);

if (!result.success) {
  const errors = result.error.flatten().fieldErrors;
  const messages = Object.entries(errors)
    .map(([key, msgs]) => `  ${key}: ${msgs?.join(', ')}`)
    .join('\n');
  // In browser context, throw rather than process.exit
  throw new Error(`Invalid environment variables:\n${messages}`);
}

export const env = result.data;
export type Env = typeof result.data;
```

**Web (`apps/web/src/env.ts`) — Next.js 16:**

```typescript
import { z } from 'zod';

const schema = z.object({
  // NEXT_PUBLIC_ vars are available client-side; others are server-only
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url().default('https://us.i.posthog.com'),
});

// Explicitly reference each var — Next.js static analysis requires this
const result = schema.safeParse({
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
});

if (!result.success) {
  const errors = result.error.flatten().fieldErrors;
  const messages = Object.entries(errors)
    .map(([key, msgs]) => `  ${key}: ${msgs?.join(', ')}`)
    .join('\n');
  console.error(`\nInvalid environment variables:\n${messages}\n`);
  // In Next.js, throwing crashes the build — which is exactly what we want
  throw new Error('Invalid environment variables');
}

export const env = result.data;
```

Import in `next.config.ts`:

```typescript
import './src/env'; // validates at build time
```

**Important Zod 4 note:** `apps/api` and `apps/web` have `zod: "^4.x"` while `apps/app` has `zod: "^3.x"`. The API shape is identical for this use case but verify version before copying patterns. `z.string().min(1)` and `z.enum()` work identically in both versions.

### Pre-filled .env.example Recommended Values

**`apps/api/.env.example` (after update):**

```env
# Loop API — Local Development
# Run `cp apps/api/.env.example apps/api/.env` — no editing required for local dev.

# ── Database ──────────────────────────────────────────────────────────────────
# Local Docker (matches docker-compose.dev.yml defaults)
DATABASE_URL=postgresql://loop:loop@localhost:5432/loop

# ── API Authentication ────────────────────────────────────────────────────────
# Fixed dev key — matches VITE_LOOP_API_KEY in apps/app/.env
LOOP_API_KEY=loop-dev-api-key-insecure

# ── Runtime ───────────────────────────────────────────────────────────────────
NODE_ENV=development

# ── Webhook Secrets — PRODUCTION ONLY ────────────────────────────────────────
# Not needed for local development. Set in Vercel env for production.
# GITHUB_WEBHOOK_SECRET=
# SENTRY_CLIENT_SECRET=
# POSTHOG_WEBHOOK_SECRET=
```

**`apps/app/.env.example` (after update):**

```env
# Loop Dashboard — Local Development
# Run `cp apps/app/.env.example apps/app/.env` — no editing required for local dev.

# API base URL — local dev default
VITE_API_URL=http://localhost:4242

# API key — must match LOOP_API_KEY in apps/api/.env
VITE_LOOP_API_KEY=loop-dev-api-key-insecure
```

**`apps/web/.env.example` (after update):**

```env
# Loop Marketing Site — Local Development
# Run `cp apps/web/.env.example apps/web/.env` — no editing required for local dev.
# All vars below are optional for local development.

# ── PostHog Analytics — PRODUCTION ONLY ──────────────────────────────────────
# NEXT_PUBLIC_POSTHOG_KEY=
# NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

### Docker Compose Configuration

**`docker-compose.dev.yml` at repo root:**

```yaml
# Local development infrastructure — PostgreSQL only.
# Usage: npm run dx (or `docker compose -f docker-compose.dev.yml up -d`)

services:
  postgres:
    image: postgres:16-alpine
    container_name: loop-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: loop
      POSTGRES_PASSWORD: loop
      POSTGRES_DB: loop
    ports:
      - '5432:5432'
    volumes:
      - loop_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U loop -d loop']
      interval: 5s
      timeout: 5s
      retries: 10
      start_period: 10s

volumes:
  loop_postgres_data:
    name: loop_postgres_data
```

Port notes:

- `5432:5432` is the default. If developers commonly have a local postgres, use `54320:5432` and update `DATABASE_URL` default to match. Since Loop's target audience is likely developers who do not run a local postgres (Neon is the "intended" path), `5432:5432` is fine.

### Setup Script (`scripts/setup.sh`)

```bash
#!/usr/bin/env bash
set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${GREEN}[setup]${NC} $1"; }
warn()    { echo -e "${YELLOW}[setup]${NC} $1"; }
error()   { echo -e "${RED}[setup]${NC} $1" >&2; exit 1; }

# ── 1. Node version check ─────────────────────────────────────────────────────
REQUIRED_NODE="20"
CURRENT_NODE=$(node --version 2>/dev/null | sed 's/v//' | cut -d. -f1 || echo "0")
if [ "$CURRENT_NODE" -lt "$REQUIRED_NODE" ]; then
  error "Node.js $REQUIRED_NODE+ required (found: $CURRENT_NODE). Use nvm or volta."
fi
info "Node.js $(node --version) ✓"

# ── 2. Docker check ───────────────────────────────────────────────────────────
if ! docker info &>/dev/null; then
  error "Docker is not running. Start Docker Desktop and try again."
fi
info "Docker ✓"

# ── 3. Copy .env files (idempotent) ───────────────────────────────────────────
copy_env() {
  local example="$1" target="$2"
  if [ ! -f "$target" ]; then
    cp "$example" "$target"
    info "Created $target from $example"
  else
    warn "$target already exists — skipping (delete it to reset)"
  fi
}

copy_env "apps/api/.env.example"  "apps/api/.env"
copy_env "apps/app/.env.example"  "apps/app/.env"
copy_env "apps/web/.env.example"  "apps/web/.env"

# ── 4. Install dependencies ────────────────────────────────────────────────────
info "Installing dependencies..."
npm install

# ── 5. Start Docker services ──────────────────────────────────────────────────
info "Starting local PostgreSQL..."
docker compose -f docker-compose.dev.yml up -d

# ── 6. Wait for Postgres to be ready ──────────────────────────────────────────
info "Waiting for PostgreSQL to be ready..."
RETRIES=20
until docker compose -f docker-compose.dev.yml exec -T postgres \
    pg_isready -U loop -d loop &>/dev/null; do
  RETRIES=$((RETRIES - 1))
  if [ "$RETRIES" -eq 0 ]; then
    error "PostgreSQL did not become ready in time."
  fi
  sleep 1
done
info "PostgreSQL is ready ✓"

# ── 7. Run database migrations ─────────────────────────────────────────────────
info "Running database migrations..."
(cd apps/api && npm run db:migrate)
info "Migrations applied ✓"

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}Setup complete!${NC} Start the dev server with:"
echo ""
echo "  npm run dev"
echo ""
echo "API:       http://localhost:4242"
echo "Dashboard: http://localhost:3000"
echo "Docs:      http://localhost:3001"
echo ""
```

**Idempotency properties:**

- `.env` copy: `[ -f ]` guard prevents overwrite
- `npm install`: npm is idempotent by design
- `docker compose up -d`: idempotent — skips already-running containers
- `db:migrate`: Drizzle tracks applied migrations in the `__drizzle_migrations` table — re-running is safe

### Root `package.json` Script Additions

Add to `"scripts"` in root `package.json`:

```json
{
  "dx": "docker compose -f docker-compose.dev.yml up -d",
  "dx:down": "docker compose -f docker-compose.dev.yml down",
  "dx:reset": "docker compose -f docker-compose.dev.yml down -v",
  "setup": "bash scripts/setup.sh"
}
```

- `dx` — spin up the dev stack (daily use, Documenso convention)
- `dx:down` — stop containers (keep data volume)
- `dx:reset` — nuclear option: stops containers and destroys the named volume (fresh db)
- `setup` — first-run full setup script

---

## Approaches Compared

### Docker Compose: Neon Proxy vs Conditional Driver

| Factor                                 | Neon Local Proxy             | Conditional Driver Swap           |
| -------------------------------------- | ---------------------------- | --------------------------------- |
| Code changes to `db/index.ts`          | None                         | ~15 lines                         |
| Extra containers                       | 1 (proxy)                    | 0                                 |
| Works offline                          | No (`localtest.me` DNS)      | Yes                               |
| Production code path exercised locally | Yes                          | No                                |
| New dev dependencies                   | None                         | `pg`, `drizzle-orm/node-postgres` |
| Complexity                             | Higher (two containers, DNS) | Lower                             |
| Recommended for this project           | No                           | **Yes**                           |

### Env Validation: Raw Zod vs t3-env

| Factor                            | Raw Zod `safeParse`              | t3-env                                 |
| --------------------------------- | -------------------------------- | -------------------------------------- |
| New dependencies                  | 0                                | 2 (`@t3-oss/env-core` + framework pkg) |
| Lines of code                     | ~30 per app                      | ~20 per app                            |
| Server/client var enforcement     | Manual (naming convention)       | Automatic + type error                 |
| `VITE_` prefix enforcement        | Manual                           | Automatic                              |
| `NEXT_PUBLIC_` prefix enforcement | Manual                           | Automatic                              |
| Build-time validation in Next.js  | Manual (`import` in next.config) | Built-in                               |
| Transparent / no magic            | Yes                              | No (wrapper abstraction)               |
| Recommended for this project      | **Yes**                          | Not needed at this scale               |

---

## Security Considerations

1. **`loop-dev-api-key-insecure` as the default `LOOP_API_KEY`**: Acceptable. The word "insecure" in the name is intentional. It only works against `localhost:4242`. It should never be used in production. Add a comment to this effect in `.env.example`.

2. **`POSTGRES_PASSWORD: loop` in docker-compose**: Acceptable for local dev. The container is not exposed to the network beyond `localhost:5432`. Do not set `POSTGRES_PASSWORD` to an empty string — the postgres image requires a non-empty password unless `POSTGRES_HOST_AUTH_METHOD=trust` is used, which is a worse default.

3. **Committing `.env.example` with values**: This is correct and intended. `.env.example` belongs in git. `.env` (the actual secrets file) must remain in `.gitignore`. Verify `.gitignore` has `**/.env` or per-app `.env` entries.

4. **`process.exit(1)` in env validation**: The env.ts `process.exit(1)` call is correct for server-side code (API, web). For the Vite app (browser), `throw new Error()` is appropriate since `process.exit` is not available.

5. **`z.string().min(1)` vs `z.string().nonempty()`**: Both are equivalent. Use `min(1)` for consistency. It rejects empty strings, which is what you want — `DATABASE_URL=` (blank) should fail validation just as `DATABASE_URL` (absent) does.

---

## Research Gaps & Limitations

- The Neon serverless driver behavior against a plain local postgres was confirmed by documentation (it will not work), but the exact error message was not captured. Implementers should verify the exact error during implementation.
- `drizzle-kit` (used for migrations) uses a separate `drizzle.config.ts` that references `DATABASE_URL`. This config should also be verified to work with the local postgres URL format — based on Drizzle docs this should work with the standard `postgresql://` URL.
- The `apps/web/` Next.js app has only optional PostHog analytics vars. If future server-side vars are added (e.g., a CMS API key), the `env.ts` pattern will need to separate `server` and `client` schemas. At that point, `t3-env` becomes more attractive.
- Zod version mismatch: `apps/app` uses Zod v3, while `apps/api` and `apps/web` use Zod v4. Both versions support the patterns described here, but the API surface differs slightly (e.g., `.nonempty()` was renamed to `.min(1)` in v4). Verify before copy-pasting between apps.

---

## Contradictions & Disputes

- **Neon docs vs simplicity**: Neon's official local dev guide recommends the proxy approach to preserve production code path fidelity. For a solo/small team project, the conditional driver approach is commonly used in practice despite not matching the production path. Both are valid; the trade-off is fidelity vs simplicity.
- **t3-env ESM-only caveat**: t3-env is ESM-only and requires TypeScript 5+ with Bundler module resolution. Since this monorepo uses `"type": "module"` throughout and TypeScript 5, this is not a blocker — but it is a documented compatibility requirement to be aware of.

---

## Sources & Evidence

- Docker Compose PostgreSQL healthcheck patterns: [Docker Compose Health Checks](https://last9.io/blog/docker-compose-health-checks/)
- Postgres Docker image environment variables: [How to Use the Postgres Docker Official Image](https://www.docker.com/blog/how-to-use-the-postgres-docker-official-image/)
- pg_isready healthcheck on Alpine: [Waiting for PostgreSQL to start in Docker Compose](https://laurent-bel.medium.com/waiting-for-postgresql-to-start-in-docker-compose-c72271b3c74a)
- Zod env validation with safeParse: [Validating environment variables with zod](https://jfranciscosousa.com/blog/validating-environment-variables-with-zod)
- Zod env type safety and validation: [Environment variables type safety with Zod](https://www.creatures.sh/blog/env-type-safety-and-validation/)
- t3-env core API: [T3 Env Core](https://env.t3.gg/docs/core)
- t3-env Next.js integration: [T3 Env Next.js](https://env.t3.gg/docs/nextjs)
- Vite import.meta.env typing: [Env Variables and Modes — Vite](https://vite.dev/guide/env-and-mode)
- Cal.com .env.example pattern: [cal.com/.env.example](https://github.com/calcom/cal.com/blob/main/.env.example)
- Documenso dx script and quickstart: [Documenso Developer Quickstart](https://docs.documenso.com/developers/local-development/quickstart)
- Neon local development guide: [Local Development with Neon](https://neon.com/guides/local-development-with-neon)
- Drizzle + local/Neon postgres: [Drizzle with Local and Serverless Postgres](https://neon.com/guides/drizzle-local-vercel)
- Postgres Docker Hub official image: [postgres — Docker Hub](https://hub.docker.com/_/postgres)
- Docker named volumes for postgres: [Understanding Docker Volumes](https://medium.com/@jonas.granlund/docker-volumes-and-persistent-storage-the-complete-guide-71a100875b6c)

---

## Search Methodology

- Searches performed: 14
- Most productive terms: "Zod env validation safeParse formatError", "docker-compose postgres healthcheck pg_isready alpine", "@neondatabase/serverless local postgres docker alternative", "t3-env Vite Next.js import.meta.env", "Documenso dx script quickstart"
- Primary sources: Neon official docs, Vite official docs, t3-env official docs, Francisco Sousa's Zod env article, Docker official blog, Documenso docs, Cal.com GitHub
