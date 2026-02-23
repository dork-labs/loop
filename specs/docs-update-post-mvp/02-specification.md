---
slug: docs-update-post-mvp
---

# Specification: Update Documentation Post-MVP

## 1. Status

Under Review

## 2. Authors

Claude Code — 2026-02-20

## 3. Overview

Write comprehensive developer documentation for Loop's completed MVP. The `docs/` directory currently contains a single placeholder page. This spec covers:

1. **OpenAPI spec generation** — Create an OpenAPI 3.1.0 registry using `@asteasolutions/zod-to-openapi` (replicating the DorkOS pattern), export to `docs/api/openapi.json`, and auto-generate API reference pages via the existing `fumadocs-openapi` pipeline.
2. **~35 MDX documentation pages** across 9 sections — Getting Started, Concepts, Guides, Integrations, API Reference (auto-generated), CLI Reference, Self-Hosting, Contributing, and Changelog.
3. **Navigation updates** — Add missing `cli` section to `docs/meta.json` and create `meta.json` files for all subsections.

Content is adapted from existing source material (`meta/loop-mvp.md`, `CLAUDE.md`, litepaper) and verified against the codebase. Pages are rich with examples following the Stripe/Linear documentation standard.

## 4. Background / Problem Statement

Loop's MVP is complete (4 phases: API, prompt engine, dashboard, CLI) but the documentation is a single placeholder page. Without docs, no one can:

- Integrate with Loop's API
- Set up webhook signal sources
- Use the CLI
- Understand the dispatch/prompt system
- Self-host Loop

The Fumadocs infrastructure is fully configured (`fumadocs-core@16.6.2`, `fumadocs-openapi@10.3.5`, `fumadocs-mdx@14.2.7`) — it just needs content. The `fumadocs-openapi` plugin can auto-generate interactive API reference pages from an OpenAPI spec, but no spec exists yet.

## 5. Goals

- Every Loop feature is documented: API endpoints, CLI commands, dashboard views, concepts, integrations
- API reference is auto-generated from OpenAPI spec (maintainable, interactive playground)
- A new user can go from zero to first API call in under 5 minutes via the quickstart guide
- Documentation follows the Diátaxis framework (tutorials, how-to guides, reference, explanation)
- All pages use Fumadocs UI components (`<Steps>`, `<Tabs>`, `<Callout>`, `<Cards>`) for rich presentation

## 6. Non-Goals

- Marketing homepage redesign (separate spec: `mvp-homepage-update`)
- Blog posts or changelog entries (content, not infrastructure)
- Video tutorials or interactive demos
- Automated doc testing or link checking (post-MVP)
- i18n / translations

## 7. Technical Dependencies

| Dependency                       | Version | Purpose                                        |
| -------------------------------- | ------- | ---------------------------------------------- |
| `fumadocs-core`                  | ^16.6.2 | Already installed — core docs framework        |
| `fumadocs-ui`                    | ^16.6.2 | Already installed — UI components              |
| `fumadocs-mdx`                   | ^14.2.7 | Already installed — MDX processing             |
| `fumadocs-openapi`               | ^10.3.5 | Already installed — OpenAPI → MDX generation   |
| `@asteasolutions/zod-to-openapi` | ^8.4.0  | **New** — Zod schema → OpenAPI spec generation |
| `zod`                            | ^4.1.13 | Already in API — schema validation             |

## 8. Detailed Design

### 8.1 OpenAPI Spec Generation

Replicate the DorkOS pattern (`/Users/doriancollier/Keep/dork-os/core/apps/server/src/services/openapi-registry.ts`):

#### 8.1.1 New File: `apps/api/src/lib/openapi-registry.ts`

Create an OpenAPI registry that registers all ~40 API endpoints:

```typescript
import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

// Define reusable schemas with OpenAPI names
const ErrorResponseSchema = z
  .object({
    error: z.string(),
  })
  .openapi('ErrorResponse');

const PaginationQuerySchema = z
  .object({
    limit: z.coerce.number().min(1).max(200).default(50).openapi({ example: 50 }),
    offset: z.coerce.number().min(0).default(0).openapi({ example: 0 }),
  })
  .openapi('PaginationQuery');

// Register each endpoint group...
// Issues (6 endpoints), Projects (5), Goals (5), Labels (3),
// Relations (2), Comments (2), Signals (1), Templates (7),
// Prompt Reviews (1), Dispatch (2), Dashboard (3), Webhooks (3)
```

**Tags** (endpoint groups):

- Issues, Projects, Goals, Labels, Relations, Comments
- Signals, Webhooks
- Templates, Prompt Reviews
- Dispatch
- Dashboard

Each `registry.registerPath()` call includes:

- `method`, `path`, `tags`, `summary`, `description`
- `request` (params, query, body with Zod schemas)
- `responses` (success + error shapes)

Export a `generateOpenAPISpec()` function:

```typescript
export function generateOpenAPISpec() {
  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Loop API',
      version: '0.1.0',
      description: 'REST API for Loop, the autonomous improvement engine.',
    },
    servers: [
      { url: 'http://localhost:4242', description: 'Local development' },
      { url: 'https://api.looped.me', description: 'Production' },
    ],
    security: [{ bearerAuth: [] }],
  });
}
```

#### 8.1.2 Zod Schema Organization

The API already uses Zod for request validation via `@hono/zod-validator`. For the OpenAPI registry, create dedicated schema files with `.openapi()` extensions:

**New file: `apps/api/src/lib/openapi-schemas.ts`**

Define all request/response Zod schemas used by the registry. These schemas mirror the existing Drizzle select/insert types but are standalone Zod objects with OpenAPI metadata (`.openapi('SchemaName')`, `.openapi({ example: ... })`).

This keeps the OpenAPI schemas separate from the Drizzle ORM layer — the registry imports from `openapi-schemas.ts`, not from `db/schema/`.

#### 8.1.3 Export Script: `scripts/export-openapi.ts`

```typescript
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { generateOpenAPISpec } from '../apps/api/src/lib/openapi-registry';

const OUTPUT_PATH = 'docs/api/openapi.json';
const spec = generateOpenAPISpec();
mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, JSON.stringify(spec, null, 2));
console.log(`OpenAPI spec exported to ${OUTPUT_PATH}`);
```

Add to root `package.json`:

```json
"scripts": {
  "docs:export-api": "tsx scripts/export-openapi.ts"
}
```

#### 8.1.4 Serve Spec at Runtime (Optional)

Add an endpoint to the Hono API for live spec access:

```typescript
// In apps/api/src/app.ts
import { generateOpenAPISpec } from './lib/openapi-registry';

app.get('/api/openapi.json', (c) => c.json(generateOpenAPISpec()));
```

#### 8.1.5 Auto-Generate API Reference Pages

The existing `apps/web/scripts/generate-api-docs.ts` already handles this:

1. Reads `docs/api/openapi.json`
2. Generates MDX pages via `fumadocs-openapi`
3. Output goes to `docs/api/`

After running `npm run docs:export-api`, run `npm run generate:api-docs -w apps/web` to produce the MDX files.

### 8.2 Documentation File Structure

```
docs/
├── index.mdx                         # Welcome page + quick links
├── meta.json                         # Top-level nav (updated)
│
├── getting-started/
│   ├── meta.json                     # Section nav
│   ├── index.mdx                     # Overview: what Loop is, prerequisites
│   ├── quickstart.mdx                # 5-min tutorial: install → config → first signal → dispatch
│   └── authentication.mdx            # API keys, Bearer auth, webhook secrets (HMAC)
│
├── concepts/
│   ├── meta.json
│   ├── index.mdx                     # How Loop works — the loop diagram
│   ├── issues.mdx                    # Issue types (signal/hypothesis/plan/task/monitor), hierarchy, lifecycle
│   ├── signals.mdx                   # Signal ingestion, webhook sources, triage flow
│   ├── dispatch.mdx                  # Priority scoring, template selection, atomic claiming, hydrated prompts
│   ├── prompts.mdx                   # Templates, versions, conditions, Handlebars hydration, EWMA reviews
│   └── projects-and-goals.mdx        # Project grouping, goal tracking, metrics
│
├── guides/
│   ├── meta.json
│   ├── dashboard.mdx                 # Dashboard tour: 5 views, keyboard shortcuts, filters
│   └── writing-templates.mdx         # Handlebars syntax, conditions, partials, specificity
│
├── integrations/
│   ├── meta.json
│   ├── index.mdx                     # Integration overview
│   ├── github.mdx                    # GitHub webhook: events, payload mapping, HMAC setup
│   ├── sentry.mdx                    # Sentry webhook: error alerts, severity mapping
│   └── posthog.mdx                   # PostHog webhook: metric alerts, shared secret
│
├── api/
│   ├── meta.json
│   ├── index.mdx                     # API overview: base URL, auth, errors, pagination, conventions
│   └── (auto-generated from OpenAPI) # One page per tag group
│
├── cli/
│   ├── meta.json
│   ├── index.mdx                     # Installation, config (~/.loop/config.json), global flags
│   ├── issues.mdx                    # looped issues, show, create, comment
│   ├── signals.mdx                   # looped signal
│   ├── triage.mdx                    # looped triage
│   ├── templates.mdx                 # looped templates
│   ├── dispatch.mdx                  # looped next, looped dispatch
│   └── status.mdx                    # looped status, projects, goals
│
├── self-hosting/
│   ├── meta.json
│   ├── index.mdx                     # Overview + system requirements
│   ├── environment.mdx               # All environment variables documented
│   └── deployment.mdx                # Vercel deployment, manual deployment, database setup
│
└── contributing/
    ├── meta.json
    └── index.mdx                     # Dev setup, testing (PGlite), code quality, ADR process
```

### 8.3 Updated `docs/meta.json`

```json
{
  "title": "Documentation",
  "pages": [
    "getting-started",
    "concepts",
    "guides",
    "integrations",
    "api",
    "cli",
    "self-hosting",
    "contributing"
  ]
}
```

Changes from current:

- Added `cli` (was missing)
- Removed `changelog` (deferred — no content yet)
- Reordered to match Diátaxis priority (tutorials → explanation → reference)

### 8.4 Page Content Guidelines

#### Content Depth

Every page follows the "rich with examples" standard:

- **Explanatory text** — 500-800 words per page, clear prose
- **Code examples** — curl commands, JSON request/response payloads, CLI output
- **Fumadocs components** — `<Steps>` for walkthroughs, `<Tabs>` for curl/CLI/JS examples, `<Callout>` for warnings/tips, `<Cards>` for landing pages
- **Real-world scenarios** — Not abstract; use concrete Loop workflows (e.g., "PostHog sends a conversion drop signal → Loop creates a triage issue → agent dispatches")

#### Source Material

Adapt content from these existing documents (don't write from scratch):

- `meta/loop-mvp.md` — Feature descriptions, API endpoint tables, CLI commands, default templates
- `meta/loop-litepaper.md` — Vision, "no AI" architecture, competitive positioning
- `CLAUDE.md` — API endpoint table, env vars, commands, tech stack
- `apps/api/src/routes/*.ts` — Actual endpoint implementations for accuracy
- `apps/cli/src/commands/*.ts` — Actual CLI command implementations

### 8.5 Key Page Specifications

#### `docs/index.mdx` — Welcome Page

- One-liner: what Loop is
- "No AI" value proposition (from litepaper)
- Quick links using `<Cards>` to each major section
- System requirements (Node.js 20+, PostgreSQL)

#### `docs/getting-started/quickstart.mdx` — 5-Minute Tutorial

Using `<Steps>` component:

1. Clone repo and install deps
2. Set up Neon database + env vars
3. Run migrations
4. Start API server
5. Create a project via API
6. Submit a signal
7. See the signal appear as a triage issue
8. Dispatch the issue and see the hydrated prompt

#### `docs/concepts/index.mdx` — How Loop Works

ASCII or mermaid diagram showing the core loop:

```
Signal → Triage Issue → Hypothesis → Plan → Tasks → Monitor → Validated/Invalidated
                                                         ↓
                                              Agent dispatches via /api/dispatch/next
                                              receives issue + hydrated prompt
                                              executes work, reports back
```

Explain the "no AI" architecture: Loop is fully deterministic, no LLM calls. Quality improves when better models read Loop's prompts.

#### `docs/api/index.mdx` — API Overview

- Base URL: `http://localhost:4242` (dev), `https://api.looped.me` (prod)
- Authentication: `Authorization: Bearer <LOOP_API_KEY>`
- Error format: `{ error: string }`
- Pagination: `?limit=50&offset=0` → response includes `{ data: [...], total: number }`
- Soft delete: `DELETE` sets `deletedAt`, doesn't hard-delete
- All IDs are CUID2 text strings

The auto-generated pages (from OpenAPI spec) will be placed alongside this index.

#### `docs/cli/index.mdx` — CLI Overview

- Installation: `npm install -g @loop/cli` (or local from monorepo)
- Configuration: `looped config set url <url>` and `looped config set token <token>`
- Config file location: `~/.loop/config.json`
- Global flags: `--json`, `--api-url <url>`, `--token <token>`
- Environment variable overrides: `LOOP_API_URL`, `LOOP_API_TOKEN`

#### `docs/guides/writing-templates.mdx` — Template Authoring

- Handlebars syntax basics
- Available template variables: `issue.*`, `parent.*`, `children`, `labels`, `project.*`, `goal.*`, etc.
- Shared partials: `{{> api_reference}}`, `{{> review_instructions}}`, `{{> parent_context}}`, etc.
- Conditions object: `{ type, signalSource, labels, projectId, hasFailedSessions, hypothesisConfidence }`
- Specificity scoring (0-100)
- Example: creating a custom template for a specific project

#### `docs/integrations/github.mdx` — GitHub Webhook

- Step-by-step setup in GitHub repo settings
- Webhook URL: `POST /api/signals/github`
- Supported events and how they map to signals
- HMAC-SHA256 verification (`GITHUB_WEBHOOK_SECRET`)
- Example payload and resulting issue

### 8.6 Subsection `meta.json` Files

Each subdirectory needs a `meta.json` for sidebar ordering. Example for `getting-started/`:

```json
{
  "title": "Getting Started",
  "pages": ["quickstart", "authentication"]
}
```

All subsection meta.json files follow this pattern, listing pages in reading order.

## 9. User Experience

After this work:

- Visiting `www.looped.me/docs` shows a professional welcome page with navigation
- The sidebar has 8 sections, each with sub-pages
- API reference has an interactive playground (via fumadocs-openapi)
- A developer can go from zero to first API call in 5 minutes via the quickstart
- All CLI commands are documented with examples and output

## 10. Testing Strategy

### OpenAPI Registry Tests

**New file: `apps/api/src/__tests__/openapi-registry.test.ts`**

- Validates the generated spec is valid OpenAPI 3.1.0
- Confirms all expected tag groups are registered (Issues, Projects, Goals, Labels, Relations, Comments, Signals, Webhooks, Templates, Prompt Reviews, Dispatch, Dashboard)
- Ensures the spec exports as valid JSON
- Validates that all registered paths match actual route files

### Documentation Build Tests

- Verify `npm run docs:export-api` produces a valid `docs/api/openapi.json`
- Verify `npm run generate:api-docs -w apps/web` generates MDX files without errors
- Verify `npm run build -w apps/web` succeeds with all MDX pages (catches broken links, missing imports)

### Manual Verification

- Review each page renders correctly in the Fumadocs UI
- Verify all code examples are syntactically correct
- Check that curl examples match actual API behavior
- Confirm sidebar navigation ordering is logical

## 11. Performance Considerations

- MDX pages are statically generated at build time — no runtime cost
- OpenAPI spec is generated once (export script), not on every request
- The optional `/api/openapi.json` runtime endpoint generates the spec on each request — acceptable for dev use, could be cached if needed

## 12. Security Considerations

- Documentation is public (no auth required to read docs)
- API key values in examples use placeholder tokens (`loop_...`)
- Webhook secrets in examples use placeholder values
- No real credentials or database URLs appear in docs

## 13. Documentation

This spec IS the documentation effort — no separate documentation needed.

## 14. Implementation Phases

### Phase 1: OpenAPI Infrastructure

1. Install `@asteasolutions/zod-to-openapi` in `apps/api/`
2. Create `apps/api/src/lib/openapi-schemas.ts` — Zod schemas with `.openapi()` extensions
3. Create `apps/api/src/lib/openapi-registry.ts` — Register all ~40 endpoints
4. Create `scripts/export-openapi.ts` — Export script
5. Add `docs:export-api` script to root `package.json`
6. Run export → generates `docs/api/openapi.json`
7. Run `generate:api-docs` → generates API reference MDX pages
8. Write OpenAPI registry tests
9. Optionally add `/api/openapi.json` endpoint to Hono app

### Phase 2: Documentation Infrastructure

1. Update `docs/meta.json` (add `cli`, remove `changelog`, reorder)
2. Create all subsection `meta.json` files
3. Create `docs/index.mdx` welcome page with `<Cards>` navigation

### Phase 3: Core Documentation Pages

Write in priority order:

**Getting Started (3 pages):**

1. `getting-started/index.mdx` — Prerequisites and overview
2. `getting-started/quickstart.mdx` — 5-minute tutorial
3. `getting-started/authentication.mdx` — API keys and webhook secrets

**Concepts (6 pages):** 4. `concepts/index.mdx` — How Loop works (the loop diagram) 5. `concepts/issues.mdx` — Issue types, hierarchy, lifecycle 6. `concepts/signals.mdx` — Signal ingestion, sources, triage 7. `concepts/dispatch.mdx` — Priority scoring, template selection, dispatch 8. `concepts/prompts.mdx` — Templates, versions, reviews, EWMA 9. `concepts/projects-and-goals.mdx` — Projects, goals, metrics

### Phase 4: Reference Documentation

**API Reference (1 hand-written + auto-generated):** 10. `api/index.mdx` — API overview (base URL, auth, errors, pagination) - Auto-generated pages from OpenAPI spec handle per-endpoint docs

**CLI Reference (7 pages):** 11. `cli/index.mdx` — Installation, config, global flags 12. `cli/issues.mdx` — issues, show, create, comment commands 13. `cli/signals.mdx` — signal command 14. `cli/triage.mdx` — triage command 15. `cli/templates.mdx` — templates command 16. `cli/dispatch.mdx` — next and dispatch commands 17. `cli/status.mdx` — status, projects, goals commands

### Phase 5: Guides, Integrations, Operations

**Guides (2 pages):** 18. `guides/dashboard.mdx` — Dashboard tour, views, keyboard shortcuts 19. `guides/writing-templates.mdx` — Handlebars syntax, conditions, partials

**Integrations (4 pages):** 20. `integrations/index.mdx` — Integration overview 21. `integrations/github.mdx` — GitHub webhook setup 22. `integrations/sentry.mdx` — Sentry webhook setup 23. `integrations/posthog.mdx` — PostHog webhook setup

**Self-Hosting (3 pages):** 24. `self-hosting/index.mdx` — Overview and requirements 25. `self-hosting/environment.mdx` — Environment variables reference 26. `self-hosting/deployment.mdx` — Deployment guide (Vercel, manual)

**Contributing (1 page):** 27. `contributing/index.mdx` — Dev setup, testing, code quality

## 15. Open Questions

None — all decisions have been made.

## 16. Related ADRs

- ADR #1: Use Hono over Express (API architecture)
- ADR #3: Use Neon PostgreSQL (database)
- ADR #4: Use Drizzle ORM (database access)
- ADR #8: Use Handlebars for prompt hydration (template system)
- ADR #9: Use FOR UPDATE SKIP LOCKED for dispatch (dispatch)
- ADR #10: Use EWMA for review scoring (prompt reviews)
- ADR #12: Use TanStack Router (dashboard)
- ADR #15: Use Commander.js for CLI (CLI framework)
- ADR #17: Use custom config over XDG (CLI config)

## 17. References

- [Fumadocs Documentation](https://fumadocs.dev/docs)
- [Fumadocs OpenAPI Integration](https://fumadocs.dev/docs/integrations/openapi)
- [Diátaxis Framework](https://diataxis.fr/)
- [@asteasolutions/zod-to-openapi](https://github.com/asteasolutions/zod-to-openapi)
- DorkOS OpenAPI registry: `/Users/doriancollier/Keep/dork-os/core/apps/server/src/services/openapi-registry.ts`
- Research document: `research/20260220_docs-update-post-mvp.md`

## 18. Changelog

- 2026-02-20: Initial specification created from ideation
