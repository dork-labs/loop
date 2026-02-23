---
slug: docs-update-post-mvp
number: 6
created: 2026-02-20
status: ideation
---

# Update Documentation Post-MVP

**Slug:** docs-update-post-mvp
**Author:** Claude Code
**Date:** 2026-02-20
**Related:** N/A

---

## 1) Intent & Assumptions

- **Task brief:** Update the documentation pages in `apps/web/` (Fumadocs/MDX) to cover the completed Loop MVP. All 4 phases are built — API, prompt engine, React dashboard, CLI — but the docs are essentially empty (a single placeholder page). We need comprehensive developer documentation so people can actually use Loop.
- **Assumptions:**
  - Fumadocs is already configured and working (confirmed: fumadocs v16.6 + fumadocs-openapi + fumadocs-mdx)
  - MDX content lives in root `docs/` directory, served at `/docs/*`
  - `docs/meta.json` already defines planned sections (getting-started, guides, concepts, integrations, api, self-hosting, contributing, changelog)
  - `fumadocs-openapi` is configured and `APIPage` component exists — just needs an OpenAPI spec file
  - Auto-generation script exists at `apps/web/scripts/generate-api-docs.ts`
  - Marketing homepage is a separate effort (out of scope)
- **Out of scope:**
  - Marketing homepage redesign
  - Blog posts or changelog entries
  - Video tutorials or interactive demos
  - OpenAPI spec generation from Hono routes (could be a follow-up)

## 2) Pre-reading Log

- `docs/index.mdx`: Single placeholder page ("Documentation coming soon")
- `docs/meta.json`: Manifest with 8 planned sections, none created yet
- `apps/web/next.config.ts`: Fumadocs MDX integration with Next.js 16, PostHog rewrites
- `apps/web/source.config.ts`: Source loader pointing to `../../docs` (root-level docs dir)
- `apps/web/src/lib/source.ts`: Fumadocs source wrapper with `/docs` base URL
- `apps/web/scripts/generate-api-docs.ts`: Reads OpenAPI spec, generates MDX via fumadocs-openapi
- `apps/web/package.json`: fumadocs-core@16.6.2, fumadocs-mdx@14.2.7, fumadocs-openapi@10.3.5, fumadocs-ui@16.6.2
- `apps/api/src/routes/*.ts`: 12 route files with ~40+ endpoints
- `apps/api/src/lib/prompt-engine.ts`: Template selection + Handlebars hydration
- `apps/api/src/lib/priority-scoring.ts`: EWMA-based priority scoring
- `apps/cli/src/commands/*.ts`: 13 CLI command files
- `apps/app/src/routes/_dashboard/`: 5 dashboard views
- `meta/loop-mvp.md`: Complete MVP specification with all features documented
- `meta/loop-litepaper.md`: Vision document explaining the "no AI" architecture
- `CLAUDE.md`: Comprehensive project reference with all endpoints, env vars, commands

## 3) Codebase Map

- **Primary components/modules:**
  - `docs/` — Documentation content root (nearly empty)
  - `docs/meta.json` — Fumadocs navigation manifest
  - `apps/web/` — Next.js 16 + Fumadocs documentation site
  - `apps/web/scripts/generate-api-docs.ts` — OpenAPI → MDX auto-generation
  - `apps/web/source.config.ts` — Fumadocs source configuration

- **Shared dependencies:**
  - `fumadocs-core@16.6.2` — Core Fumadocs library
  - `fumadocs-ui@16.6.2` — UI components (Callout, Steps, Tabs, Cards)
  - `fumadocs-mdx@14.2.7` — MDX processing
  - `fumadocs-openapi@10.3.5` — OpenAPI spec → MDX generation

- **Data flow:**
  MDX files in `docs/` → `source.config.ts` reads them → `fumadocs-mdx` processes → Next.js renders at `/docs/*`
  OpenAPI spec → `generate-api-docs.ts` → auto-generated MDX → rendered as API reference

- **Feature flags/config:**
  - `docs/meta.json` controls sidebar navigation order and section titles
  - Each subdirectory can have its own `meta.json` for subsection ordering

- **Potential blast radius:**
  - Direct: `docs/` directory (all new MDX files)
  - Indirect: `docs/meta.json` (navigation updates), possibly `apps/web/` layout files
  - No impact on API, dashboard, or CLI code

## 4) Root Cause Analysis

N/A — not a bug fix.

## 5) Research

### Potential Solutions

**1. Hand-write all documentation pages (MDX)**

- Description: Write every page manually as MDX, including API reference
- Pros:
  - Full control over content and presentation
  - Can tailor examples to Loop's specific use cases
  - No dependency on auto-generation tooling
- Cons:
  - API reference is tedious and error-prone to maintain
  - High effort (~35 pages estimated)
  - Drift risk as API evolves
- Complexity: High
- Maintenance: High

**2. Hybrid: Auto-generate API reference + hand-write everything else**

- Description: Generate an OpenAPI spec from Hono routes, use fumadocs-openapi to auto-generate API reference pages, hand-write conceptual docs, guides, CLI reference
- Pros:
  - API reference stays in sync with code
  - fumadocs-openapi already configured and ready
  - Interactive API playground comes free
  - Reduces manual work on the most tedious section
- Cons:
  - Need to create/maintain an OpenAPI spec (Hono has @hono/zod-openapi but we'd need to retrofit routes)
  - Auto-generated docs may need manual polish
- Complexity: Medium
- Maintenance: Low (API docs auto-update)

**3. Hand-write all docs now, add OpenAPI auto-generation later**

- Description: Write all docs manually for MVP, defer OpenAPI integration to a follow-up
- Pros:
  - Ship docs faster (no tooling setup)
  - Can still add auto-generation later
  - Gets docs out the door immediately
- Cons:
  - API reference will need rewriting when OpenAPI is added
  - Manual API docs will drift
- Complexity: Medium
- Maintenance: Medium (until auto-generation added)

### Recommendation

**Option 3: Hand-write all docs now, OpenAPI later.** The OpenAPI spec generation from existing Hono routes is a non-trivial retrofit (would need @hono/zod-openapi or manual spec authoring). Since we want docs shipped quickly and the API is stable post-MVP, hand-writing the API reference now and adding OpenAPI auto-generation as a follow-up is the fastest path.

### Documentation Structure (Diátaxis Framework)

Research recommends the Diátaxis framework (tutorials, how-to guides, reference, explanation) combined with Stripe/Vercel-style information architecture:

```
docs/
├── index.mdx                     # Welcome + quick links
├── meta.json                     # Top-level nav
├── getting-started/
│   ├── meta.json
│   ├── index.mdx                 # Overview + prerequisites
│   ├── quickstart.mdx            # 5-min: install → config → first signal
│   └── authentication.mdx        # API keys, webhook secrets
├── concepts/
│   ├── meta.json
│   ├── index.mdx                 # How Loop works (the loop diagram)
│   ├── issues.mdx                # Issue types, hierarchy, lifecycle
│   ├── signals.mdx               # Signal ingestion, sources, triage
│   ├── dispatch.mdx              # Template selection, hydration, dispatch
│   ├── prompts.mdx               # Templates, versions, reviews, EWMA
│   └── projects-and-goals.mdx    # Project grouping, goal tracking
├── guides/
│   ├── meta.json
│   ├── dashboard.mdx             # Dashboard tour, views, keyboard shortcuts
│   └── writing-templates.mdx     # Handlebars syntax, conditions, partials
├── integrations/
│   ├── meta.json
│   ├── index.mdx                 # Overview
│   ├── github.mdx                # GitHub webhook setup
│   ├── sentry.mdx                # Sentry webhook setup
│   └── posthog.mdx               # PostHog webhook setup
├── api/
│   ├── meta.json
│   ├── index.mdx                 # Base URL, auth, errors, pagination
│   ├── issues.mdx                # Issues endpoints
│   ├── projects.mdx              # Projects endpoints
│   ├── goals.mdx                 # Goals endpoints
│   ├── labels.mdx                # Labels endpoints
│   ├── comments.mdx              # Comments endpoints
│   ├── relations.mdx             # Relations endpoints
│   ├── signals.mdx               # Signals endpoints
│   ├── templates.mdx             # Templates + versions endpoints
│   ├── prompt-reviews.mdx        # Prompt reviews endpoints
│   ├── dispatch.mdx              # Dispatch endpoints
│   └── dashboard.mdx             # Dashboard endpoints
├── cli/
│   ├── meta.json
│   ├── index.mdx                 # Installation, config, global flags
│   ├── issues.mdx                # looped issues, show, create, comment
│   ├── signals.mdx               # looped signal
│   ├── triage.mdx                # looped triage
│   ├── templates.mdx             # looped templates
│   ├── dispatch.mdx              # looped next, looped dispatch
│   └── status.mdx                # looped status, projects, goals
├── self-hosting/
│   ├── meta.json
│   ├── index.mdx                 # Overview + requirements
│   ├── environment.mdx           # All env vars documented
│   └── deployment.mdx            # Vercel, Docker, manual deployment
└── contributing/
    ├── meta.json
    └── index.mdx                 # Dev setup, testing, architecture overview
```

**~35 pages total.** Priority order for writing:

1. Getting Started (3 pages) — unblocks all users
2. Concepts (6 pages) — explains the mental model
3. API Reference (12 pages) — enables integration
4. CLI Reference (7 pages) — enables CLI usage
5. Guides (2 pages) — dashboard + template authoring
6. Integrations (4 pages) — webhook setup
7. Self-Hosting (3 pages) — deployment
8. Contributing (1 page) — dev onboarding

### Fumadocs Features to Leverage

- **`<Steps>`** — For quickstart walkthroughs
- **`<Tabs>`** — For curl/JS/CLI examples side-by-side
- **`<Callout>`** — For warnings, tips, important notes
- **`<Card>`** and `<Cards>`\*\* — For section landing pages
- **Code blocks with title** — For named examples
- **`<TypeTable>`** — For request/response schemas

## 6) Clarification

1. **Scope: How many doc pages should we write in this phase?** The full structure has ~35 pages. Should we write all of them, or prioritize a subset (e.g., Getting Started + Concepts + API Reference = ~21 pages) and defer the rest?

2. **API Reference style:** Should we hand-write the API reference with curl examples and response schemas, or invest time now in creating an OpenAPI spec to auto-generate it? (Recommendation: hand-write now, OpenAPI later)

3. **CLI section:** The current `docs/meta.json` doesn't include a `cli` section. Should we add it? (Recommendation: yes, it's a key part of the MVP)

4. **Content depth:** For the API reference pages, should each endpoint have full curl examples + request/response JSON, or just a table of endpoints with parameter descriptions? (Recommendation: full examples — they're what developers actually use)

5. **Existing content source:** The `meta/loop-mvp.md` and `CLAUDE.md` already contain comprehensive API endpoint tables, env var docs, and feature descriptions. Should we use these as the primary source material for the docs? (Recommendation: yes, adapt and expand rather than write from scratch)
