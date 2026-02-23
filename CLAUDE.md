# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

For product vision and architecture rationale, see @meta/loop-litepaper.md

## What This Is

Loop is the Autonomous Improvement Engine — an open-source data layer and prompt engine that collects signals, organizes work into issues, and tells AI agents exactly what to do next. It closes the feedback loop for AI-powered development by turning raw data (errors, metrics, user feedback) into prioritized, actionable work items.

## Repository

- **GitHub:** https://github.com/dork-labs/loop
- **Marketing:** https://www.looped.me (Vercel project: `loop-web`)
- **App:** https://app.looped.me (Vercel project: `loop-app`)

## Monorepo Structure

This is a Turborepo monorepo with three apps:

```
loop/
├── apps/
│   ├── api/              # @loop/api - Hono API (TypeScript, Vercel Functions)
│   ├── app/              # @loop/app - React 19 SPA (Vite 6, Tailwind CSS 4)
│   └── web/              # @loop/web - Marketing site & docs (Next.js 16, Fumadocs)
├── decisions/            # Architecture Decision Records (ADRs)
├── docs/                 # External user-facing docs (MDX for Fumadocs)
├── research/             # Research artifacts
├── specs/                # Feature specs with manifest.json for chronological ordering
├── turbo.json
├── vitest.workspace.ts
└── package.json          # Root workspace config
```

## Commands

```bash
pnpm run dev              # Start all apps in dev mode (via Turborepo)
pnpm run dev:full         # Start local PostgreSQL + all apps
pnpm run build            # Build all apps
pnpm test                 # Vitest across api + app
pnpm run typecheck        # Type-check all packages
pnpm run lint             # ESLint across all packages
pnpm run lint:fix         # Auto-fix ESLint issues
pnpm run format           # Prettier format all files
pnpm run format:check     # Check formatting without writing
```

Run a single test file: `npx vitest run apps/api/src/__tests__/example.test.ts`

### Developer Setup Commands

```bash
pnpm run setup            # First-time setup (install, env, docker, migrate)
pnpm run db:dev:up        # Start local PostgreSQL (Docker Compose)
pnpm run db:dev:down      # Stop local PostgreSQL
pnpm run db:dev:reset     # Stop and delete local database volume
```

### Database Commands (run from repo root with `--filter`)

```bash
pnpm run --filter @loop/api db:generate  # Generate Drizzle migrations from schema changes
pnpm run --filter @loop/api db:migrate   # Apply pending migrations to the database
pnpm run --filter @loop/api db:push      # Push schema directly (skips migration files)
pnpm run --filter @loop/api db:studio    # Launch Drizzle Studio GUI for browsing data
```

## Tech Stack

- **API:** Hono (TypeScript) — lightweight, runs on Vercel Functions in production, Node.js locally
- **Frontend:** React 19 + Vite 6 + Tailwind CSS 4 + shadcn/ui + TanStack Router + TanStack Query + ky + Recharts
- **Marketing:** Next.js 16 + Fumadocs
- **Database:** PostgreSQL (Neon) + Drizzle ORM
- **Monorepo:** Turborepo
- **Testing:** Vitest
- **Code Quality:** ESLint 9 + Prettier

## Apps

### API (`apps/api/`)

Hono API server on port 5667 (local dev). Uses `@hono/node-server` for local development; deploys as Vercel Functions in production with zero config (Hono auto-detects the runtime).

#### Database

PostgreSQL via [Neon](https://neon.tech) serverless driver (production) or standard `pg` driver (local dev) + Drizzle ORM. The driver is selected at runtime via `NODE_ENV` in `apps/api/src/db/index.ts`. Schema files live in `apps/api/src/db/schema/` and migrations are generated into `apps/api/drizzle/migrations/`.

**Schema files:**

| File          | Tables                                                            |
| ------------- | ----------------------------------------------------------------- |
| `_helpers.ts` | Shared column helpers (`cuid2Id`, `timestamps`, `softDelete`)     |
| `issues.ts`   | `issues`, `labels`, `issue_labels`, `issue_relations`, `comments` |
| `projects.ts` | `projects`, `goals`                                               |
| `signals.ts`  | `signals`                                                         |
| `prompts.ts`  | `prompt_templates`, `prompt_versions`, `prompt_reviews`           |

#### API Endpoints

**Public (no auth):**

| Method | Path      | Description                                 |
| ------ | --------- | ------------------------------------------- |
| `GET`  | `/health` | Health check (`{ ok, service, timestamp }`) |
| `GET`  | `/`       | Service info (`{ name, version }`)          |

**Protected (`/api/*` -- requires `Authorization: Bearer <LOOP_API_KEY>`):**

| Method   | Path                                             | Description                                                    |
| -------- | ------------------------------------------------ | -------------------------------------------------------------- |
| `GET`    | `/api/issues`                                    | List issues (filterable by status, type, projectId; paginated) |
| `POST`   | `/api/issues`                                    | Create an issue                                                |
| `GET`    | `/api/issues/:id`                                | Get issue by ID with labels, relations, comments               |
| `PATCH`  | `/api/issues/:id`                                | Update an issue                                                |
| `DELETE` | `/api/issues/:id`                                | Soft-delete an issue                                           |
| `POST`   | `/api/issues/:id/relations`                      | Create a relation between two issues                           |
| `GET`    | `/api/issues/:id/comments`                       | List comments for an issue (threaded)                          |
| `POST`   | `/api/issues/:id/comments`                       | Add a comment to an issue                                      |
| `GET`    | `/api/projects`                                  | List projects (paginated)                                      |
| `POST`   | `/api/projects`                                  | Create a project                                               |
| `GET`    | `/api/projects/:id`                              | Get project with goal and issue counts                         |
| `PATCH`  | `/api/projects/:id`                              | Update a project                                               |
| `DELETE` | `/api/projects/:id`                              | Soft-delete a project                                          |
| `GET`    | `/api/goals`                                     | List goals (paginated)                                         |
| `POST`   | `/api/goals`                                     | Create a goal                                                  |
| `GET`    | `/api/goals/:id`                                 | Get goal by ID                                                 |
| `PATCH`  | `/api/goals/:id`                                 | Update a goal                                                  |
| `DELETE` | `/api/goals/:id`                                 | Soft-delete a goal                                             |
| `GET`    | `/api/labels`                                    | List labels (paginated)                                        |
| `POST`   | `/api/labels`                                    | Create a label                                                 |
| `DELETE` | `/api/labels/:id`                                | Soft-delete a label                                            |
| `DELETE` | `/api/relations/:id`                             | Hard-delete a relation                                         |
| `POST`   | `/api/signals`                                   | Ingest a signal (creates signal + linked issue)                |
| `GET`    | `/api/templates`                                 | List prompt templates (paginated)                              |
| `POST`   | `/api/templates`                                 | Create a prompt template                                       |
| `GET`    | `/api/templates/:id`                             | Get template with active version                               |
| `PATCH`  | `/api/templates/:id`                             | Update a template                                              |
| `DELETE` | `/api/templates/:id`                             | Soft-delete a template                                         |
| `GET`    | `/api/templates/:id/versions`                    | List versions for a template                                   |
| `POST`   | `/api/templates/:id/versions`                    | Create a new version                                           |
| `POST`   | `/api/templates/:id/versions/:versionId/promote` | Promote a version to active                                    |
| `GET`    | `/api/templates/:id/reviews`                     | List reviews across all versions                               |
| `POST`   | `/api/prompt-reviews`                            | Create a prompt review                                         |
| `GET`    | `/api/dashboard/stats`                           | System health metrics                                          |
| `GET`    | `/api/dashboard/activity`                        | Signal chains for activity timeline                            |
| `GET`    | `/api/dashboard/prompts`                         | Template health with scores                                    |

**Webhooks (`/api/signals/*` -- provider-specific auth, not Bearer token):**

| Method | Path                   | Auth                                  | Description           |
| ------ | ---------------------- | ------------------------------------- | --------------------- |
| `POST` | `/api/signals/posthog` | `POSTHOG_WEBHOOK_SECRET`              | PostHog metric alerts |
| `POST` | `/api/signals/github`  | `GITHUB_WEBHOOK_SECRET` (HMAC-SHA256) | GitHub events         |
| `POST` | `/api/signals/sentry`  | `SENTRY_CLIENT_SECRET` (HMAC-SHA256)  | Sentry error alerts   |

### App (`apps/app/`)

React 19 + Vite 6 + Tailwind CSS 4 dashboard SPA on port 5668 (app.looped.me). Dark mode only.

- **Routing:** TanStack Router with file-based routing (`src/routes/`) and code splitting via lazy routes
- **Data fetching:** TanStack Query with query key factories (`src/lib/query-keys.ts`) and per-resource staleTime tuning
- **API client:** ky with auth hooks (`src/lib/api-client.ts`)
- **UI components:** shadcn/ui (15 components in `src/components/ui/`)
- **Charts:** Recharts for sparklines and activity graphs
- **Views:** Issue List, Issue Detail, Activity Timeline, Goals Dashboard, Prompt Health
- **Keyboard shortcuts:** `g+i` Issues, `g+a` Activity, `g+g` Goals, `g+p` Prompts, `Cmd+B` Toggle sidebar, `?` Help
- Path alias: `@/*` maps to `./src/*`
- Build: `vite build` outputs to `dist/`

### Web (`apps/web/`)

Next.js 16 marketing site with Fumadocs for documentation. Serves the public-facing site at www.looped.me.

- `docs/` directory contains MDX content rendered at `/docs/*`
- Deployed to Vercel

## Path Aliases

- `@/*` -> `./src/*` (within each app, scoped to that app's source)

Configured in each app's `tsconfig.json` (for IDE/tsc) and `vite.config.ts` (for bundling).

## Environment Variables

Each app validates environment variables at startup using Zod (`env.ts`). Missing or invalid vars produce formatted error messages. Import `env` from `@/env` (or `../env`) instead of accessing `process.env` directly.

The API requires the following environment variables (see `apps/api/.env.example`):

| Variable                 | Required     | Description                                           |
| ------------------------ | ------------ | ----------------------------------------------------- |
| `DATABASE_URL`           | Yes          | Neon PostgreSQL connection string                     |
| `LOOP_API_KEY`           | Yes          | Bearer token for authenticating API requests          |
| `GITHUB_WEBHOOK_SECRET`  | For webhooks | HMAC secret for GitHub webhook signature verification |
| `SENTRY_CLIENT_SECRET`   | For webhooks | HMAC secret for Sentry webhook signature verification |
| `POSTHOG_WEBHOOK_SECRET` | For webhooks | Shared secret for PostHog webhook verification        |

The App requires the following environment variables (see `apps/app/.env.example`):

| Variable            | Required | Description                                            |
| ------------------- | -------- | ------------------------------------------------------ |
| `VITE_API_URL`      | No       | API base URL (defaults to `http://localhost:5667`)     |
| `VITE_LOOP_API_KEY` | Yes      | Bearer token for authenticating dashboard API requests |

## Testing

Tests use Vitest. The `vitest.workspace.ts` at the repo root configures test projects for `apps/api` and `apps/app`.

Tests live alongside source in `__tests__/` directories within each app.

API tests use **PGlite** (in-memory PostgreSQL) for full isolation -- no external database needed. The test helper `withTestDb()` spins up a fresh database per test with all migrations applied. See `apps/api/src/__tests__/setup.ts` for the test infrastructure.

## Code Quality

**ESLint 9** (flat config at `eslint.config.js`) + **Prettier** (`.prettierrc`) enforce code quality and formatting across the monorepo.

- **Prettier + Tailwind**: `prettier-plugin-tailwindcss` sorts Tailwind classes automatically.

## Architecture Decision Records

Key architectural decisions are documented in `decisions/` as lightweight ADRs (Michael Nygard format). Each ADR has YAML frontmatter (`number`, `title`, `status`, `created`, `spec`) and sections for Context, Decision, and Consequences.

- **Index**: `decisions/manifest.json` tracks all ADRs with `nextNumber` for sequential assignment
- **Commands**: `/adr:create` (new ADR), `/adr:list` (display table), `/adr:from-spec` (extract from spec)
- **Statuses**: `proposed` | `accepted` | `deprecated` | `superseded`

## Specifications

Feature specifications live in `specs/` with a central index at `specs/manifest.json`. Each spec has a directory (`specs/{slug}/`) containing `01-ideation.md`, `02-specification.md`, and optionally `03-tasks.md`. The manifest tracks chronological ordering via `nextNumber` and spec metadata (`number`, `slug`, `title`, `created`, `status`).
