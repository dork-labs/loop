# Research: Repurposing a Turborepo Monorepo (DorkOS → Loop)

**Date**: 2026-02-18
**Feature Slug**: repo-cleanup-loop-setup
**Research Depth**: Deep
**Sources Found**: 20+ authoritative sources

---

## Research Summary

Repurposing a Turborepo monorepo is a well-understood process involving surgical removal of unwanted apps/packages, namespace renaming via find-and-replace, and reconfiguring Vercel deployments. The most important strategic decision for Loop is the API framework choice: **Hono is strongly recommended over Express** for a new Vercel-hosted backend due to zero-config deployment, native Fluid Compute support, superior TypeScript ergonomics, and first-class serverless architecture. The marketing site (Next.js → www.looped.me) and app (Hono + React → app.looped.me) can each be linked as separate Vercel projects from the same monorepo, with Vercel's automatic "skip unaffected projects" feature eliminating unnecessary rebuilds.

---

## Key Findings

### 1. Turborepo Package Removal
The process is simple but requires discipline:
- Delete the package/app directory
- Remove references from all `package.json` dependencies
- Remove the package from `turbo.json` pipeline task overrides
- Run `npm install` to update the lockfile
- Turborepo has no special "remove" command — it infers workspace membership from the package manager lockfile

### 2. Hono is the Clear Winner Over Express for Vercel
- Hono deploys with **zero configuration** on Vercel
- Routes automatically become **Vercel Functions with Fluid Compute** enabled by default (since April 2025)
- Express requires wrapping in serverless handlers and `vercel.json` rewrites
- Hono has native TypeScript support with no `@types/*` packages needed
- Fluid Compute gives Hono Vercel deployments: 300s default max duration, in-function concurrency, bytecode caching, and cross-region failover

### 3. Vercel Serverless Has Hard Limitations for Stateful APIs
- **WebSockets are not supported** on Vercel Functions (even with Fluid Compute)
- **SSE connections** work but are limited to 300s (5 min) on Hobby, 800s (13 min) on Pro
- Persistent DB connections require connection pooling (PgBouncer / Neon's serverless driver)
- For SSE-heavy APIs (like DorkOS's current architecture), Vercel is viable on Pro tier but not ideal

### 4. Two Vercel Projects From One Monorepo
Vercel natively supports multiple projects per repository. Each project gets its own Root Directory setting. The "skip unaffected projects" feature (powered by workspace dependency graph analysis) automatically avoids rebuilding unchanged apps.

### 5. Package Renaming Strategy
There is no automated Turborepo/npm command for namespace renaming. The approach is:
1. Update `name` field in each `package.json`
2. Global find-and-replace `@dorkos/` → `@loop/` across all source files and config files
3. Run `npm install` to regenerate the lockfile

---

## Detailed Analysis

### Topic 1: Turborepo Workspace Package Removal

**Official process** (confirmed by Turborepo maintainer `anthonyshew` in Discussion #5894):

```
1. Delete the directory (apps/<name> or packages/<name>)
2. Remove from any other package.json `dependencies` / `devDependencies`
3. Remove workspace-specific turbo.json pipeline overrides (e.g., "web#build")
4. Run `npm install` to update package-lock.json
5. Optionally remove the package from turbo.json `globalDependencies` if referenced
```

**What does NOT need manual cleanup**:
- The root `package.json` `workspaces` array uses a glob (`apps/*`, `packages/*`) so individual entries don't need to be removed — Turborepo discovers packages automatically from directories
- Turborepo caches are keyed by content hash; removing a package naturally removes its cache entries

**What DOES need manual cleanup in turbo.json**:
```json
// REMOVE app-specific pipeline overrides like:
{
  "tasks": {
    "web#build": { ... },       // remove if web app is deleted
    "server#dev": { ... }       // remove if server app is deleted
  }
}
```

**For the DorkOS → Loop migration**, the following should be removed:
- `apps/obsidian-plugin` — DorkOS-specific
- `apps/server` (the DorkOS Express server) — replace with Loop API
- `apps/client` (the DorkOS React SPA) — replace with Loop app
- `packages/cli` — DorkOS-specific npm package
- `packages/test-utils` — can be kept or renamed

**Keep and repurpose**:
- `apps/web` (Next.js marketing site) — rename/rebrand for Loop
- `apps/roadmap` — may be useful for Loop project management
- `packages/shared` — repurpose for Loop's Zod schemas and shared types
- `packages/typescript-config` — keep as-is, it's generic

---

### Topic 2: Express vs Hono for the Loop API

#### Hono on Vercel (Recommended)

Vercel has first-class Hono support with official docs and zero-config detection:

**How it works**:
- Create `src/index.ts` (or `server.ts`, `app.ts`, etc.) that exports a Hono app as default export
- Vercel auto-detects it and deploys all routes as Vercel Functions
- Fluid Compute is enabled by default (as of April 23, 2025)

```typescript
// apps/api/src/index.ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

app.use('*', cors())
app.get('/health', (c) => c.json({ status: 'ok' }))

export default app
```

No `vercel.json` needed. No adapter needed. Just `export default app`.

**Hono advantages over Express for this use case**:
| Feature | Hono | Express |
|---|---|---|
| Vercel zero-config | Yes | No (needs vercel.json + handler wrapper) |
| Fluid Compute native | Yes (automatic) | Partial (requires workaround) |
| TypeScript native | Yes | No (needs @types/express) |
| Web Standards (Request/Response) | Yes | No |
| Bundle size | ~14KB | ~57KB |
| Middleware ecosystem | Growing fast | Mature |
| SSE streaming | Yes (native) | Yes (but adapter quirks) |

**Express on Vercel (not recommended for new projects)**:
- Requires wrapping in a serverless handler: `module.exports = app`
- Needs `vercel.json` with routes configuration
- Cold starts are slower due to larger bundle size
- No native Fluid Compute support

#### Critical Limitation: SSE and Persistent Connections

The current DorkOS architecture relies heavily on SSE (Server-Sent Events) for streaming. On Vercel:
- SSE is supported but connections time out at 300s (Hobby) / 800s (Pro)
- WebSockets are **not supported** on any Vercel plan
- Persistent DB connections require a pooler (Neon serverless, PgBouncer, etc.)

**Recommendation for Loop**: If Loop requires long-lived SSE connections (e.g., streaming agent output to the browser), evaluate:
1. **Vercel Pro** (800s limit) — viable for most agent runs
2. **Railway** — no cold starts, persistent containers, true WebSocket support
3. **Hybrid**: Host the Hono API on Railway/Render, keep Next.js marketing site on Vercel

For the MVP without long streaming sessions, **Vercel + Hono** is fine.

#### Hono + Drizzle + PostgreSQL Setup

Several production-ready starters exist:
- [Hono-Postgres-Template](https://github.com/RajMazumder18110/Hono-Postgres-Template) — Hono + TypeScript + Drizzle + PostgreSQL
- [hono-drizzle-sql](https://github.com/itsMinar/hono-drizzle-sql) — serverless Node.js version
- [turbo-drizzle](https://github.com/htsh-tsyk/turbo-drizzle) — Turborepo + Drizzle (shadcn/ui preconfigured)

**Recommended stack for apps/api**:
```
Hono (framework)
├── @hono/node-server (local dev adapter)
├── drizzle-orm (ORM)
├── drizzle-kit (migrations)
├── @neondatabase/serverless (or postgres.js for non-serverless)
└── zod (validation, share schemas with @loop/shared)
```

For **Vercel Postgres (Neon)**: use `@neondatabase/serverless` with `ws` for WebSocket transport in Node.js environments (needed for Vercel's serverless edge).

```typescript
// apps/api/src/db/index.ts
import { drizzle } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)
export const db = drizzle(sql)
```

---

### Topic 3: Two Vercel Projects From One Monorepo

**Architecture**: One GitHub repo → two Vercel projects

| Vercel Project | Root Directory | Domain |
|---|---|---|
| `loop-web` | `apps/web` | www.looped.me |
| `loop-app` | `apps/app` (or `apps/api` + `apps/client`) | app.looped.me |

**Setup process**:
1. In Vercel Dashboard → "Add New Project" → Import the same GitHub repo twice
2. On first import: set Root Directory to `apps/web`, assign to `www.looped.me`
3. On second import: set Root Directory to `apps/app`, assign to `app.looped.me`
4. Each project gets independent env vars, build commands, and deployment history

**Automatic "skip unaffected projects"** (Vercel native feature):
- Vercel automatically detects which workspace packages changed
- If you push a commit that only touches `apps/web`, the `loop-app` project is skipped
- Requirements: npm/yarn/pnpm workspaces, unique `name` in each `package.json`, explicit `dependencies` declared between packages
- This feature does NOT count against concurrent build slots (unlike turbo-ignore)

**turbo-ignore (optional, more granular)**:
```
# In each Vercel project's "Ignored Build Step" field:
npx turbo-ignore --fallback=HEAD^1
```
This uses Turborepo's dependency graph for smarter skip decisions. The `--fallback=HEAD^1` ensures the first commit on a new branch always deploys.

**Turborepo build command in Vercel** (set in each project's Build Settings):
```bash
# Vercel auto-infers this when Root Directory is set, but can be explicit:
turbo build
```
Vercel has global `turbo` available and auto-infers `--filter=<workspace>` from the Root Directory setting.

**Related Projects** (preview URL linking):
For preview deployments where `apps/app` needs to call a preview API URL, use `vercel.json` `relatedProjects`:
```json
// apps/app/vercel.json
{
  "relatedProjects": ["prj_<loop-api-project-id>"]
}
```
This makes the preview API URL available as `VERCEL_RELATED_PROJECTS` env var automatically.

---

### Topic 4: Renaming @dorkos/* to @loop/*

There is no `turbo rename` or `npm rename` command. This is a manual process:

**Step-by-step**:

1. **Update package names** in each `package.json`:
```json
// packages/shared/package.json
{
  "name": "@loop/shared"   // was: "@dorkos/shared"
}
```

2. **Global find-and-replace** across all `.ts`, `.tsx`, `.json`, `.md` files:
```bash
# Using ripgrep + sed (or use your editor's global find-replace):
grep -r "@dorkos/" . --include="*.ts" --include="*.tsx" --include="*.json" -l
# Then replace in each file
```
Or use VSCode's global search-and-replace: `@dorkos/` → `@loop/`

3. **Update tsconfig.json path aliases** in each app:
```json
// apps/app/tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@loop/shared": ["../../packages/shared/src"]
    }
  }
}
```

4. **Regenerate lockfile**:
```bash
rm package-lock.json
npm install
```

5. **Key files to check** beyond source code:
- `turbo.json` (if package names appear in pipeline task names like `"@dorkos/shared#build"`)
- `.claude/` directory and agent configuration
- `README.md`, `CLAUDE.md`, `docs/` directory
- CI/CD configuration files (`.github/workflows/`)
- Any published npm package references

**Naming convention decision**:
- Option A: `@loop/shared`, `@loop/typescript-config` (scoped npm-style)
- Option B: `@looped/shared` (matching domain `looped.me`)
- Option C: Unscoped internal names like `shared`, `ui` (simpler, no scope needed for private monorepo packages)

**Recommendation**: Since these packages won't be published to npm (private monorepo), use **unscoped names or a simple `@loop/` scope**. Unscoped is even simpler: `"name": "shared"` in `package.json`, imported as `shared` in other packages.

---

### Topic 5: Express/Hono API Deployment Decision Summary

**Decision tree**:

```
Does Loop need:
├── Long-lived SSE streams (> 5 minutes)?
│   ├── Yes → Use Railway or Render for the API
│   └── No → Vercel is fine
├── WebSocket connections?
│   ├── Yes → Cannot use Vercel, use Railway/Render
│   └── No → Vercel is fine
└── PostgreSQL with connection pooling?
    ├── Vercel Postgres (Neon) → use @neondatabase/serverless
    └── External PostgreSQL → use postgres.js + DATABASE_URL
```

**For Loop MVP (assuming Vercel)**:
- Framework: **Hono** (zero-config Vercel, TypeScript native, Fluid Compute)
- Database: **Neon PostgreSQL** (serverless-compatible, Vercel Postgres integration)
- ORM: **Drizzle** (as specified in the MVP brief)
- Auth: **Better Auth** or **Clerk** (both have Hono middleware)

**For Loop if long-running agent streaming is core**:
- Host API on **Railway** (persistent containers, no cold starts, WebSocket support)
- Keep Next.js marketing site on **Vercel** (still optimal for Next.js)
- Configure CORS between `api.looped.me` (Railway) and `app.looped.me` (Vercel)

---

## Recommended Migration Sequence

```
Phase 1: Cleanup (1-2 days)
├── Delete apps/obsidian-plugin
├── Delete apps/server (DorkOS Express server)
├── Delete apps/client (DorkOS React SPA)
├── Delete packages/cli
├── Run npm install to clean lockfile
└── Remove orphaned turbo.json pipeline entries

Phase 2: Rename (2-4 hours)
├── Update package names: @dorkos/* → @loop/*
├── Global find-replace all import references
├── Update tsconfig.json path aliases in all apps
└── Run npm install + typecheck to verify

Phase 3: Scaffold Loop Apps (1-3 days)
├── apps/api: Hono + Drizzle + PostgreSQL starter
│   ├── src/index.ts (Hono app, default export)
│   ├── src/db/schema.ts (Drizzle schema)
│   └── src/db/migrations/
├── apps/app: React 19 + Vite + Tailwind + shadcn/ui SPA
│   └── (can mirror existing FSD architecture)
└── Keep apps/web: rebrand Next.js marketing site for Loop/looped.me

Phase 4: Vercel Setup (2-4 hours)
├── Create Vercel project "loop-web" → Root: apps/web → www.looped.me
├── Create Vercel project "loop-app" → Root: apps/app → app.looped.me
├── Configure env vars per project
└── Verify skip-unaffected-projects behavior
```

---

## Research Gaps & Limitations

- **Drizzle migrations on Vercel**: Running `drizzle-kit migrate` as part of the build step on Vercel functions has nuances — typically migrations should be run in CI separately, not on each serverless function cold start. This needs a separate investigation.
- **Neon vs external PostgreSQL**: Neon is the natural choice for Vercel integration, but if Loop needs a specific PostgreSQL provider, the connection pooling setup differs.
- **Loop MVP feature requirements**: The specific need for SSE/WebSocket wasn't clarified in the research brief. If the Loop autonomous improvement engine streams agent output to users, this is a critical architectural decision point.
- **Hono Node.js adapter for local dev**: When running locally (non-Vercel), Hono needs `@hono/node-server` to run as a traditional Node.js server. This is different from production deployment but well-documented.

---

## Contradictions & Disputes

- **turbo-ignore vs Vercel native skip**: Vercel's native "skip unaffected projects" feature and `turbo-ignore` both exist for the same purpose. Vercel recommends the native feature as it doesn't consume concurrent build slots. The turbo-ignore approach via "Ignored Build Step" does count against build limits. **Prefer Vercel native unless you need custom skip logic.**
- **Express on Vercel**: Vercel's official docs say Express works with "zero configuration" but community sources make clear it requires a `vercel.json` with routes and an exported handler. "Zero config" appears to refer to Vercel detecting it as an API route, not that no configuration is needed. Hono is genuinely zero-config.
- **Hono maturity vs Express**: Express has a vastly larger ecosystem (npm downloads: billions vs. millions). For a new project targeting Vercel serverless, Hono wins. For an existing Express project being ported, the migration cost may outweigh benefits.

---

## Sources & Evidence

- [Proper way to remove workspace under apps/packages? - Turborepo Discussion #5894](https://github.com/vercel/turborepo/discussions/5894)
- [Structuring a repository - Turborepo Docs](https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository)
- [Using Monorepos - Vercel Docs](https://vercel.com/docs/monorepos)
- [Deploying Turborepo to Vercel](https://vercel.com/docs/monorepos/turborepo)
- [Hono on Vercel - Official Docs](https://vercel.com/docs/frameworks/backend/hono)
- [Hono Getting Started: Vercel](https://hono.dev/docs/getting-started/vercel)
- [Deploy Hono backends with zero configuration - Vercel Changelog](https://vercel.com/changelog/deploy-hono-backends-with-zero-configuration)
- [Express on Vercel - Vercel Docs](https://vercel.com/docs/frameworks/backend/express)
- [Using Express.js with Vercel - Knowledge Base](https://vercel.com/kb/guide/using-express-with-vercel)
- [Fluid Compute - Vercel Docs](https://vercel.com/docs/fluid-compute)
- [Hono.js vs Express.js in 2025](https://khmercoder.com/@stoic/articles/25847997)
- [Vercel WebSockets Support - Knowledge Base](https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections)
- [Vercel vs Railway vs Render: AI Applications in 2026](https://getathenic.com/blog/vercel-vs-railway-vs-render-ai-deployment)
- [Can you use Vercel for backend? Limitations](https://northflank.com/blog/vercel-backend-limitations)
- [Quick Tip: Deploy only modified Vercel projects in a Turborepo monorepo](https://www.joostschuur.com/blog/quick-tip-deploy-only-modified-vercel-projects-in-a-turborepo-monorepo)
- [turbo-ignore - npm](https://www.npmjs.com/package/turbo-ignore)
- [Hono-Postgres-Template - GitHub](https://github.com/RajMazumder18110/Hono-Postgres-Template)
- [hono-drizzle-sql - GitHub](https://github.com/itsMinar/hono-drizzle-sql)
- [turbo-drizzle Turborepo starter - GitHub](https://github.com/htsh-tsyk/turbo-drizzle)
- [Drizzle with Neon Postgres - Neon Docs](https://neon.com/docs/guides/drizzle-migrations)
- [Drizzle with Vercel Postgres](https://orm.drizzle.team/docs/tutorials/drizzle-with-vercel)

---

## Search Methodology

- Searches performed: 12
- Most productive search terms: "Hono Vercel deployment zero-config", "Vercel multiple projects same monorepo", "turbo-ignore setup Vercel", "Turborepo remove workspace package"
- Primary information sources: vercel.com/docs, hono.dev, github.com/vercel/turborepo discussions, northflank.com (Vercel limitations analysis)
