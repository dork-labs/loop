# Tasks: Repo Cleanup & Loop Setup

**Spec:** [02-specification.md](./02-specification.md)
**Created:** 2026-02-19
**Total Tasks:** 13
**Phases:** 7

---

## Dependency Graph

```
P1-T1 ──→ P2-T1 ──→ P3-T1 ──→ P4-T1 ──→ P7-T1
P1-T2 ──↗ P2-T2 ──↗ P3-T2 ──↗ P4-T2 ──↗ P7-T2
           P2-T3             P5-T1 ──────↗
                             P5-T2 ──────↗
                             P6-T1 ──────↗
```

Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 7
Phase 5 → Phase 7
Phase 6 → Phase 7

Phases 4, 5, and 6 can run in parallel after Phase 3 completes.

---

## Phase 1: Delete & Clean

### Task P1-T1: Delete stale directories and files

**Subject:** `[repo-cleanup-loop-setup] [P1] Delete stale directories, files, and DorkOS content`

**Status:** todo

**Description:**

Delete all stale content from the repo that references DorkOS or is no longer needed.

**Actions:**

1. **Delete `packages/` directory entirely** (already empty, remove the directory itself):

   ```bash
   rm -rf packages/
   ```

2. **Delete `docs/` content** — remove all `.mdx` files and subdirectories. Keep `meta.json` (Fumadocs needs it):

   ```bash
   find docs/ -name '*.mdx' -delete
   find docs/ -mindepth 1 -type d -exec rm -rf {} + 2>/dev/null || true
   # Verify meta.json still exists
   ```

3. **Delete `contributing/` content** — remove all `.md` files. Keep directory:

   ```bash
   find contributing/ -name '*.md' -delete
   ```

4. **Delete `decisions/` stale content** — remove `TEMPLATE.md` and `archive/`. Keep `manifest.json` (already reset to nextNumber: 1):

   ```bash
   rm -f decisions/TEMPLATE.md
   rm -rf decisions/archive/
   ```

5. **Delete DorkOS research files** — remove `mcp-tool-injection-patterns.md` and `20260218_roadmap-app-best-practices.md`. Keep `README.md`, `fumadocs-blog-research.md`, `20260218_repo-cleanup-loop-setup.md`:

   ```bash
   rm -f research/mcp-tool-injection-patterns.md
   rm -f research/20260218_roadmap-app-best-practices.md
   ```

6. **Delete `scripts/`** — remove `export-openapi.ts` and any DorkOS-specific scripts:

   ```bash
   rm -f scripts/export-openapi.ts
   # Remove scripts/ dir if empty after deletion
   ```

7. **Delete `blog/`** if it contains DorkOS content:
   ```bash
   # Check contents first, then remove DorkOS-specific blog posts
   ```

**Verification:** No DorkOS-specific files remain in docs/, contributing/, decisions/, research/, or scripts/.

---

### Task P1-T2: Replace .env.example with Loop variables

**Subject:** `[repo-cleanup-loop-setup] [P1] Replace .env.example with Loop environment variables`

**Status:** todo

**Description:**

Replace the existing `.env.example` with Loop-specific environment variables.

**File: `.env.example`** — Replace entire contents with:

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

**Verification:** `.env.example` contains only Loop variables, no DorkOS references.

---

## Phase 2: Rename & Rebrand

**Blocked by:** P1-T1, P1-T2

### Task P2-T1: Rename packages and update root package.json

**Subject:** `[repo-cleanup-loop-setup] [P2] Rename packages from @dorkos to @loop and update root package.json`

**Status:** todo

**Description:**

Update all package names and the root package.json scripts.

**Changes:**

1. **`package.json` (root):**
   - `"name": "dorkos"` → `"name": "loop"`
   - `"version"` → `"0.1.0"`
   - Replace `"scripts"` with:
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
   - Remove `dotenv --` prefix from all scripts
   - Remove `start` script (no server to start yet)
   - Remove `docs:export-api` script (no OpenAPI spec yet)

2. **`apps/web/package.json`:**
   - `"name": "@dorkos/web"` → `"name": "@loop/web"`

3. **`VERSION` file:**
   - `0.3.0` → `0.1.0`

4. **Global find-and-replace:** `@dorkos/` → `@loop/` across all `.ts`, `.tsx`, `.json`, and config files.

**Verification:** `grep -r "@dorkos" .` returns zero results (excluding node_modules and .git).

---

### Task P2-T2: Rewrite README.md with Loop branding

**Subject:** `[repo-cleanup-loop-setup] [P2] Rewrite README.md with Loop branding`

**Status:** todo

**Description:**

Replace the entire `README.md` with minimal Loop branding.

**File: `README.md`** — Replace entire contents with:

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

**Verification:** README.md has no DorkOS references and describes Loop accurately.

---

### Task P2-T3: Rewrite CLAUDE.md for Loop architecture

**Subject:** `[repo-cleanup-loop-setup] [P2] Rewrite CLAUDE.md for Loop architecture`

**Status:** todo

**Description:**

Rewrite `CLAUDE.md` to describe Loop's architecture. Remove ALL DorkOS content — service descriptions, transport interface details, session architecture, Obsidian plugin, CLI package, etc.

**Key sections to include:**

- **What This Is** — Loop product description: autonomous improvement engine, data layer + prompt engine
- **Monorepo Structure** — `apps/api` (Hono), `apps/app` (React 19 + Vite), `apps/web` (Next.js 16 + Fumadocs)
- **Commands** — `npm run dev`, `npm run build`, `npm run test`, `npm run typecheck`, `npm run lint`
- **Tech Stack** — Hono, React 19, Vite 6, Tailwind CSS 4, Next.js 16, Turborepo, PostgreSQL + Drizzle (coming)
- **Apps:**
  - `apps/api` — Hono API on port 4242, health endpoint, Vercel Functions deployment
  - `apps/app` — React 19 + Vite + Tailwind CSS SPA on port 3000
  - `apps/web` — Next.js 16 marketing site + Fumadocs documentation
- **Testing** — Vitest, workspace config for apps/api and apps/app
- **Code Quality** — ESLint 9, Prettier, Tailwind plugin
- **Specifications** — `specs/` directory with manifest.json
- **Architecture Decision Records** — `decisions/` directory

**Remove completely:**

- All DorkOS service descriptions (agent-manager, transcript-reader, etc.)
- Transport interface, hexagonal architecture details
- Session architecture, SSE streaming protocol
- Obsidian plugin, CLI package details
- FSD layers table (will be recreated as app grows)
- Contributing guide references (contributing/ was cleared)

**Verification:** `grep -i "dorkos\|dork-os\|obsidian\|transport\|transcript\|agent-manager" CLAUDE.md` returns zero results.

---

## Phase 3: Config Cleanup

**Blocked by:** P2-T1, P2-T2, P2-T3

### Task P3-T1: Update turbo.json, eslint, vitest, and tsconfig

**Subject:** `[repo-cleanup-loop-setup] [P3] Update turbo.json, eslint.config.js, vitest.workspace.ts, and root tsconfig.json`

**Status:** todo

**Description:**

Update all build/lint/test configuration files to reference the new app structure.

**1. `turbo.json`** — Replace entire contents with:

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

Changes from current: Remove `generate:api-docs` dependency, remove `dist-server/**` and `dist-obsidian/**` outputs, remove DorkOS env vars from `build.env`, remove `pack` and `test:watch` tasks.

**2. `eslint.config.js`:**

- Update React rules file glob from `apps/client/src/**/*` and `apps/obsidian-plugin/src/**/*` to `apps/app/src/**/*.{ts,tsx}`
- Update FSD layer enforcement globs from `apps/client/src/layers/` to `apps/app/src/layers/`
- Remove `dist-obsidian/**` from ignores
- Remove any references to deleted apps/packages

**3. `vitest.workspace.ts`** — Replace entire contents with:

```typescript
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace(['apps/api', 'apps/app']);
```

**4. `tsconfig.json` (root)** — Replace entire contents with:

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

**Verification:** All four config files updated with no references to deleted apps.

---

### Task P3-T2: Delete and regenerate package-lock.json

**Subject:** `[repo-cleanup-loop-setup] [P3] Delete and regenerate package-lock.json`

**Status:** todo
**Blocked by:** P3-T1

**Description:**

After all config and package.json changes are complete, regenerate the lockfile.

```bash
rm -rf node_modules package-lock.json
npm install
```

**Verification:** `npm install` completes without errors. `package-lock.json` is regenerated with no references to deleted packages.

---

## Phase 4: Create Starter Apps

**Blocked by:** P3-T1, P3-T2

### Task P4-T1: Create apps/api Hono starter

**Subject:** `[repo-cleanup-loop-setup] [P4] Create apps/api Hono starter application`

**Status:** todo

**Description:**

Scaffold the Hono API starter application.

**File structure:**

```
apps/api/
├── package.json
├── tsconfig.json
└── src/
    └── index.ts
```

**File: `apps/api/package.json`:**

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

**File: `apps/api/src/index.ts`:**

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

**File: `apps/api/tsconfig.json`:**

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

**Post-scaffold:** Run `npm install` from repo root to install Hono dependencies.

**Verification:** `cd apps/api && npx tsc --noEmit` passes. `node --experimental-strip-types src/index.ts` starts and responds to `GET /health`.

---

### Task P4-T2: Create apps/app React 19 + Vite starter

**Subject:** `[repo-cleanup-loop-setup] [P4] Create apps/app React 19 + Vite starter application`

**Status:** todo

**Description:**

Scaffold the React 19 + Vite frontend starter application.

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

**File: `apps/app/package.json`:**

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

**File: `apps/app/vite.config.ts`:**

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

**File: `apps/app/index.html`:**

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

**File: `apps/app/src/main.tsx`:**

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

**File: `apps/app/src/App.tsx`:**

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

**File: `apps/app/src/index.css`:**

```css
@import 'tailwindcss';
```

**File: `apps/app/tsconfig.json`:**

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

**Post-scaffold:** Run `npm install` from repo root to install React/Vite dependencies.

**Verification:** `cd apps/app && npx tsc --noEmit` passes. `npx vite build` succeeds. `npx vite --port 3000` serves the app.

---

## Phase 5: Update Marketing Site

**Blocked by:** P3-T1, P3-T2 (can run parallel with Phase 4)

### Task P5-T1: Update marketing site homepage with Loop content

**Subject:** `[repo-cleanup-loop-setup] [P5] Update apps/web homepage with Loop content`

**Status:** todo

**Description:**

Replace DorkOS marketing content with minimal Loop branding.

**File: `apps/web/src/app/(marketing)/page.tsx`** — Replace entire contents with:

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

**Verification:** No DorkOS references in the homepage. Page renders correctly.

---

### Task P5-T2: Update web app metadata, layout, and cleanup DorkOS references

**Subject:** `[repo-cleanup-loop-setup] [P5] Update web app layout metadata and clean up DorkOS references`

**Status:** todo

**Description:**

Update metadata and clean up remaining DorkOS references in the marketing site.

**1. `apps/web/src/app/layout.tsx`** — Update metadata:

- `title`: `"Loop — The Autonomous Improvement Engine"`
- `description`: `"An open-source data layer and prompt engine that closes the feedback loop for AI-powered development."`
- Update any DorkOS references in the layout component

**2. Delete `apps/web/.vercel/project.json`** — Create fresh Vercel project:

```bash
rm -rf apps/web/.vercel/
```

**3. Clear blog content** if DorkOS-specific — check `apps/web/src/app/(marketing)/blog/` for DorkOS posts.

**4. Update `apps/web/src/app/robots.ts`** — Reference `looped.me`:

```typescript
// Update sitemap URL to https://www.looped.me/sitemap.xml
```

**5. Update `apps/web/src/app/sitemap.ts`** — Reference `looped.me`:

```typescript
// Update base URL to https://www.looped.me
```

**6. Update OG image generation** — If it references DorkOS, update to Loop branding.

**7. Search all files in `apps/web/` for remaining DorkOS references:**

```bash
grep -r "dorkos\|DorkOS\|dork-os\|Dork" apps/web/ --include='*.ts' --include='*.tsx' --include='*.json' --include='*.mdx'
```

**Verification:** `grep -ri "dorkos\|dork" apps/web/` returns zero results (excluding node_modules).

---

## Phase 6: .claude/ Audit

**Blocked by:** P3-T1, P3-T2 (can run parallel with Phases 4-5)

### Task P6-T1: Audit .claude/ directory for DorkOS-specific content

**Subject:** `[repo-cleanup-loop-setup] [P6] Audit .claude/ directory for DorkOS-specific content`

**Status:** todo
**Requires user input:** yes

**Description:**

This task is interactive — review `.claude/` contents and ask the user before removing items.

**Areas to review:**

1. **`.claude/agents/`** — Check for DorkOS-specific agent definitions. List them and ask user which to keep.

2. **`.claude/commands/`** — Check for DorkOS-specific slash commands (e.g., roadmap-related, obsidian-related). List them and ask user which to keep.

3. **`.claude/rules/`** — Review FSD, testing, code-quality, documentation rules for DorkOS references. Suggest updates:
   - `fsd-layers.md` — Update app paths from `apps/client/` to `apps/app/`
   - `testing.md` — Update test patterns for new app structure
   - `code-quality.md` — Remove DorkOS-specific rules
   - `documentation.md` — Update for Loop
   - `file-size.md` — Generic, likely keep as-is

4. **`.claude/skills/`** — Check for DorkOS-specific skills. List and ask user.

5. **`.claude/hooks/`** — Check for DorkOS-specific hooks (e.g., `typecheck-changed.sh`). Ask user.

6. **`.claude/scripts/`** — Check for DorkOS-specific scripts. Ask user.

**Process:** For each subdirectory, list all files, identify DorkOS-specific ones, present to user, and act on their decisions.

**Verification:** User has reviewed and approved all changes to `.claude/`.

---

## Phase 7: Verify & Ship

**Blocked by:** P4-T1, P4-T2, P5-T1, P5-T2, P6-T1

### Task P7-T1: Run typecheck, build, and lint verification

**Subject:** `[repo-cleanup-loop-setup] [P7] Run typecheck, build, and lint to verify clean repo`

**Status:** todo

**Description:**

Verify the entire repo builds and passes checks.

**Steps:**

1. Clean install:

   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

2. Type check all apps:

   ```bash
   npm run typecheck
   ```

   Fix any TypeScript errors that arise.

3. Build all apps:

   ```bash
   npm run build
   ```

   Verify all three apps (api, app, web) build successfully.

4. Lint all apps:
   ```bash
   npm run lint
   ```
   Fix any lint errors.

**Verification:**

- `npm run typecheck` exits 0
- `npm run build` exits 0
- `npm run lint` exits 0

---

### Task P7-T2: Initialize git and push to new GitHub repo

**Subject:** `[repo-cleanup-loop-setup] [P7] Initialize git repo and push to GitHub`

**Status:** todo
**Blocked by:** P7-T1
**Requires user input:** yes (for repo URL)

**Description:**

Initialize a fresh git repo and push to GitHub.

**Steps:**

1. Initialize git:

   ```bash
   git init
   git add .
   git commit -m "feat: initial Loop repo setup"
   ```

2. Create new GitHub repo (ask user for preference — e.g., `dork-labs/loop` or their org):

   ```bash
   # User provides the repo URL
   git remote add origin <url>
   git push -u origin main
   ```

3. Set up Vercel projects (document for user):
   - **`loop-web`**: Root directory `apps/web`, domain `www.looped.me`
   - **`loop-app`**: Root directory `apps/app`, domain `app.looped.me`

**Verification:**

- `git log` shows initial commit
- `git remote -v` shows the correct origin
- Push succeeds

---

## Summary

| Phase     | Tasks  | Parallel?                            | Description                               |
| --------- | ------ | ------------------------------------ | ----------------------------------------- |
| P1        | 2      | Yes (within phase)                   | Delete stale content, update .env.example |
| P2        | 3      | Yes (within phase)                   | Rename packages, README, CLAUDE.md        |
| P3        | 2      | Sequential (T2 after T1)             | Config files, regenerate lockfile         |
| P4        | 2      | Yes (within phase)                   | Create Hono API, React app                |
| P5        | 2      | Yes (within phase, parallel with P4) | Update marketing site                     |
| P6        | 1      | Parallel with P4/P5                  | Interactive .claude/ audit                |
| P7        | 2      | Sequential (T2 after T1)             | Verify builds, git init + push            |
| **Total** | **14** |                                      |                                           |

### Parallel Execution Opportunities

1. **P1-T1 and P1-T2** can run simultaneously
2. **P2-T1, P2-T2, P2-T3** can run simultaneously (after P1)
3. **P4-T1, P4-T2, P5-T1, P5-T2, P6-T1** can all run simultaneously (after P3)
4. **P7-T1** runs after all above complete
5. **P7-T2** runs after P7-T1

### Tasks Requiring User Input

- **P6-T1**: .claude/ audit — needs user decisions on what to keep/remove
- **P7-T2**: Git push — needs user to provide GitHub repo URL
