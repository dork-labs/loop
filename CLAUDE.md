# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Loop is the Autonomous Improvement Engine — an open-source data layer and prompt engine that collects signals, organizes work into issues, and tells AI agents exactly what to do next. It closes the feedback loop for AI-powered development by turning raw data (errors, metrics, user feedback) into prioritized, actionable work items.

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
npm run dev              # Start all apps in dev mode (via Turborepo)
npm run build            # Build all apps
npm test                 # Vitest across api + app
npm run typecheck        # Type-check all packages
npm run lint             # ESLint across all packages
npm run lint:fix         # Auto-fix ESLint issues
npm run format           # Prettier format all files
npm run format:check     # Check formatting without writing
```

Run a single test file: `npx vitest run apps/api/src/__tests__/example.test.ts`

## Tech Stack

- **API:** Hono (TypeScript) — lightweight, runs on Vercel Functions in production, Node.js locally
- **Frontend:** React 19 + Vite 6 + Tailwind CSS 4 + shadcn/ui
- **Marketing:** Next.js 16 + Fumadocs
- **Database:** PostgreSQL + Drizzle ORM (coming)
- **Monorepo:** Turborepo
- **Testing:** Vitest
- **Code Quality:** ESLint 9 + Prettier

## Apps

### API (`apps/api/`)

Hono API server on port 4242 (local dev). Uses `@hono/node-server` for local development; deploys as Vercel Functions in production with zero config (Hono auto-detects the runtime).

- `GET /health` — Health check endpoint returning `{ ok, service, timestamp }`
- `GET /` — Service info returning `{ name, version }`

### App (`apps/app/`)

React 19 + Vite 6 + Tailwind CSS 4 SPA on port 3000. This will become the Loop dashboard (app.looped.me).

- Path alias: `@/*` maps to `./src/*`
- Build: `vite build` outputs to `dist/`

### Web (`apps/web/`)

Next.js 16 marketing site with Fumadocs for documentation. Serves the public-facing site at www.looped.me.

- `docs/` directory contains MDX content rendered at `/docs/*`
- Deployed to Vercel

## Path Aliases

- `@/*` -> `./src/*` (within each app, scoped to that app's source)

Configured in each app's `tsconfig.json` (for IDE/tsc) and `vite.config.ts` (for bundling).

## Testing

Tests use Vitest. The `vitest.workspace.ts` at the repo root configures test projects for `apps/api` and `apps/app`.

Tests live alongside source in `__tests__/` directories within each app.

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
