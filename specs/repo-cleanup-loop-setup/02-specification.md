---
slug: repo-cleanup-loop-setup
number: 1
created: 2026-02-18
status: draft
---

# Specification: Repo Cleanup & Loop Setup

**Status:** Draft
**Author:** Claude Code
**Date:** 2026-02-18
**Ideation:** [01-ideation.md](./01-ideation.md)

---

## Overview

Repurpose the DorkOS monorepo for the Loop product. This is a cleanup and scaffolding task — no domain model, database, or business logic implementation. The goal is a clean, buildable, deployable monorepo with Loop branding, starter apps, and zero DorkOS references.

Loop is an autonomous improvement engine — a fully deterministic data product with a prompt layer. No AI inside Loop. It collects signals, organizes work into issues, and tells AI agents what to do next via hydrated prompt templates.

---

## Background / Problem Statement

This repo was copied from the DorkOS project (a web interface for Claude Code). Most DorkOS apps and packages have been deleted, but:

1. Empty directories, stale config references, and DorkOS branding remain everywhere
2. Build configs (turbo, eslint, vitest, tsconfig) reference deleted apps and will error or produce warnings
3. No Loop-specific apps exist yet — we need starter Hono API and React frontend apps
4. The marketing site (`apps/web`) still shows DorkOS content
5. The repo has no git history (`.git` was removed) and needs a fresh commit to a new GitHub repo

---

## Goals

- Remove all DorkOS-specific content, branding, and stale references
- Rename package namespace from `@dorkos/*` to `@loop/*`
- Create a minimal Hono API starter (`apps/api`) that deploys to Vercel
- Create a minimal React 19 + Vite starter (`apps/app`) for the Loop dashboard
- Update the Next.js marketing site with minimal Loop content
- Ensure `typecheck`, `build`, and `lint` all pass
- Initialize git and push to a new GitHub repo
- Prepare for Vercel deployment (two projects: `www.looped.me` and `app.looped.me`)

---

## Non-Goals

- Implementing Loop's domain model, database schema, or API endpoints
- Setting up PostgreSQL or Drizzle ORM (next spec)
- Building React dashboard views or UI features
- Creating a CLI tool
- Writing tests for the starter apps
- CI/CD pipeline setup beyond Vercel deployment
- Implementing authentication or authorization

---

## Technical Dependencies

| Dependency        | Version | Purpose                                  |
| ----------------- | ------- | ---------------------------------------- |
| Hono              | latest  | API framework for `apps/api`             |
| @hono/node-server | latest  | Local dev server for Hono                |
| React             | 19.x    | Frontend framework (already in repo)     |
| Vite              | 6.x     | Build tool for `apps/app`                |
| @tailwindcss/vite | 4.x     | Tailwind CSS integration for Vite        |
| Tailwind CSS      | 4.x     | Styling (already in repo)                |
| Next.js           | 16.x    | Marketing site (already in repo)         |
| Turborepo         | 2.x     | Monorepo orchestration (already in repo) |

---

## Detailed Design

### Phase 1: Delete & Clean

**Delete stale content:**

| Target                   | Action                                                                                                                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/` directory    | Already empty — delete the directory itself                                                                                                                             |
| `docs/` content          | Delete all `.mdx` files and subdirectories. Keep `meta.json` (Fumadocs needs it)                                                                                        |
| `contributing/` content  | Delete all `.md` files. Keep directory                                                                                                                                  |
| `decisions/` content     | Delete `TEMPLATE.md` and `archive/`. Keep `manifest.json` (already reset to nextNumber: 1)                                                                              |
| `research/` DorkOS files | Delete `mcp-tool-injection-patterns.md`, `20260218_roadmap-app-best-practices.md`. Keep `README.md`, `fumadocs-blog-research.md`, `20260218_repo-cleanup-loop-setup.md` |
| `scripts/`               | Delete `export-openapi.ts` and any DorkOS-specific scripts                                                                                                              |
| `blog/`                  | Delete if it contains DorkOS content                                                                                                                                    |

**Clear DorkOS environment config:**

`.env.example` — replace with Loop variables:

```bash
# Loop Environment Variables
# Copy this file to .env and fill in your values:
#   cp .env.example .env

# Database (PostgreSQL)
# DATABASE_URL=postgresql://user:pass@localhost:5432/loop

# API authentication
# LOOP_API_KEY=your-api-key-here

# PostHog analytics (optional)
# NEXT_PUBLIC_POSTHOG_KEY=your-posthog-key
# NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

### Phase 2: Rename & Rebrand

**Package renames:**

| File                    | Change                                                      |
| ----------------------- | ----------------------------------------------------------- |
| `package.json`          | `"name": "dorkos"` → `"name": "loop"`, `"version": "0.1.0"` |
| `apps/web/package.json` | `"name": "@dorkos/web"` → `"name": "@loop/web"`             |
| `VERSION`               | `0.3.0` → `0.1.0`                                           |

**Root `package.json` script updates:**

```json
{
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "test": "turbo test",
    "typecheck": "turbo typecheck",
    "lint": "turbo lint",
    "lint:fix": "turbo lint -- --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

Changes: Remove `dotenv --` prefix (not needed until we have env-dependent builds), remove `start` script (no server to start yet), remove `docs:export-api` (no OpenAPI spec yet).

**Global find-and-replace:** `@dorkos/` → `@loop/` across all `.ts`, `.tsx`, `.json`, and config files.

**README.md** — minimal Loop branding:

```markdown
# Loop

The Autonomous Improvement Engine.

An open-source data layer and prompt engine that collects signals, organizes work
into issues, and tells AI agents exactly what to do next.

## Tech Stack

- **API:** Hono (TypeScript)
- **Database:** PostgreSQL + Drizzle ORM
- **Frontend:** React 19 + Vite + Tailwind CSS + shadcn/ui
- **Marketing:** Next.js 16 + Fumadocs
- **Monorepo:** Turborepo

## Getting Started

npm install
npm run dev

## Structure

apps/
api/ # Hono API (app.looped.me)
app/ # React dashboard (app.looped.me)
web/ # Marketing site (www.looped.me)
```

**CLAUDE.md** — rewrite for Loop's architecture. Key sections:

- What This Is (Loop product description)
- Monorepo Structure (apps/api, apps/app, apps/web)
- Commands (dev, build, test, typecheck, lint)
- Tech stack references
- Remove all DorkOS service descriptions, transport interface details, session architecture, etc.

### Phase 3: Config Cleanup

**`turbo.json`:**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "dependsOn": ["^build"],
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"],
      "cache": true
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "cache": true
    },
    "lint": {
      "dependsOn": ["^build"],
      "cache": true
    }
  }
}
```

Changes: Remove `generate:api-docs` dependency, remove `dist-server/**` and `dist-obsidian/**` outputs, remove DorkOS env vars from `build.env`, remove `pack` and `test:watch` tasks.

**`eslint.config.js`:**

- Update React rules file glob from `apps/client/src/**/*` and `apps/obsidian-plugin/src/**/*` to `apps/app/src/**/*.{ts,tsx}` (lines 87)
- Update FSD layer enforcement globs from `apps/client/src/layers/` to `apps/app/src/layers/` (lines 131, 157, 181)
- Remove `dist-obsidian/**` from ignores

**`vitest.workspace.ts`:**

```typescript
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace(['apps/api', 'apps/app']);
```

**`tsconfig.json` (root):**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "references": [{ "path": "./apps/api" }, { "path": "./apps/app" }, { "path": "./apps/web" }],
  "exclude": ["node_modules"]
}
```

**`package-lock.json`:** Delete and regenerate via `npm install`.

### Phase 4: Create Starter Apps

#### `apps/api/` — Hono API

**File structure:**

```
apps/api/
├── package.json
├── tsconfig.json
└── src/
    └── index.ts
```

**`apps/api/package.json`:**

```json
{
  "name": "@loop/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node --watch --experimental-strip-types src/index.ts",
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "lint": "eslint ."
  },
  "dependencies": {
    "hono": "^4"
  },
  "devDependencies": {
    "@hono/node-server": "^1",
    "@types/node": "^20",
    "typescript": "^5"
  }
}
```

Note: For local dev, we use `@hono/node-server`. On Vercel, Hono auto-detects and deploys as Vercel Functions with zero config.

**`apps/api/src/index.ts`:**

```typescript
import { Hono } from 'hono';
import { serve } from '@hono/node-server';

const app = new Hono();

app.get('/health', (c) => {
  return c.json({ ok: true, service: 'loop-api', timestamp: new Date().toISOString() });
});

app.get('/', (c) => {
  return c.json({ name: 'Loop API', version: '0.1.0' });
});

// Local dev server (Vercel uses the default export)
if (process.env.NODE_ENV !== 'production') {
  const port = parseInt(process.env.PORT || '4242', 10);
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`Loop API running at http://localhost:${info.port}`);
  });
}

export default app;
```

**`apps/api/tsconfig.json`:**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

#### `apps/app/` — React 19 + Vite

**File structure:**

```
apps/app/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
└── src/
    ├── main.tsx
    ├── App.tsx
    └── index.css
```

**`apps/app/package.json`:**

```json
{
  "name": "@loop/app",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --port 3000",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "lint": "eslint ."
  },
  "dependencies": {
    "react": "^19",
    "react-dom": "^19"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@vitejs/plugin-react": "^4",
    "tailwindcss": "^4",
    "typescript": "^5",
    "vite": "^6"
  }
}
```

**`apps/app/vite.config.ts`:**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

**`apps/app/index.html`:**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Loop</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**`apps/app/src/main.tsx`:**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

**`apps/app/src/App.tsx`:**

```tsx
export function App() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 text-white">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">Loop</h1>
        <p className="mt-2 text-neutral-400">The Autonomous Improvement Engine</p>
      </div>
    </div>
  );
}
```

**`apps/app/src/index.css`:**

```css
@import 'tailwindcss';
```

**`apps/app/tsconfig.json`:**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "jsx": "react-jsx",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

### Phase 5: Update Marketing Site

**`apps/web/src/app/(marketing)/page.tsx`** — Replace with minimal Loop content:

```tsx
export default function HomePage() {
  return (
    <main className="flex min-h-[80vh] flex-col items-center justify-center px-4">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">Loop</h1>
        <p className="text-muted-foreground mt-4 text-xl">The Autonomous Improvement Engine</p>
        <p className="text-muted-foreground/80 mt-6 text-lg">
          An open-source data layer and prompt engine that collects signals, organizes work into
          issues, and tells AI agents exactly what to do next.
        </p>
        <p className="text-muted-foreground/60 mt-8 text-sm">Coming Soon</p>
      </div>
    </main>
  );
}
```

**`apps/web/src/app/layout.tsx`** — Update metadata:

- `title`: "Loop — The Autonomous Improvement Engine"
- `description`: "An open-source data layer and prompt engine that closes the feedback loop for AI-powered development."
- Update any DorkOS references in the layout

**Other web app updates:**

- Delete `apps/web/.vercel/project.json` (create fresh Vercel project)
- Clear blog content if DorkOS-specific
- Update `apps/web/src/app/robots.ts` and `sitemap.ts` to reference `looped.me`
- Update OG image generation if it references DorkOS

### Phase 6: .claude/ Audit (Collaborative)

This phase is interactive — we review `.claude/` contents with the user and ask before removing items. Areas to review:

- **`.claude/agents/`** — Check for DorkOS-specific agent definitions
- **`.claude/commands/`** — Check for DorkOS-specific slash commands (e.g., roadmap-related)
- **`.claude/rules/`** — Review FSD, testing, code-quality, documentation rules for DorkOS references
- **`.claude/skills/`** — Check for DorkOS-specific skills
- **`.claude/hooks/`** — Check for DorkOS-specific hooks
- **`.claude/scripts/`** — Check for DorkOS-specific scripts

### Phase 7: Verify & Ship

1. `rm -rf node_modules package-lock.json && npm install`
2. `npm run typecheck` — fix any TypeScript errors
3. `npm run build` — verify all apps build successfully
4. `npm run lint` — fix any lint errors
5. `git init && git add . && git commit -m "feat: initial Loop repo setup"`
6. Create new GitHub repo (e.g., `dork-labs/loop` or user's preference)
7. `git remote add origin <url> && git push -u origin main`
8. Set up Vercel projects:
   - `loop-web`: Root directory `apps/web`, domain `www.looped.me`
   - `loop-app`: Root directory `apps/app`, domain `app.looped.me`

---

## User Experience

After this spec is implemented:

- `npm run dev` starts all three apps in parallel (Hono API on :4242, React app on :3000, Next.js site on :3001)
- Visiting `localhost:4242/health` returns `{ ok: true, service: 'loop-api' }`
- Visiting `localhost:3000` shows a minimal "Loop — The Autonomous Improvement Engine" page
- Visiting `localhost:3001` shows the Loop marketing site with hero + coming soon
- All three apps build for production without errors

---

## Testing Strategy

**This spec explicitly defers testing.** The starter apps are minimal scaffolding. Tests will be added as domain logic is implemented in subsequent specs.

**Verification is manual:**

- `npm run typecheck` passes
- `npm run build` succeeds for all apps
- `npm run lint` passes
- Each app starts and responds correctly in dev mode

---

## Performance Considerations

No performance concerns — this is scaffolding. The starter apps are minimal and serve static content.

---

## Security Considerations

- `.env` is gitignored — no secrets will be committed
- `.env.example` contains only placeholder values
- No authentication is implemented (deferred to domain model spec)
- API key placeholder is documented but not enforced

---

## Documentation

- `README.md` — Rewritten with Loop branding and getting started
- `CLAUDE.md` — Rewritten for Loop architecture
- `.env.example` — Updated with Loop variables
- `contributing/` — Cleared (will be recreated as Loop features are built)
- `docs/` — Cleared (will be recreated with Loop documentation)

---

## Implementation Phases

### Phase 1: Delete & Clean (no dependencies)

Delete stale content, empty directories, DorkOS-specific files. Clear docs/, contributing/, research/.

### Phase 2: Rename & Rebrand (depends on Phase 1)

Update package names, README, CLAUDE.md, .env.example, VERSION.

### Phase 3: Config Cleanup (depends on Phase 2)

Fix turbo.json, eslint.config.js, vitest.workspace.ts, tsconfig.json. Regenerate lockfile.

### Phase 4: Create Starter Apps (depends on Phase 3)

Scaffold apps/api (Hono) and apps/app (React + Vite). Install dependencies.

### Phase 5: Update Marketing Site (can run parallel with Phase 4)

Update apps/web with Loop content, metadata, clean up DorkOS references.

### Phase 6: .claude/ Audit (can run parallel with Phases 4-5)

Interactive review with user. Ask before removing each item.

### Phase 7: Verify & Ship (depends on all previous phases)

Run typecheck, build, lint. Initialize git. Push to GitHub. Configure Vercel.

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 ──→ Phase 7
                                Phase 5 ──↗
                                Phase 6 ──↗
```

---

## Open Questions

None — all clarifications resolved during ideation.

---

## Related ADRs

No existing ADRs. This spec will generate draft ADRs for:

- Use Hono over Express for the Loop API
- Deploy as two Vercel projects from one monorepo

---

## References

- [Loop MVP Spec](../../meta/loop-mvp.md) — Full product specification
- [Loop Litepaper](../../meta/loop-litepaper.md) — Public product narrative
- [Ideation Document](./01-ideation.md) — Discovery and research findings
- [Research: Repo Cleanup](../../research/20260218_repo-cleanup-loop-setup.md) — Deployment and framework research
- [Hono on Vercel](https://vercel.com/docs/frameworks/backend/hono) — Zero-config deployment docs
- [Vercel Monorepos](https://vercel.com/docs/monorepos) — Multi-project deployment from one repo
- [Vercel Fluid Compute](https://vercel.com/docs/fluid-compute) — Serverless execution model
