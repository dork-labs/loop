---
slug: docs-update-post-mvp
last-decompose: 2026-02-20
---

# Tasks: Update Documentation Post-MVP

## Phase 1: OpenAPI Infrastructure

### Task 1.1: Install zod-to-openapi and create OpenAPI schemas

**Objective:** Install the `@asteasolutions/zod-to-openapi` package and create standalone Zod schemas with OpenAPI metadata for all API request/response types.

**Implementation:**

1. Install dependency:
```bash
cd apps/api && npm install @asteasolutions/zod-to-openapi
```

2. Create `apps/api/src/lib/openapi-schemas.ts`:

```typescript
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

// --- Shared Schemas ---

export const ErrorResponseSchema = z.object({
  error: z.string(),
}).openapi('ErrorResponse');

export const PaginationQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(200).default(50).openapi({ example: 50 }),
  offset: z.coerce.number().min(0).default(0).openapi({ example: 0 }),
}).openapi('PaginationQuery');

export const CuidParamSchema = z.object({
  id: z.string().openapi({ example: 'clxyz1234567890abcdef' }),
}).openapi('CuidParam');

// --- Issue Schemas ---

export const IssueSchema = z.object({
  id: z.string(),
  type: z.enum(['signal', 'hypothesis', 'plan', 'task', 'monitor']),
  status: z.enum(['open', 'in_progress', 'closed', 'cancelled']),
  title: z.string(),
  body: z.string().nullable(),
  priority: z.number().nullable(),
  projectId: z.string().nullable(),
  parentId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
}).openapi('Issue');

export const CreateIssueSchema = z.object({
  type: z.enum(['signal', 'hypothesis', 'plan', 'task', 'monitor']),
  title: z.string().min(1).max(500),
  body: z.string().optional(),
  status: z.enum(['open', 'in_progress', 'closed', 'cancelled']).optional(),
  priority: z.number().min(0).max(100).optional(),
  projectId: z.string().optional(),
  parentId: z.string().optional(),
}).openapi('CreateIssue');

export const UpdateIssueSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  body: z.string().optional(),
  status: z.enum(['open', 'in_progress', 'closed', 'cancelled']).optional(),
  priority: z.number().min(0).max(100).optional(),
  type: z.enum(['signal', 'hypothesis', 'plan', 'task', 'monitor']).optional(),
  projectId: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
}).openapi('UpdateIssue');

// --- Project Schemas ---

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
}).openapi('Project');

export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
}).openapi('CreateProject');

export const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
}).openapi('UpdateProject');

// --- Goal Schemas ---

export const GoalSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  targetDate: z.string().nullable(),
  status: z.enum(['active', 'completed', 'cancelled']),
  projectId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
}).openapi('Goal');

export const CreateGoalSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  targetDate: z.string().optional(),
  status: z.enum(['active', 'completed', 'cancelled']).optional(),
  projectId: z.string().optional(),
}).openapi('CreateGoal');

export const UpdateGoalSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  targetDate: z.string().nullable().optional(),
  status: z.enum(['active', 'completed', 'cancelled']).optional(),
  projectId: z.string().nullable().optional(),
}).openapi('UpdateGoal');

// --- Label Schemas ---

export const LabelSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullable(),
  createdAt: z.string(),
  deletedAt: z.string().nullable(),
}).openapi('Label');

export const CreateLabelSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().optional(),
}).openapi('CreateLabel');

// --- Relation Schemas ---

export const RelationSchema = z.object({
  id: z.string(),
  sourceIssueId: z.string(),
  targetIssueId: z.string(),
  type: z.enum(['blocks', 'relates_to', 'duplicates']),
  createdAt: z.string(),
}).openapi('Relation');

export const CreateRelationSchema = z.object({
  targetIssueId: z.string(),
  type: z.enum(['blocks', 'relates_to', 'duplicates']),
}).openapi('CreateRelation');

// --- Comment Schemas ---

export const CommentSchema = z.object({
  id: z.string(),
  issueId: z.string(),
  body: z.string(),
  parentId: z.string().nullable(),
  authorType: z.enum(['human', 'agent']),
  createdAt: z.string(),
  updatedAt: z.string(),
}).openapi('Comment');

export const CreateCommentSchema = z.object({
  body: z.string().min(1),
  parentId: z.string().optional(),
  authorType: z.enum(['human', 'agent']).optional(),
}).openapi('CreateComment');

// --- Signal Schemas ---

export const SignalSchema = z.object({
  id: z.string(),
  source: z.string(),
  externalId: z.string().nullable(),
  title: z.string(),
  body: z.string().nullable(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).nullable(),
  metadata: z.record(z.unknown()).nullable(),
  issueId: z.string().nullable(),
  createdAt: z.string(),
}).openapi('Signal');

export const CreateSignalSchema = z.object({
  source: z.string().min(1),
  externalId: z.string().optional(),
  title: z.string().min(1).max(500),
  body: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  metadata: z.record(z.unknown()).optional(),
}).openapi('CreateSignal');

// --- Template Schemas ---

export const TemplateSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  activeVersionId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
}).openapi('Template');

export const CreateTemplateSchema = z.object({
  slug: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
}).openapi('CreateTemplate');

export const UpdateTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
}).openapi('UpdateTemplate');

export const TemplateVersionSchema = z.object({
  id: z.string(),
  templateId: z.string(),
  version: z.number(),
  body: z.string(),
  conditions: z.record(z.unknown()).nullable(),
  specificity: z.number(),
  createdAt: z.string(),
}).openapi('TemplateVersion');

export const CreateVersionSchema = z.object({
  body: z.string().min(1),
  conditions: z.record(z.unknown()).optional(),
}).openapi('CreateVersion');

// --- Prompt Review Schemas ---

export const PromptReviewSchema = z.object({
  id: z.string(),
  versionId: z.string(),
  rating: z.number(),
  feedback: z.string().nullable(),
  sessionId: z.string().nullable(),
  createdAt: z.string(),
}).openapi('PromptReview');

export const CreatePromptReviewSchema = z.object({
  versionId: z.string(),
  rating: z.number().min(1).max(5),
  feedback: z.string().optional(),
  sessionId: z.string().optional(),
}).openapi('CreatePromptReview');

// --- Dispatch Schemas ---

export const DispatchResponseSchema = z.object({
  issue: IssueSchema,
  prompt: z.string(),
  templateSlug: z.string(),
  versionId: z.string(),
}).openapi('DispatchResponse');

// --- Dashboard Schemas ---

export const DashboardStatsSchema = z.object({
  totalIssues: z.number(),
  openIssues: z.number(),
  signalsToday: z.number(),
  dispatchesThisWeek: z.number(),
}).openapi('DashboardStats');
```

Schemas must mirror the actual Drizzle types but remain standalone. Verify each schema against the corresponding route file in `apps/api/src/routes/`.

**Acceptance Criteria:**
- [ ] `@asteasolutions/zod-to-openapi` installed in `apps/api/package.json`
- [ ] `apps/api/src/lib/openapi-schemas.ts` exists with all schemas
- [ ] Every schema has `.openapi('SchemaName')` metadata
- [ ] Schemas cover: Issues, Projects, Goals, Labels, Relations, Comments, Signals, Templates, Versions, PromptReviews, Dispatch, Dashboard
- [ ] `npm run typecheck` passes

**Dependencies:** None

---

### Task 1.2: Create OpenAPI registry with all endpoint registrations

**Objective:** Create the OpenAPI registry file that registers all ~40 API endpoints with proper methods, paths, tags, summaries, request/response schemas.

**Implementation:**

Create `apps/api/src/lib/openapi-registry.ts`:

```typescript
import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import {
  ErrorResponseSchema,
  PaginationQuerySchema,
  CuidParamSchema,
  IssueSchema,
  CreateIssueSchema,
  UpdateIssueSchema,
  ProjectSchema,
  CreateProjectSchema,
  UpdateProjectSchema,
  GoalSchema,
  CreateGoalSchema,
  UpdateGoalSchema,
  LabelSchema,
  CreateLabelSchema,
  RelationSchema,
  CreateRelationSchema,
  CommentSchema,
  CreateCommentSchema,
  SignalSchema,
  CreateSignalSchema,
  TemplateSchema,
  CreateTemplateSchema,
  UpdateTemplateSchema,
  TemplateVersionSchema,
  CreateVersionSchema,
  PromptReviewSchema,
  CreatePromptReviewSchema,
  DispatchResponseSchema,
  DashboardStatsSchema,
} from './openapi-schemas';
import { z } from 'zod';

const registry = new OpenAPIRegistry();

// Register security scheme
registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'API Key',
  description: 'API key passed as Bearer token. Set via LOOP_API_KEY environment variable.',
});

// --- Issues (6 endpoints) ---
registry.registerPath({
  method: 'get',
  path: '/api/issues',
  tags: ['Issues'],
  summary: 'List issues',
  description: 'List issues with optional filtering by status, type, and projectId. Supports pagination.',
  request: { query: PaginationQuerySchema.extend({
    status: z.enum(['open', 'in_progress', 'closed', 'cancelled']).optional(),
    type: z.enum(['signal', 'hypothesis', 'plan', 'task', 'monitor']).optional(),
    projectId: z.string().optional(),
  })},
  responses: {
    200: { description: 'Paginated list of issues', content: { 'application/json': { schema: z.object({ data: z.array(IssueSchema), total: z.number() }) } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponseSchema } } },
  },
});

// ... Register all remaining endpoints following the same pattern:
// POST /api/issues - Create issue
// GET /api/issues/:id - Get issue by ID
// PATCH /api/issues/:id - Update issue
// DELETE /api/issues/:id - Soft-delete issue
// POST /api/issues/:id/relations - Create relation
// GET /api/issues/:id/comments - List comments
// POST /api/issues/:id/comments - Add comment

// --- Projects (5 endpoints) ---
// GET /api/projects - List projects
// POST /api/projects - Create project
// GET /api/projects/:id - Get project
// PATCH /api/projects/:id - Update project
// DELETE /api/projects/:id - Soft-delete project

// --- Goals (5 endpoints) ---
// GET /api/goals - List goals
// POST /api/goals - Create goal
// GET /api/goals/:id - Get goal
// PATCH /api/goals/:id - Update goal
// DELETE /api/goals/:id - Soft-delete goal

// --- Labels (3 endpoints) ---
// GET /api/labels - List labels
// POST /api/labels - Create label
// DELETE /api/labels/:id - Soft-delete label

// --- Relations (1 endpoint) ---
// DELETE /api/relations/:id - Delete relation

// --- Signals (1 endpoint) ---
// POST /api/signals - Ingest signal

// --- Templates (7 endpoints) ---
// GET /api/templates - List templates
// POST /api/templates - Create template
// GET /api/templates/:id - Get template with active version
// PATCH /api/templates/:id - Update template
// DELETE /api/templates/:id - Soft-delete template
// GET /api/templates/:id/versions - List versions
// POST /api/templates/:id/versions - Create version
// POST /api/templates/:id/versions/:versionId/promote - Promote version

// --- Template Reviews (via templates) ---
// GET /api/templates/:id/reviews - List reviews

// --- Prompt Reviews (1 endpoint) ---
// POST /api/prompt-reviews - Create review

// --- Dispatch (2 endpoints) ---
// GET /api/dispatch/next - Get next dispatchable issue
// POST /api/dispatch/next - Claim and dispatch next issue

// --- Dashboard (3 endpoints) ---
// GET /api/dashboard/stats - System stats
// GET /api/dashboard/activity - Activity timeline
// GET /api/dashboard/prompts - Template health

// --- Webhooks (3 endpoints) ---
// POST /api/signals/posthog - PostHog webhook
// POST /api/signals/github - GitHub webhook
// POST /api/signals/sentry - Sentry webhook
```

Each `registerPath` call must include: method, path, tags array, summary, description, request (params/query/body as applicable), and responses (200/201 success + 400/401/404 errors).

**Tags to register:**
- Issues, Projects, Goals, Labels, Relations, Comments
- Signals, Webhooks
- Templates, Prompt Reviews
- Dispatch
- Dashboard

**Export function:**

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

**Acceptance Criteria:**
- [ ] `apps/api/src/lib/openapi-registry.ts` exists
- [ ] All ~40 endpoints registered with correct methods, paths, tags
- [ ] `generateOpenAPISpec()` returns a valid OpenAPI 3.1.0 document
- [ ] All 13 tag groups present: Issues, Projects, Goals, Labels, Relations, Comments, Signals, Webhooks, Templates, Prompt Reviews, Dispatch, Dashboard
- [ ] Security scheme registered (bearerAuth)
- [ ] `npm run typecheck` passes

**Dependencies:** Task 1.1

---

### Task 1.3: Create export script and runtime endpoint

**Objective:** Create the script that exports the OpenAPI spec to `docs/api/openapi.json`, add npm script, and add optional runtime endpoint.

**Implementation:**

1. Create `scripts/export-openapi.ts`:

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

2. Add to root `package.json` scripts:
```json
{
  "docs:export-api": "tsx scripts/export-openapi.ts"
}
```

3. Add runtime endpoint to `apps/api/src/app.ts`:
```typescript
import { generateOpenAPISpec } from './lib/openapi-registry';

// Add before the protected routes
app.get('/api/openapi.json', (c) => c.json(generateOpenAPISpec()));
```

4. Run `npm run docs:export-api` and verify `docs/api/openapi.json` is produced.

**Acceptance Criteria:**
- [ ] `scripts/export-openapi.ts` exists
- [ ] `npm run docs:export-api` script added to root `package.json`
- [ ] Running script produces valid `docs/api/openapi.json`
- [ ] `/api/openapi.json` endpoint added to Hono app
- [ ] Endpoint returns valid JSON OpenAPI spec
- [ ] `npm run typecheck` passes

**Dependencies:** Task 1.2

---

### Task 1.4: Write OpenAPI registry tests

**Objective:** Create comprehensive tests for the OpenAPI registry.

**Implementation:**

Create `apps/api/src/__tests__/openapi-registry.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { generateOpenAPISpec } from '../lib/openapi-registry';

describe('OpenAPI Registry', () => {
  const spec = generateOpenAPISpec();

  it('generates a valid OpenAPI 3.1.0 document', () => {
    expect(spec.openapi).toBe('3.1.0');
    expect(spec.info.title).toBe('Loop API');
    expect(spec.info.version).toBe('0.1.0');
  });

  it('includes both servers', () => {
    expect(spec.servers).toHaveLength(2);
    expect(spec.servers![0].url).toBe('http://localhost:4242');
    expect(spec.servers![1].url).toBe('https://api.looped.me');
  });

  it('includes bearer auth security scheme', () => {
    expect(spec.components?.securitySchemes?.bearerAuth).toBeDefined();
  });

  it('registers all expected tag groups', () => {
    const paths = Object.values(spec.paths || {});
    const allTags = new Set<string>();
    for (const pathItem of paths) {
      for (const method of Object.values(pathItem as Record<string, any>)) {
        if (method.tags) {
          method.tags.forEach((t: string) => allTags.add(t));
        }
      }
    }

    const expectedTags = [
      'Issues', 'Projects', 'Goals', 'Labels', 'Relations', 'Comments',
      'Signals', 'Webhooks', 'Templates', 'Prompt Reviews', 'Dispatch', 'Dashboard',
    ];
    for (const tag of expectedTags) {
      expect(allTags).toContain(tag);
    }
  });

  it('registers all expected paths', () => {
    const paths = Object.keys(spec.paths || {});
    const expectedPaths = [
      '/api/issues',
      '/api/issues/{id}',
      '/api/projects',
      '/api/projects/{id}',
      '/api/goals',
      '/api/goals/{id}',
      '/api/labels',
      '/api/labels/{id}',
      '/api/relations/{id}',
      '/api/signals',
      '/api/templates',
      '/api/templates/{id}',
      '/api/prompt-reviews',
      '/api/dispatch/next',
      '/api/dashboard/stats',
      '/api/dashboard/activity',
      '/api/dashboard/prompts',
    ];
    for (const path of expectedPaths) {
      expect(paths).toContain(path);
    }
  });

  it('exports valid JSON', () => {
    const json = JSON.stringify(spec);
    expect(() => JSON.parse(json)).not.toThrow();
  });
});
```

**Acceptance Criteria:**
- [ ] Test file exists at `apps/api/src/__tests__/openapi-registry.test.ts`
- [ ] All tests pass with `npx vitest run apps/api/src/__tests__/openapi-registry.test.ts`
- [ ] Tests validate: OpenAPI version, servers, security scheme, all tag groups, all paths, JSON export

**Dependencies:** Task 1.2

---

### Task 1.5: Generate API reference MDX pages

**Objective:** Run the fumadocs-openapi pipeline to generate interactive API reference MDX pages from the exported OpenAPI spec.

**Implementation:**

1. Verify `docs/api/openapi.json` exists (from Task 1.3)
2. Run: `npm run generate:api-docs -w apps/web`
3. Verify MDX files are generated in `docs/api/`
4. Verify `npm run build -w apps/web` succeeds with generated pages

The existing `apps/web/scripts/generate-api-docs.ts` handles the generation. May need to verify its configuration reads from `docs/api/openapi.json`.

**Acceptance Criteria:**
- [ ] `docs/api/openapi.json` exists with valid content
- [ ] Running `generate:api-docs` produces MDX files in `docs/api/`
- [ ] Generated pages cover all tag groups
- [ ] `npm run build -w apps/web` succeeds

**Dependencies:** Task 1.3

---

## Phase 2: Documentation Infrastructure

### Task 2.1: Update docs/meta.json and create subsection meta.json files

**Objective:** Update top-level navigation and create all subsection meta.json files for sidebar ordering.

**Implementation:**

1. Update `docs/meta.json`:
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

Changes: Added `cli`, removed `changelog`, reordered to Diataxis priority.

2. Create subsection meta.json files:

`docs/getting-started/meta.json`:
```json
{
  "title": "Getting Started",
  "pages": ["quickstart", "authentication"]
}
```

`docs/concepts/meta.json`:
```json
{
  "title": "Concepts",
  "pages": ["issues", "signals", "dispatch", "prompts", "projects-and-goals"]
}
```

`docs/guides/meta.json`:
```json
{
  "title": "Guides",
  "pages": ["dashboard", "writing-templates"]
}
```

`docs/integrations/meta.json`:
```json
{
  "title": "Integrations",
  "pages": ["github", "sentry", "posthog"]
}
```

`docs/api/meta.json`:
```json
{
  "title": "API Reference",
  "pages": ["..."]
}
```
Note: The `pages` array for API will need to include auto-generated page slugs after Task 1.5.

`docs/cli/meta.json`:
```json
{
  "title": "CLI Reference",
  "pages": ["issues", "signals", "triage", "templates", "dispatch", "status"]
}
```

`docs/self-hosting/meta.json`:
```json
{
  "title": "Self-Hosting",
  "pages": ["environment", "deployment"]
}
```

`docs/contributing/meta.json`:
```json
{
  "title": "Contributing",
  "pages": []
}
```

3. Create the directories:
```bash
mkdir -p docs/getting-started docs/concepts docs/guides docs/integrations docs/cli docs/self-hosting docs/contributing
```

**Acceptance Criteria:**
- [ ] `docs/meta.json` updated with `cli` added and `changelog` removed
- [ ] All 8 subsection directories exist
- [ ] All 8 subsection `meta.json` files created with correct page ordering
- [ ] Navigation order follows Diataxis: tutorials, explanation, reference, how-to

**Dependencies:** None

---

### Task 2.2: Write docs/index.mdx welcome page

**Objective:** Replace the placeholder welcome page with a comprehensive landing page using Fumadocs `<Cards>` component.

**Implementation:**

Create `docs/index.mdx` with:
- Title and one-liner description of Loop
- "No AI" value proposition paragraph (Loop is fully deterministic, no LLM calls)
- System requirements (Node.js 20+, PostgreSQL)
- `<Cards>` grid linking to all major sections:
  - Getting Started (quickstart, auth)
  - Concepts (how Loop works)
  - API Reference (endpoint docs)
  - CLI Reference (command docs)
  - Integrations (GitHub, Sentry, PostHog)
  - Guides (dashboard, templates)
  - Self-Hosting (deployment)
  - Contributing (dev setup)

Use Fumadocs components: `<Cards>`, `<Card>`, `<Callout>`.

Content sources: `meta/loop-litepaper.md` for vision, `CLAUDE.md` for tech details.

**Acceptance Criteria:**
- [ ] `docs/index.mdx` has proper frontmatter (title, description)
- [ ] One-liner + "no AI" value prop included
- [ ] System requirements listed
- [ ] `<Cards>` navigation to all 8 sections
- [ ] Page renders correctly in Fumadocs

**Dependencies:** Task 2.1

---

## Phase 3: Core Documentation Pages

### Task 3.1: Write Getting Started section (3 pages)

**Objective:** Create the three Getting Started pages that enable a new user to go from zero to first API call in 5 minutes.

**Pages:**

**1. `docs/getting-started/index.mdx` — Overview**
- What Loop is (autonomous improvement engine)
- Prerequisites: Node.js 20+, PostgreSQL (Neon recommended), npm
- What you'll learn in this section
- Links to quickstart and auth pages

**2. `docs/getting-started/quickstart.mdx` — 5-Minute Tutorial**
Using `<Steps>` component:
1. Clone repo and install deps (`git clone`, `npm install`)
2. Set up Neon database + create `.env` with `DATABASE_URL`
3. Run migrations (`npm run db:migrate -w apps/api`)
4. Start API server (`npm run dev -w apps/api`)
5. Create a project via API (curl example with full request/response)
6. Submit a signal (curl POST to `/api/signals`)
7. See the signal appear as a triage issue (curl GET `/api/issues?type=signal`)
8. Dispatch the issue and see hydrated prompt (curl POST `/api/dispatch/next`)

Include `<Tabs>` for curl vs JavaScript (ky) examples where applicable.

**3. `docs/getting-started/authentication.mdx` — Authentication**
- Bearer token auth: `Authorization: Bearer <LOOP_API_KEY>`
- Setting the API key env var
- Webhook authentication:
  - GitHub: HMAC-SHA256 with `GITHUB_WEBHOOK_SECRET`
  - Sentry: HMAC-SHA256 with `SENTRY_CLIENT_SECRET`
  - PostHog: shared secret with `POSTHOG_WEBHOOK_SECRET`
- Example curl with auth header
- `<Callout type="warning">` for never sharing API keys

Content sources: `CLAUDE.md` for env vars and auth details, `apps/api/src/routes/webhooks.ts` for webhook verification.

**Acceptance Criteria:**
- [ ] All 3 MDX files created in `docs/getting-started/`
- [ ] Quickstart uses `<Steps>` component with 8 steps
- [ ] All curl examples are syntactically correct and use placeholder tokens
- [ ] Auth page covers both Bearer and webhook authentication
- [ ] Pages build without errors (`npm run build -w apps/web`)

**Dependencies:** Task 2.1

---

### Task 3.2: Write Concepts section (6 pages)

**Objective:** Create the six Concepts pages explaining Loop's core mental model.

**Pages:**

**1. `docs/concepts/index.mdx` — How Loop Works**
- The core loop diagram (ASCII or mermaid):
  Signal -> Triage Issue -> Hypothesis -> Plan -> Tasks -> Monitor -> Validated/Invalidated
  Agent dispatches via /api/dispatch/next, receives issue + hydrated prompt
- "No AI" architecture explanation: Loop is fully deterministic, no LLM calls
- Quality improves when better models read Loop's prompts
- Overview of the 5 issue types and how they connect

**2. `docs/concepts/issues.mdx` — Issues**
- 5 issue types: signal, hypothesis, plan, task, monitor
- Issue hierarchy (parent-child relationships)
- Issue lifecycle (open -> in_progress -> closed/cancelled)
- Labels and relations (blocks, relates_to, duplicates)
- Priority field (0-100 scale)
- Soft-delete behavior

**3. `docs/concepts/signals.mdx` — Signals**
- What signals are (raw events from external sources)
- Signal ingestion via POST /api/signals
- Webhook sources: GitHub, Sentry, PostHog
- How signals create triage issues automatically
- Signal metadata and severity levels
- Triage flow: signal -> triage issue -> human/agent review

**4. `docs/concepts/dispatch.mdx` — Dispatch**
- Priority scoring: how issues are ranked for dispatch
- Template selection: matching conditions, specificity scoring
- Atomic claiming: FOR UPDATE SKIP LOCKED prevents double-dispatch
- The dispatch flow: GET /api/dispatch/next (peek) vs POST (claim)
- Hydrated prompts: Handlebars templates filled with issue context
- What the agent receives (issue + prompt + metadata)

**5. `docs/concepts/prompts.mdx` — Prompts**
- Template structure: slug, name, active version
- Version management: multiple versions per template, one active
- Conditions object: `{ type, signalSource, labels, projectId, hasFailedSessions, hypothesisConfidence }`
- Handlebars hydration: variables available in templates
- EWMA review scoring: how ratings affect template health
- Template promotion workflow

**6. `docs/concepts/projects-and-goals.mdx` — Projects and Goals**
- Projects: grouping issues, project-level views
- Goals: tracking objectives with target dates
- Relationship: goals belong to projects
- Dashboard metrics and project health

Content sources: `meta/loop-mvp.md` for feature details, `meta/loop-litepaper.md` for vision, route files for accuracy.

**Acceptance Criteria:**
- [ ] All 6 MDX files created in `docs/concepts/`
- [ ] Each page has 500-800 words of explanatory text
- [ ] Concepts/index has the core loop diagram
- [ ] Dispatch page explains SKIP LOCKED atomic claiming
- [ ] Prompts page covers Handlebars hydration and EWMA
- [ ] Pages build without errors

**Dependencies:** Task 2.1

---

## Phase 4: Reference Documentation

### Task 4.1: Write API reference index page

**Objective:** Create the hand-written API overview page that sits alongside auto-generated endpoint pages.

**Implementation:**

Create `docs/api/index.mdx` with:

- Base URLs: `http://localhost:4242` (dev), `https://api.looped.me` (prod)
- Authentication: `Authorization: Bearer <LOOP_API_KEY>`
- Error format: `{ error: string }` with status codes (400, 401, 404, 500)
- Pagination convention: `?limit=50&offset=0` -> `{ data: [...], total: number }`
- Soft delete: DELETE sets `deletedAt`, records not returned in list queries
- ID format: CUID2 text strings
- Rate limiting (if applicable)
- `<Callout>` for auth requirement

Include example request/response using `<Tabs>` (curl / JavaScript).

**Acceptance Criteria:**
- [ ] `docs/api/index.mdx` created
- [ ] Covers base URL, auth, errors, pagination, soft delete, ID format
- [ ] Includes example request/response
- [ ] Builds without errors alongside auto-generated pages

**Dependencies:** Tasks 1.5, 2.1

---

### Task 4.2: Write CLI reference section (7 pages)

**Objective:** Create the seven CLI reference pages documenting all `looped` commands.

**Pages:**

**1. `docs/cli/index.mdx` — CLI Overview**
- Installation: `npm install -g @loop/cli`
- Configuration: `looped config set url <url>`, `looped config set token <token>`
- Config file: `~/.loop/config.json`
- Global flags: `--json`, `--api-url <url>`, `--token <token>`
- Environment variables: `LOOP_API_URL`, `LOOP_API_TOKEN`

**2. `docs/cli/issues.mdx` — Issue Commands**
- `looped issues` — List issues (with filters)
- `looped issues show <id>` — Show issue detail
- `looped issues create` — Create issue interactively
- `looped issues comment <id>` — Add comment
- Example output for each command

**3. `docs/cli/signals.mdx` — Signal Commands**
- `looped signal` — Submit a signal
- Required and optional flags
- Example with JSON output

**4. `docs/cli/triage.mdx` — Triage Commands**
- `looped triage` — Interactive triage workflow
- How triage relates to the signal -> issue flow
- Example session

**5. `docs/cli/templates.mdx` — Template Commands**
- `looped templates` — List templates
- `looped templates show <slug>` — Show template detail
- Template version management commands
- Example output

**6. `docs/cli/dispatch.mdx` — Dispatch Commands**
- `looped next` — Preview next dispatchable issue
- `looped dispatch` — Claim and dispatch
- Output format (issue + hydrated prompt)
- Example session

**7. `docs/cli/status.mdx` — Status Commands**
- `looped status` — System overview
- `looped projects` — List projects
- `looped goals` — List goals
- Example output

Content source: `apps/cli/src/commands/*.ts` for accurate command signatures and flags.

**Acceptance Criteria:**
- [ ] All 7 MDX files created in `docs/cli/`
- [ ] Each command documented with usage, flags, examples, and sample output
- [ ] Command signatures match actual CLI implementation
- [ ] Pages build without errors

**Dependencies:** Task 2.1

---

## Phase 5: Guides, Integrations, Operations

### Task 5.1: Write Guides section (2 pages)

**Objective:** Create the two guide pages for dashboard usage and template authoring.

**Pages:**

**1. `docs/guides/dashboard.mdx` — Dashboard Tour**
- 5 views: Issue List, Issue Detail, Activity Timeline, Goals Dashboard, Prompt Health
- Keyboard shortcuts: `g+i` Issues, `g+a` Activity, `g+g` Goals, `g+p` Prompts, `Cmd+B` Toggle sidebar, `?` Help
- Filters and search capabilities
- Dark mode only design
- Screenshots or descriptions of each view

**2. `docs/guides/writing-templates.mdx` — Writing Templates**
- Handlebars syntax basics (`{{variable}}`, `{{#if}}`, `{{#each}}`)
- Available template variables: `issue.*`, `parent.*`, `children`, `labels`, `project.*`, `goal.*`
- Shared partials: `{{> api_reference}}`, `{{> review_instructions}}`, `{{> parent_context}}`
- Conditions object fields: `{ type, signalSource, labels, projectId, hasFailedSessions, hypothesisConfidence }`
- Specificity scoring (0-100): how conditions affect template matching
- Worked example: creating a custom template for a specific project
- `<Callout type="tip">` for best practices

Content sources: `meta/loop-mvp.md` for template details, `apps/api/src/lib/` for template engine implementation.

**Acceptance Criteria:**
- [ ] Both MDX files created in `docs/guides/`
- [ ] Dashboard page covers all 5 views and keyboard shortcuts
- [ ] Templates page includes Handlebars examples, variables, conditions, specificity
- [ ] Pages build without errors

**Dependencies:** Task 2.1

---

### Task 5.2: Write Integrations section (4 pages)

**Objective:** Create the four integration pages documenting webhook setup for each provider.

**Pages:**

**1. `docs/integrations/index.mdx` — Integration Overview**
- What integrations are (webhook-based signal sources)
- Supported providers: GitHub, Sentry, PostHog
- General webhook flow: provider sends event -> Loop ingests as signal -> creates triage issue
- `<Cards>` linking to each provider page

**2. `docs/integrations/github.mdx` — GitHub Webhook**
Using `<Steps>`:
1. Go to GitHub repo Settings > Webhooks > Add webhook
2. Set Payload URL: `https://api.looped.me/api/signals/github`
3. Set Content type: `application/json`
4. Set Secret: your `GITHUB_WEBHOOK_SECRET`
5. Select events (push, pull_request, issues, etc.)

- HMAC-SHA256 verification details
- Supported events and how they map to Loop signals
- Example payload and resulting triage issue
- `<Callout type="warning">` for secret rotation

**3. `docs/integrations/sentry.mdx` — Sentry Webhook**
Using `<Steps>`:
1. Sentry project Settings > Integrations > Webhooks
2. Set URL: `https://api.looped.me/api/signals/sentry`
3. Configure `SENTRY_CLIENT_SECRET`

- Error alert mapping to signals
- Severity mapping (Sentry level -> Loop severity)
- Example payload

**4. `docs/integrations/posthog.mdx` — PostHog Webhook**
Using `<Steps>`:
1. PostHog project Settings > Actions > Webhooks
2. Set URL: `https://api.looped.me/api/signals/posthog`
3. Configure `POSTHOG_WEBHOOK_SECRET`

- Metric alert mapping to signals
- Shared secret verification
- Example payload

Content source: `apps/api/src/routes/webhooks.ts` for exact verification logic and payload mapping.

**Acceptance Criteria:**
- [ ] All 4 MDX files created in `docs/integrations/`
- [ ] Each provider page has step-by-step setup with `<Steps>`
- [ ] HMAC/secret verification explained for each
- [ ] Example payloads included
- [ ] Pages build without errors

**Dependencies:** Task 2.1

---

### Task 5.3: Write Self-Hosting section (3 pages)

**Objective:** Create the three self-hosting pages for deploying Loop independently.

**Pages:**

**1. `docs/self-hosting/index.mdx` — Self-Hosting Overview**
- What self-hosting means for Loop
- System requirements: Node.js 20+, PostgreSQL 15+
- Architecture overview: API server + PostgreSQL database
- Deployment options: Vercel (recommended), manual

**2. `docs/self-hosting/environment.mdx` — Environment Variables**
Complete reference table for all env vars:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string |
| `LOOP_API_KEY` | Yes | Bearer token for API authentication |
| `GITHUB_WEBHOOK_SECRET` | For webhooks | GitHub HMAC secret |
| `SENTRY_CLIENT_SECRET` | For webhooks | Sentry HMAC secret |
| `POSTHOG_WEBHOOK_SECRET` | For webhooks | PostHog shared secret |

App env vars:
| `VITE_API_URL` | No | API base URL (defaults `http://localhost:4242`) |
| `VITE_LOOP_API_KEY` | Yes | Dashboard API key |

- How to generate secure API keys
- `<Callout type="warning">` for never committing secrets

**3. `docs/self-hosting/deployment.mdx` — Deployment Guide**
- Vercel deployment (recommended):
  - Import monorepo
  - Configure root directory for each app
  - Set env vars in Vercel dashboard
  - Deploy
- Manual deployment:
  - Build: `npm run build`
  - Run: `node apps/api/dist/index.js`
  - Database: Neon setup or self-hosted PostgreSQL
  - Migrations: `npm run db:migrate -w apps/api`

Content source: `CLAUDE.md` for env vars and commands.

**Acceptance Criteria:**
- [ ] All 3 MDX files created in `docs/self-hosting/`
- [ ] Complete env var reference table
- [ ] Both Vercel and manual deployment paths documented
- [ ] Pages build without errors

**Dependencies:** Task 2.1

---

### Task 5.4: Write Contributing page

**Objective:** Create the contributing guide for developers.

**Implementation:**

Create `docs/contributing/index.mdx` with:

- Development setup:
  - Clone repo, install deps
  - Environment setup (`.env` from `.env.example`)
  - Start dev server (`npm run dev`)
- Testing:
  - Vitest for all tests
  - PGlite for in-memory PostgreSQL (no external DB needed)
  - `withTestDb()` helper for test isolation
  - Run tests: `npm test`, single file: `npx vitest run <path>`
- Code quality:
  - ESLint 9 + Prettier
  - `npm run lint`, `npm run format`
  - Pre-commit hooks
- Architecture Decision Records:
  - ADR format (Michael Nygard)
  - Location: `decisions/` directory
  - Status flow: proposed -> accepted -> deprecated/superseded
- Monorepo structure overview
- PR guidelines

Content source: `CLAUDE.md` for commands and structure.

**Acceptance Criteria:**
- [ ] `docs/contributing/index.mdx` created
- [ ] Dev setup, testing, code quality, ADR sections included
- [ ] PGlite testing approach documented
- [ ] Page builds without errors

**Dependencies:** Task 2.1

---

## Phase 6: Verification

### Task 6.1: Build verification and final review

**Objective:** Verify the entire documentation builds correctly and all pages render properly.

**Steps:**

1. Run `npm run docs:export-api` — verify OpenAPI spec generation
2. Run `npm run generate:api-docs -w apps/web` — verify API docs generation
3. Run `npm run build -w apps/web` — verify full build succeeds
4. Run `npm run typecheck` — verify no type errors
5. Run OpenAPI registry tests: `npx vitest run apps/api/src/__tests__/openapi-registry.test.ts`
6. Manual verification:
   - All sidebar sections appear in correct order
   - All pages render without errors
   - Code examples are syntactically correct
   - No broken links between pages
   - No real credentials in any examples

**Acceptance Criteria:**
- [ ] Full build succeeds without errors
- [ ] All tests pass
- [ ] All 8 sections visible in sidebar
- [ ] All ~35 pages render correctly
- [ ] No real credentials in examples
- [ ] Quickstart tutorial is completable in 5 minutes

**Dependencies:** All previous tasks

---

## Dependency Graph

```
Phase 1 (OpenAPI):
  1.1 → 1.2 → 1.3 → 1.5
                1.4 (parallel with 1.3, depends on 1.2)

Phase 2 (Infrastructure):
  2.1 (independent of Phase 1)
  2.2 → depends on 2.1

Phase 3 (Core Pages):
  3.1, 3.2 → depend on 2.1

Phase 4 (Reference):
  4.1 → depends on 1.5 and 2.1
  4.2 → depends on 2.1

Phase 5 (Guides/Integrations/Ops):
  5.1, 5.2, 5.3, 5.4 → depend on 2.1

Phase 6 (Verification):
  6.1 → depends on ALL previous tasks
```

## Parallel Execution Opportunities

- Phase 1 (1.1-1.5) and Phase 2 (2.1) can start in parallel
- Tasks 3.1, 3.2, 4.2, 5.1, 5.2, 5.3, 5.4 can all run in parallel (all depend only on 2.1)
- Task 4.1 must wait for both 1.5 and 2.1
- Task 6.1 is the final gate task
