---
slug: repo-cleanup-loop-setup
number: 1
created: 2026-02-18
status: ideation
---

# Repo Cleanup & Loop Setup

**Slug:** repo-cleanup-loop-setup
**Author:** Claude Code
**Date:** 2026-02-18
**Related:** N/A

---

## 1) Intent & Assumptions

- **Task brief:** Repurpose the DorkOS monorepo for the Loop product. Clean up DorkOS-specific code, remove unnecessary items and dependencies, update the marketing site with Loop content, set up starter Express/Hono API + React frontend, ensure no TypeScript errors, deploy to a new GitHub repo, and prepare for Vercel deployment at `www.looped.me` (marketing site) and `app.looped.me` (Loop app).

- **Assumptions:**
  - We keep the Turborepo monorepo structure, TypeScript configs, Tailwind/shadcn setup, and developer tooling
  - The marketing site (`apps/web`) stays as Next.js with Fumadocs
  - The Loop app API will use Hono (as specified in the MVP doc) rather than Express
  - PostgreSQL + Drizzle ORM for the database (per MVP spec)
  - We're building skeleton/starter apps, not implementing Loop's domain model yet
  - Package namespace changes from `@dorkos/*` to `@loop/*`
  - PostHog integration can stay in the marketing site (useful for Loop's analytics story)

- **Out of scope:**
  - Implementing Loop's domain model, database schema, API endpoints, or prompt system
  - Setting up PostgreSQL/Drizzle (that's the next spec)
  - Building the React dashboard views
  - CLI tool
  - Writing tests for the starters
  - CI/CD pipeline setup (beyond Vercel deployment)

---

## 2) Pre-reading Log

- `meta/loop-mvp.md`: Full MVP spec — Loop is a deterministic data product with a prompt layer. Hono API + PostgreSQL + Drizzle + React 19 + Vite + Tailwind + shadcn/ui. Pull-based dispatch, prompt templates, self-improving instruction system.
- `meta/loop-litepaper.md`: Public-facing product narrative. "Everything is an issue." Signal → Hypothesis → Plan → Task → Monitor loop. No AI inside Loop.
- `package.json` (root): Named "dorkos", workspaces `apps/*` + `packages/*`, dev deps include turbo, eslint, prettier
- `apps/web/package.json`: Named "@dorkos/web", Next.js 16 + React 19, Fumadocs, shadcn/ui, PostHog
- `turbo.json`: References deleted apps in output patterns
- `eslint.config.js`: Hard-coded paths to deleted `apps/client` and `apps/obsidian-plugin`
- `vitest.workspace.ts`: References deleted test suites
- `.env.example`: DorkOS-specific env vars (DORKOS_PORT, etc.)
- `apps/web/.vercel/project.json`: Tied to existing DorkOS Vercel project

---

## 3) Codebase Map

**Current State:** The repo has been partially cleaned. Only `apps/web` remains as a functioning app. All other apps and packages have been deleted but their directories exist as empty folders.

**Primary Components/Modules:**

- `apps/web/` — Next.js 16 marketing site with Fumadocs docs, blog, and marketing pages. All content is DorkOS-branded.
- `packages/` — Empty directories (cli/, shared/, test-utils/, typescript-config/)
- `docs/` — Full MDX documentation tree, all DorkOS-focused
- `contributing/` — Developer guides (architecture, design system, etc.), mostly DorkOS-specific
- `.claude/` — Agent commands, rules, skills, hooks — extensive automation infrastructure
- `specs/` — Spec framework with manifest.json
- `decisions/` — ADR framework with manifest.json
- `research/` — Research artifacts (some DorkOS-specific, some reusable)

**Shared Dependencies (Reusable):**

- Turborepo build orchestration
- ESLint 9 flat config + Prettier
- Tailwind CSS 4 + shadcn/ui (new-york style)
- TypeScript configs
- Vitest testing framework
- `.claude/` automation (agents, commands, rules, skills)

**DorkOS-Specific Items to Remove/Update:**

- All `@dorkos/*` package references
- `DORKOS_*` environment variables
- DorkOS branding in README, CLAUDE.md, .env.example
- Marketing site content (hero, features, docs)
- contributing/ guides referencing deleted apps (obsidian-plugin, roadmap, server, client)
- docs/ directory (all DorkOS user-facing docs)
- Empty package directories
- ESLint/turbo/vitest configs referencing deleted apps

**Potential Blast Radius:**

- Config changes (turbo, eslint, vitest) affect the entire build pipeline
- Package renaming touches every import statement
- Marketing site content is a full rewrite
- CLAUDE.md rewrite affects all future Claude Code sessions

---

## 4) Root Cause Analysis

N/A — not a bug fix.

---

## 5) Research

### Potential Solutions

**1. Hono on Vercel (Recommended for API)**

- Description: Use Hono framework for the Loop API, deployed as Vercel Functions with Fluid Compute
- Pros:
  - Zero-config deployment on Vercel — export default and it works
  - Native TypeScript, Web Standard Request/Response
  - ~14KB bundle vs Express's ~57KB
  - Fluid Compute gives in-function concurrency, bytecode caching, 5-min timeouts
  - Aligns with MVP spec's tech choice
- Cons:
  - No WebSocket support on Vercel (SSE works but times out at 300-800s)
  - If Loop needs long-running agent streams, may need Railway/Fly.io for API later
- Complexity: Low
- Maintenance: Low

**2. Express on Vercel**

- Description: Keep Express from DorkOS, deploy on Vercel
- Pros:
  - Familiar, large ecosystem
  - Existing patterns from DorkOS
- Cons:
  - Requires `vercel.json` routing config and handler wrapper
  - Larger bundle, older API design
  - MVP spec explicitly chose Hono
- Complexity: Low
- Maintenance: Medium

**3. Split Hosting: Vercel (marketing) + Railway (API)**

- Description: Marketing site on Vercel, API on Railway for persistent connections
- Pros:
  - True WebSocket/SSE support without timeouts
  - Persistent containers, no cold starts
  - Full server capabilities
- Cons:
  - More complex deployment setup
  - Two hosting providers to manage
  - Premature for a starter — can migrate later if needed
- Complexity: Medium
- Maintenance: Medium

### Deployment Architecture

Two Vercel projects from one monorepo:

| Project    | Root Directory | Domain          | Framework         |
| ---------- | -------------- | --------------- | ----------------- |
| `loop-web` | `apps/web`     | `www.looped.me` | Next.js 16        |
| `loop-app` | `apps/app`     | `app.looped.me` | Hono + Vite React |

Vercel's native "skip unaffected projects" avoids unnecessary rebuilds. Optional `turbo-ignore` for granular control.

### Package Renaming Strategy

No tooling automates `@dorkos/` → `@loop/` renaming. Manual process:

1. Update `name` in each `package.json`
2. Global find-and-replace across all source files
3. Update tsconfig paths
4. Regenerate lockfile

### Recommendation

**Use Hono on Vercel for the API starter.** It's the MVP spec's choice, deploys with zero config, and aligns with the modern serverless model. Start with both projects on Vercel. If persistent connections become a requirement later, migrate the API to Railway — that's a deployment config change, not a code change (Hono runs on any runtime).

---

## 6) Clarification

1. **Package namespace:** Should we use `@loop/*` (scoped) or unscoped names like `loop-shared`? Scoped requires an npm org if ever published. Since these are private packages, either works.

2. **App structure for Loop:** The MVP spec mentions Hono API + React frontend. Should these be:
   - `apps/api` (Hono) + `apps/app` (React/Vite) — separate apps, separate Vercel projects
   - `apps/app` (Hono serves React as static) — single app, one Vercel project
   - Recommendation: Separate `apps/api` + `apps/app` for clean separation

3. **Docs content:** Should we keep the `docs/` directory structure and clear it out for future Loop docs, or delete it entirely and recreate later?

4. **Contributing guides:** Keep the reusable ones (design-system, data-fetching, state-management, animations, styling-theming) and delete DorkOS-specific ones (obsidian-plugin-development, architecture [needs rewrite], autonomous-roadmap-execution)?

5. **Research directory:** Keep existing research files or clean slate? Some (fumadocs-blog-research) may be useful for the marketing site.

6. **`.claude/` infrastructure:** The agents, commands, rules, and skills are extensive. Should we audit and trim DorkOS-specific items, or keep everything and update incrementally?

7. **ADRs and specs:** Clear existing DorkOS decisions/specs, or archive them? The framework itself (manifest.json, commands) is valuable to keep.

8. **Marketing site content:** How much Loop content should we create now? Options:
   - Minimal: Hero + tagline + "Coming soon" — ship fast
   - Medium: Hero + features section + brief explanation — tells the story
   - Full: Hero + features + how it works + pricing — comprehensive but slower
