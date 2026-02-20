---
slug: prompt-dispatch-engine
number: 3
created: 2026-02-20
status: draft
---

# Specification: Prompt & Dispatch Engine (MVP Phase 2)

**Status:** Draft
**Author:** Claude Code
**Date:** 2026-02-20
**Ideation:** `specs/prompt-dispatch-engine/01-ideation.md`
**Phase 1 Spec:** `specs/data-layer-core-api/02-specification.md`

---

## Overview

Build Loop's core differentiator: the prompt engine and dispatch system. This adds the intelligence layer on top of the Phase 1 data layer, enabling agents to pull prioritized work with fully hydrated prompt instructions. The system selects the right prompt template based on issue context, renders it with Handlebars, scores issues by priority, and dispatches work via a pull-based API. A self-improving feedback loop auto-creates improvement issues when prompt quality degrades.

---

## Background / Problem Statement

Phase 1 established the data foundation: 11 database tables, CRUD endpoints for all entities, signal ingestion, and webhook handlers. However, the system cannot yet answer the core question: "What should an agent work on next, and how should it do it?"

Without Phase 2:
- There is no way for agents to pull work (no dispatch endpoint)
- Prompt templates exist in the schema but have no selection or hydration logic
- There is no priority scoring to determine which issue to work on first
- Prompt reviews are stored but don't trigger any feedback loop

Phase 2 transforms Loop from a data store into an autonomous work dispatch system.

---

## Goals

- Implement deterministic template selection based on issue context and conditions-based matching with specificity ordering
- Hydrate templates with full system state using Handlebars, including shared partials
- Build atomic dispatch endpoint that prevents double-claiming via `FOR UPDATE SKIP LOCKED`
- Add priority scoring that considers priority level, goal alignment, age, and issue type
- Enhance prompt reviews with EWMA scoring and automatic improvement issue creation
- Seed 5 substantive default templates (one per issue type) via migration
- Provide queue preview and template preview endpoints for debugging

## Non-Goals

- React dashboard (Phase 3)
- CLI tool (Phase 4)
- Auto-promote prompt versions (post-MVP)
- Multi-tenant auth / user management
- AI/ML-based template selection (this is deterministic logic)
- Prompt template editing UX
- Agent identity / per-instance API keys

---

## Technical Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| `handlebars` | `^4.7.0` (>= 4.6.0 required for prototype pollution protection) | Template hydration |
| `drizzle-orm` | `^0.45.1` (existing) | Database queries, raw SQL for `FOR UPDATE SKIP LOCKED` |
| `@neondatabase/serverless` | `^1.0.2` (existing) | Transaction support via Pool driver |
| `zod` | `^4.3.6` (existing) | Conditions schema validation |
| `hono` | `^4` (existing) | Route handlers |

No new infrastructure. No AI runtime. No queue system.

---

## Detailed Design

### Architecture Overview

```
Agent polls GET /api/dispatch/next
  │
  ▼
┌─────────────────────────────────┐
│  1. Filter: status='todo',      │
│     not deleted, not blocked    │
│  2. Score: priority + goal +    │
│     age + type weights          │
│  3. Claim: FOR UPDATE SKIP     │
│     LOCKED → in_progress        │
├─────────────────────────────────┤
│  4. Select template:            │
│     conditions match + sort     │
│     by specificity              │
│  5. Hydrate: Handlebars +       │
│     full context + partials     │
├─────────────────────────────────┤
│  6. Return: issue + prompt +    │
│     meta                        │
└─────────────────────────────────┘
  │
  ▼
Agent executes work, then POST /api/prompt-reviews
  │
  ▼
┌─────────────────────────────────┐
│  EWMA score update              │
│  Threshold check → auto-create  │
│  improvement issue if degraded  │
└─────────────────────────────────┘
```

### File Organization

**New files:**

| File | Purpose | Size Est. |
|------|---------|-----------|
| `apps/api/src/lib/prompt-engine.ts` | Template selection + Handlebars hydration + context assembly | ~200 lines |
| `apps/api/src/lib/priority-scoring.ts` | Priority scoring pure function + constants | ~80 lines |
| `apps/api/src/lib/partials.ts` | Handlebars partial registration + content | ~150 lines |
| `apps/api/src/routes/dispatch.ts` | Dispatch + queue + preview endpoints | ~250 lines |
| `apps/api/drizzle/migrations/0002_seed_default_templates.sql` | Custom migration seeding 5 templates + versions | ~200 lines |
| `apps/api/src/__tests__/prompt-engine.test.ts` | Unit tests for selection + hydration | ~200 lines |
| `apps/api/src/__tests__/priority-scoring.test.ts` | Unit tests for scoring | ~100 lines |
| `apps/api/src/__tests__/dispatch.test.ts` | Integration tests for dispatch endpoints | ~300 lines |

**Modified files:**

| File | Changes |
|------|---------|
| `apps/api/package.json` | Add `handlebars` dependency |
| `apps/api/src/app.ts` | Mount `dispatchRoutes` on `/api/dispatch`, mount template preview route |
| `apps/api/src/routes/templates.ts` | Replace `z.record(z.string(), z.unknown())` with strict `TemplateConditionsSchema` |
| `apps/api/src/routes/prompt-reviews.ts` | Replace simple average with EWMA, add improvement loop trigger |

---

### Component 1: Priority Scoring

**File:** `apps/api/src/lib/priority-scoring.ts`

Pure function with zero dependencies. Exported for direct unit testing.

#### Constants

```typescript
/** Priority level → score weight */
export const PRIORITY_WEIGHTS: Record<number, number> = {
  1: 100, // urgent
  2: 75,  // high
  3: 50,  // medium
  4: 25,  // low
  0: 10,  // none
}

/** Issue type → score bonus */
export const TYPE_WEIGHTS: Record<string, number> = {
  signal: 50,
  hypothesis: 40,
  plan: 30,
  task: 20,
  monitor: 10,
}

/** Bonus when issue's project has an active goal */
export const GOAL_ALIGNMENT_BONUS = 20

/** Score increase per day in todo status */
export const AGE_BONUS_PER_DAY = 1
```

#### Function Signature

```typescript
export interface ScoreBreakdown {
  priorityWeight: number
  goalAlignmentBonus: number
  ageBonus: number
  typeBonus: number
  total: number
}

export interface ScoringInput {
  priority: number
  type: string
  createdAt: Date
  hasActiveGoal: boolean
}

/** Compute deterministic priority score for an issue. */
export function scoreIssue(input: ScoringInput): ScoreBreakdown
```

#### Logic

```
priorityWeight = PRIORITY_WEIGHTS[input.priority] ?? 10
typeBonus = TYPE_WEIGHTS[input.type] ?? 0
goalAlignmentBonus = input.hasActiveGoal ? GOAL_ALIGNMENT_BONUS : 0
ageBonus = Math.floor((Date.now() - input.createdAt.getTime()) / 86_400_000) * AGE_BONUS_PER_DAY
total = priorityWeight + typeBonus + goalAlignmentBonus + ageBonus
```

Return `{ priorityWeight, goalAlignmentBonus, ageBonus, typeBonus, total }`.

---

### Component 2: Template Selection

**File:** `apps/api/src/lib/prompt-engine.ts`

Pure function for matching. Separate function for context assembly (requires DB).

#### Types

```typescript
/** Validated condition keys stored in template.conditions JSONB */
export interface TemplateConditions {
  type?: string
  signalSource?: string
  labels?: string[]
  projectId?: string
  hasFailedSessions?: boolean
  hypothesisConfidence?: number
}

/** Context built from an issue for template matching */
export interface IssueContext {
  type: string
  signalSource: string | null
  labels: string[]
  projectId: string | null
  hasFailedSessions: boolean
  hypothesisConfidence: number | null
}
```

#### Zod Schema for Conditions Validation

```typescript
import { issueTypeValues } from '../db/schema'

export const TemplateConditionsSchema = z.object({
  type: z.enum(issueTypeValues).optional(),
  signalSource: z.string().optional(),
  labels: z.array(z.string()).optional(),
  projectId: z.string().optional(),
  hasFailedSessions: z.boolean().optional(),
  hypothesisConfidence: z.number().min(0).max(1).optional(),
}).strict()
```

This replaces the current `z.record(z.string(), z.unknown()).default({})` in `templates.ts`.

#### Selection Algorithm

```typescript
export function matchesConditions(
  conditions: TemplateConditions,
  context: IssueContext
): boolean
```

For each key in `conditions`:
- `type`: exact match against `context.type`
- `signalSource`: exact match against `context.signalSource` (null context = no match)
- `labels`: every label in `conditions.labels` must exist in `context.labels`
- `projectId`: exact match against `context.projectId` (null context = no match)
- `hasFailedSessions`: exact match against `context.hasFailedSessions`
- `hypothesisConfidence`: match if `context.hypothesisConfidence >= conditions.hypothesisConfidence`

Empty conditions `{}` matches everything.

```typescript
export interface TemplateCandidate {
  id: string
  slug: string
  conditions: TemplateConditions
  specificity: number
  projectId: string | null
  activeVersionId: string | null
}

export function selectTemplate(
  templates: TemplateCandidate[],
  context: IssueContext
): TemplateCandidate | null
```

1. Filter to templates where `matchesConditions(template.conditions, context)` is true
2. Filter to templates with a non-null `activeVersionId`
3. Sort by: templates where `template.projectId === context.projectId` first, then by `specificity` descending
4. Return first match, or `null`

**Fallback:** If `selectTemplate` returns null, caller falls back to the default template for the issue type by querying for a template with `conditions = { "type": "<issueType>" }`.

---

### Component 3: Context Assembly & Hydration

**File:** `apps/api/src/lib/prompt-engine.ts`

#### Context Assembly

```typescript
export interface HydrationContext {
  issue: Record<string, unknown>
  parent: Record<string, unknown> | null
  siblings: Record<string, unknown>[]
  children: Record<string, unknown>[]
  project: Record<string, unknown> | null
  goal: Record<string, unknown> | null
  labels: Array<{ name: string; color: string }>
  blocking: Array<{ number: number; title: string }>
  blockedBy: Array<{ number: number; title: string }>
  previousSessions: Array<{ status: string; agentSummary: string | null }>
  loopUrl: string
  loopToken: string
  meta: {
    templateId: string
    templateSlug: string
    versionId: string
    versionNumber: number
  }
}

/** Assemble full context for Handlebars hydration. */
export async function buildHydrationContext(
  db: AnyDb,
  issue: typeof issues.$inferSelect,
  template: { id: string; slug: string },
  version: { id: string; version: number }
): Promise<HydrationContext>
```

**Queries to execute (in parallel where possible):**

1. **Parent:** `db.select().from(issues).where(eq(issues.id, issue.parentId))` (if parentId set)
2. **Siblings:** `db.select().from(issues).where(and(eq(issues.parentId, issue.parentId), ne(issues.id, issue.id), isNull(issues.deletedAt)))` (if parentId set)
3. **Children:** `db.select().from(issues).where(and(eq(issues.parentId, issue.id), isNull(issues.deletedAt)))` (if no parentId — root issue)
4. **Project:** `db.select().from(projects).where(eq(projects.id, issue.projectId))` (if projectId set)
5. **Goal:** `db.select().from(goals).where(eq(goals.projectId, project.id))` (if project found)
6. **Labels:** Join `issueLabels` + `labels` where `issueLabels.issueId = issue.id`
7. **Blocking:** Join `issueRelations` (type='blocks', issueId=issue.id) + lookup related issues
8. **BlockedBy:** Join `issueRelations` (type='blocked_by', issueId=issue.id) + lookup related issues
9. **Previous sessions:** For MVP, extract from the issue itself (`agentSessionId`, `agentSummary`) — if `agentSummary` is non-null and status was previously set, include it as a session entry. Future versions may track multiple sessions.

**Environment values:**
- `loopUrl`: `process.env.LOOP_URL ?? 'http://localhost:4242'` (new optional env var)
- `loopToken`: `process.env.LOOP_API_KEY`

#### Handlebars Setup

```typescript
import Handlebars from 'handlebars'

/** Compiled template cache, keyed by version ID */
const templateCache = new Map<string, HandlebarsTemplateDelegate>()

/** Register shared partials and helpers. Call once at module load. */
export function initHandlebars(): void
```

**Initialization (called once at module load):**
1. Register all 5 shared partials via `Handlebars.registerPartial(name, content)`
2. Register `json` helper: `Handlebars.registerHelper('json', (ctx) => JSON.stringify(ctx, null, 2))`
3. Register `priority_label` helper: maps priority int to human label

**Compilation with caching:**
```typescript
export function compileTemplate(versionId: string, content: string): HandlebarsTemplateDelegate {
  const cached = templateCache.get(versionId)
  if (cached) return cached
  const compiled = Handlebars.compile(content, { strict: false, noEscape: true })
  templateCache.set(versionId, compiled)
  return compiled
}
```

Note: `strict: false` because templates should render gracefully when optional context is missing (e.g., no parent, no goal). `noEscape: true` because prompts are plain text for agents, not HTML — escaping would corrupt the output.

**Hydration:**
```typescript
export function hydrateTemplate(
  versionId: string,
  content: string,
  context: HydrationContext
): string {
  const compiled = compileTemplate(versionId, content)
  return compiled(context)
}
```

#### Content Validation

When creating or updating template versions, validate content does NOT contain triple-braces `{{{`:

```typescript
if (content.includes('{{{')) {
  throw new HTTPException(422, {
    message: 'Template content must not contain triple-braces ({{{...}}}). Use {{...}} instead.',
  })
}
```

---

### Component 4: Shared Partials

**File:** `apps/api/src/lib/partials.ts`

Exports a `Record<string, string>` of partial name → Handlebars content. Registered during `initHandlebars()`.

#### `api_reference` Partial

```handlebars
## Loop API Reference

Base URL: {{loopUrl}}
Auth: `Authorization: Bearer {{loopToken}}`

### Create Issue
```
curl -X POST {{loopUrl}}/api/issues \
  -H "Authorization: Bearer {{loopToken}}" \
  -H "Content-Type: application/json" \
  -d '{"title": "...", "type": "task", "parentId": "{{issue.parentId}}"}'
```

### Update Issue Status
```
curl -X PATCH {{loopUrl}}/api/issues/{{issue.id}} \
  -H "Authorization: Bearer {{loopToken}}" \
  -H "Content-Type: application/json" \
  -d '{"status": "done", "agentSummary": "..."}'
```

### Add Comment
```
curl -X POST {{loopUrl}}/api/issues/{{issue.id}}/comments \
  -H "Authorization: Bearer {{loopToken}}" \
  -H "Content-Type: application/json" \
  -d '{"body": "...", "authorName": "Agent", "authorType": "agent"}'
```

### Create Relation
```
curl -X POST {{loopUrl}}/api/issues/{{issue.id}}/relations \
  -H "Authorization: Bearer {{loopToken}}" \
  -H "Content-Type: application/json" \
  -d '{"type": "blocks", "relatedIssueId": "..."}'
```
```

#### `review_instructions` Partial

```handlebars
## After Completion

Rate the quality of these instructions:

```
curl -X POST {{loopUrl}}/api/prompt-reviews \
  -H "Authorization: Bearer {{loopToken}}" \
  -H "Content-Type: application/json" \
  -d '{
    "versionId": "{{meta.versionId}}",
    "issueId": "{{issue.id}}",
    "clarity": <1-5>,
    "completeness": <1-5>,
    "relevance": <1-5>,
    "feedback": "<what was missing, confusing, or unnecessary>"
  }'
```
```

#### `parent_context` Partial

```handlebars
{{#if parent}}
## Parent Issue
#{{parent.number}} [{{parent.type}}]: {{parent.title}}
{{#if parent.description}}
{{parent.description}}
{{/if}}
{{#if parent.hypothesis}}
Hypothesis: {{parent.hypothesis.statement}} (confidence: {{parent.hypothesis.confidence}})
Validation: {{parent.hypothesis.validationCriteria}}
{{/if}}
{{/if}}
```

#### `sibling_context` Partial

```handlebars
{{#if siblings.length}}
## Sibling Issues
{{#each siblings}}
- #{{this.number}} [{{this.status}}]: {{this.title}}
{{/each}}
{{/if}}
```

#### `project_and_goal_context` Partial

```handlebars
{{#if project}}
## Project
{{project.name}}
{{#if project.description}}
{{project.description}}
{{/if}}
{{#if goal}}
### Goal
{{goal.title}}
Progress: {{goal.currentValue}}{{goal.unit}} / {{goal.targetValue}}{{goal.unit}}
Status: {{goal.status}}
{{/if}}
{{/if}}
```

---

### Component 5: Dispatch Endpoints

**File:** `apps/api/src/routes/dispatch.ts`

#### `GET /api/dispatch/next`

**Query params (all optional):**
- `project` (string) — Filter to a specific project ID

**Flow:**

1. Get `db` from Hono context
2. Begin a database transaction
3. Inside the transaction, execute raw SQL to find and claim the highest-priority unblocked issue:

```sql
WITH unblocked AS (
  SELECT i.id
  FROM issues i
  WHERE i.status = 'todo'
    AND i.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM issue_relations ir
      JOIN issues blocker ON blocker.id = ir.related_issue_id
      WHERE ir.issue_id = i.id
        AND ir.type = 'blocked_by'
        AND blocker.status NOT IN ('done', 'canceled')
        AND blocker.deleted_at IS NULL
    )
    -- Optional project filter
    ${projectId ? sql`AND i.project_id = ${projectId}` : sql``}
  ORDER BY
    -- Priority scoring computed in SQL
    (CASE i.priority
      WHEN 1 THEN 100 WHEN 2 THEN 75 WHEN 3 THEN 50
      WHEN 4 THEN 25 ELSE 10 END)
    + (CASE WHEN EXISTS (
        SELECT 1 FROM projects p
        JOIN goals g ON g.project_id = p.id
        WHERE p.id = i.project_id AND g.status = 'active'
      ) THEN 20 ELSE 0 END)
    + (EXTRACT(EPOCH FROM (NOW() - i.created_at)) / 86400)::int
    + (CASE i.type
        WHEN 'signal' THEN 50 WHEN 'hypothesis' THEN 40
        WHEN 'plan' THEN 30 WHEN 'task' THEN 20
        WHEN 'monitor' THEN 10 ELSE 0 END)
    DESC
  LIMIT 1
  FOR UPDATE SKIP LOCKED
)
UPDATE issues SET status = 'in_progress', updated_at = NOW()
FROM unblocked
WHERE issues.id = unblocked.id
RETURNING issues.*
```

4. If no row returned: return `204 No Content`
5. Build `IssueContext` from the claimed issue
6. Fetch all non-deleted templates with active versions
7. Run `selectTemplate(templates, context)` — fall back to default for issue type if null
8. If no template found at all: return the issue with `prompt: null` and a warning in meta
9. Fetch the active version's content
10. Build `HydrationContext` via `buildHydrationContext(db, issue, template, version)`
11. Hydrate template: `hydrateTemplate(version.id, version.content, context)`
12. Increment version's `usageCount`: `UPDATE prompt_versions SET usage_count = usage_count + 1 WHERE id = version.id`
13. Return response:

```json
{
  "issue": {
    "id": "...",
    "number": 42,
    "title": "...",
    "type": "task",
    "priority": 2,
    "status": "in_progress",
    "description": "...",
    "project": { "id": "...", "name": "...", "status": "..." } | null,
    "parent": { "id": "...", "number": 38, "title": "...", "type": "plan" } | null,
    "labels": [{ "name": "...", "color": "..." }],
    "blockedBy": [],
    "blocking": [{ "number": 45, "title": "..." }],
    "previousSessions": []
  },
  "prompt": "<fully hydrated prompt string>",
  "meta": {
    "templateSlug": "task-execution",
    "templateId": "...",
    "versionId": "...",
    "versionNumber": 5,
    "reviewUrl": "POST /api/prompt-reviews"
  }
}
```

#### `GET /api/dispatch/queue`

**Query params:**
- `project` (string, optional) — Filter to a specific project
- `limit` (number, 1-200, default 50)
- `offset` (number, default 0)

**Flow:**
1. Same filtering as `/next` (status='todo', not deleted, not blocked)
2. Score each issue using `scoreIssue()` from `priority-scoring.ts`
3. Sort by score descending
4. Apply pagination
5. Return:

```json
{
  "data": [
    {
      "issue": { "id", "number", "title", "type", "priority", "status", "projectId" },
      "score": 145,
      "breakdown": {
        "priorityWeight": 75,
        "goalAlignmentBonus": 20,
        "ageBonus": 0,
        "typeBonus": 50,
        "total": 145
      }
    }
  ],
  "total": 23
}
```

Note: Queue scoring can be done in application code (fetch all todo issues, score in JS, sort) rather than raw SQL, since this endpoint doesn't need `FOR UPDATE SKIP LOCKED`. Use Drizzle's query builder here.

#### `GET /api/templates/preview/:issueId`

**Flow:**
1. Fetch issue by ID (404 if not found or deleted)
2. Build `IssueContext` from issue
3. Fetch all non-deleted templates with active versions
4. Run `selectTemplate(templates, context)` with fallback
5. If no template: return `{ issue, template: null, version: null, prompt: null, message: "No matching template found" }`
6. Fetch version content, build hydration context, hydrate
7. Return:

```json
{
  "issue": { "id", "number", "title", "type" },
  "template": { "id", "slug", "name", "conditions", "specificity" },
  "version": { "id", "version": 5 },
  "prompt": "<hydrated prompt>"
}
```

---

### Component 6: Enhanced Prompt Reviews

**File:** `apps/api/src/routes/prompt-reviews.ts` (modify existing)

#### Current Behavior (Phase 1)

The endpoint currently computes `reviewScore` as a simple average across all reviews for a version using a subquery. This will be replaced.

#### New Behavior: EWMA Scoring

After inserting the review:

```typescript
const EWMA_ALPHA = 0.3
const REVIEW_SCORE_THRESHOLD = 3.5
const REVIEW_COUNT_THRESHOLD = 15
const REVIEW_MIN_SAMPLES = 3

// Compute composite score for this review
const composite = (review.clarity + review.completeness + review.relevance) / 3

// Fetch current version
const [version] = await db.select().from(promptVersions)
  .where(eq(promptVersions.id, review.versionId))

// EWMA update
const newScore = version.reviewScore === null
  ? composite
  : EWMA_ALPHA * composite + (1 - EWMA_ALPHA) * version.reviewScore

// Update version
await db.update(promptVersions)
  .set({ reviewScore: newScore })
  .where(eq(promptVersions.id, review.versionId))
```

#### Prompt Improvement Loop Trigger

After updating the score, check thresholds:

```typescript
// Count reviews for this version
const [{ count: reviewCount }] = await db
  .select({ count: count() })
  .from(promptReviews)
  .where(eq(promptReviews.versionId, review.versionId))

// Only check thresholds if minimum samples met
if (reviewCount >= REVIEW_MIN_SAMPLES) {
  const shouldCreateIssue =
    newScore < REVIEW_SCORE_THRESHOLD ||
    reviewCount >= REVIEW_COUNT_THRESHOLD

  if (shouldCreateIssue) {
    // Check if an improvement issue already exists for this version
    // (prevent duplicate improvement issues)
    // Look for existing open issue with title matching this template
    const template = await db.select().from(promptTemplates)
      .where(eq(promptTemplates.id, version.templateId))

    // Auto-create improvement issue
    await db.insert(issues).values({
      title: `Improve prompt template: ${template.slug} (avg review ${newScore.toFixed(1)}/5, ${reviewCount} reviews since v${version.version})`,
      type: 'task',
      status: 'todo',
      priority: 3, // medium
      description: buildImprovementDescription(template, version, newScore, reviewCount),
    })

    // Create/find labels "prompt-improvement" and "meta", link to issue
    // (use INSERT ... ON CONFLICT DO NOTHING for label creation)
  }
}
```

**Duplicate prevention:** Before creating, check if an open (not done/canceled) improvement issue already exists for this template. Skip creation if so.

---

### Component 7: Default Template Seeding

**File:** `apps/api/drizzle/migrations/0002_seed_default_templates.sql`

Generate via `npx drizzle-kit generate --custom` to create an empty migration file, then populate with seed SQL.

#### Template IDs (stable, hard-coded)

```
Template IDs:
  signal-triage:         tpl_default_signal_triage
  hypothesis-planning:   tpl_default_hypothesis_planning
  task-execution:        tpl_default_task_execution
  plan-decomposition:    tpl_default_plan_decomposition
  monitor-check:         tpl_default_monitor_check

Version IDs:
  signal-triage v1:      ver_default_signal_triage_v1
  hypothesis-planning v1: ver_default_hypothesis_planning_v1
  task-execution v1:     ver_default_task_execution_v1
  plan-decomposition v1: ver_default_plan_decomposition_v1
  monitor-check v1:      ver_default_monitor_check_v1
```

#### Migration SQL Structure

For each of the 5 templates:

```sql
INSERT INTO prompt_templates (id, slug, name, description, conditions, specificity, active_version_id, created_at, updated_at)
VALUES (
  'tpl_default_signal_triage',
  'signal-triage',
  'Signal Triage',
  'Default template for triaging incoming signals. Analyzes the signal, determines if actionable, and creates a hypothesis if warranted.',
  '{"type": "signal"}',
  10,
  'ver_default_signal_triage_v1',
  NOW(), NOW()
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO prompt_versions (id, template_id, version, content, changelog, author_type, author_name, status, usage_count, created_at)
VALUES (
  'ver_default_signal_triage_v1',
  'tpl_default_signal_triage',
  1,
  E'<full Handlebars template content here — see MVP doc signal-triage template>',
  'Initial default template',
  'human',
  'system',
  'active',
  0,
  NOW()
)
ON CONFLICT DO NOTHING;
```

**Template content** for each of the 5 templates comes directly from the MVP doc's "Default Prompt Templates" section (lines 902-1065). Each template includes:
- Issue-type-specific instructions
- Appropriate partial references (`{{> api_reference}}`, `{{> review_instructions}}`, etc.)
- Conditional sections for context (previous sessions, parent, siblings, goal)

The actual Handlebars content is specified in the MVP doc and should be used verbatim, with minor formatting adjustments for SQL escaping (single quotes escaped as `''`, backslashes as `\\`).

---

### Component 8: Conditions Validation Update

**File:** `apps/api/src/routes/templates.ts` (modify existing)

Replace the current conditions validation:

```typescript
// BEFORE (Phase 1):
conditions: z.record(z.string(), z.unknown()).default({})

// AFTER (Phase 2):
conditions: TemplateConditionsSchema.default({})
```

Import `TemplateConditionsSchema` from `../lib/prompt-engine`.

Apply to both `createTemplateSchema` and `updateTemplateSchema`.

---

### Component 9: Route Mounting

**File:** `apps/api/src/app.ts`

Add to the authenticated API group:

```typescript
import { dispatchRoutes } from './routes/dispatch'

// Inside the api.use('*', ...) authenticated block:
api.route('/dispatch', dispatchRoutes)
```

The template preview endpoint (`GET /api/templates/preview/:issueId`) should be added to the existing `templateRoutes` in `templates.ts` since it's template-related, or to `dispatchRoutes` since it uses the same selection logic. Recommendation: add to `dispatchRoutes` as `GET /preview/:issueId` and mount at `/api/dispatch`, making the full path `/api/dispatch/preview/:issueId`. This keeps all dispatch-related logic (next, queue, preview) together.

Alternative: mount directly on the `api` group as `/api/templates/preview/:issueId` per the MVP doc. This is the preferred approach since the MVP doc specifies this path. Add the route to `templateRoutes`:

```typescript
// In templates.ts, add:
templateRoutes.get('/preview/:issueId', async (c) => { ... })
```

---

## API Endpoints (New)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/dispatch/next` | Claim highest-priority unblocked issue + hydrated prompt | Bearer |
| `GET` | `/api/dispatch/queue` | Preview dispatch queue with scores (no claim) | Bearer |
| `GET` | `/api/templates/preview/:issueId` | Preview template selection + hydration for an issue | Bearer |

**Modified endpoints:**

| Method | Path | Change |
|--------|------|--------|
| `POST` | `/api/prompt-reviews` | EWMA scoring + improvement loop trigger |
| `POST` | `/api/templates` | Strict conditions validation |
| `PATCH` | `/api/templates/:id` | Strict conditions validation |

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LOOP_URL` | No | `http://localhost:4242` | Base URL for API references in hydrated prompts |

All existing env vars remain unchanged. `LOOP_URL` is new but optional — only affects the `loopUrl` variable injected into templates.

---

## Testing Strategy

### Unit Tests: Priority Scoring (`priority-scoring.test.ts`)

Pure function tests, no DB required.

- **Score calculation correctness:** Given priority=2 (high), type='signal', hasActiveGoal=true, created 3 days ago → verify exact score breakdown (75 + 50 + 20 + 3 = 148)
- **Priority weight mapping:** Test all 5 priority levels produce correct weights
- **Type weight mapping:** Test all 5 issue types produce correct bonuses
- **Unknown priority/type:** Verify fallback to default weights (10 and 0)
- **Age bonus accumulation:** Verify +1 per day, test with 0 days (just created), 30 days, 365 days
- **Goal alignment:** With and without active goal

### Unit Tests: Template Selection (`prompt-engine.test.ts`)

Pure function tests for `matchesConditions` and `selectTemplate`.

- **Empty conditions match everything:** `{}` matches any context
- **Single condition match:** `{ type: "signal" }` matches signal, not task
- **Multiple conditions (AND):** `{ type: "signal", signalSource: "posthog" }` requires both
- **Labels condition:** `{ labels: ["frontend"] }` matches context with `["frontend", "urgent"]` but not `["backend"]`
- **Null context fields:** `signalSource: null` does not match `{ signalSource: "posthog" }`
- **Specificity ordering:** Higher specificity wins when multiple templates match
- **Project-specific first:** Template with matching projectId wins over higher-specificity generic template
- **Fallback to default:** When no specific template matches, returns null (caller handles default lookup)
- **No active version:** Template without activeVersionId is filtered out

### Unit Tests: Handlebars Hydration (`prompt-engine.test.ts`)

- **Variable injection:** `{{issue.title}}` renders correctly
- **Conditional sections:** `{{#if parent}}` renders only when parent exists
- **Each loops:** `{{#each siblings}}` iterates correctly
- **JSON helper:** `{{json issue.signalPayload}}` renders formatted JSON
- **Partial rendering:** `{{> api_reference}}` injects partial content
- **Missing optional context:** Template renders without error when parent/goal/siblings are null/empty
- **Cache hit:** Calling `compileTemplate` twice with same versionId returns cached result

### Integration Tests: Dispatch Endpoints (`dispatch.test.ts`)

Using `withTestDb()` and `createTestApp()` from test infrastructure.

- **`GET /dispatch/next` — happy path:**
  - Seed 3 issues with different priorities (status='todo')
  - Call dispatch/next
  - Verify highest-priority issue returned with status='in_progress'
  - Verify prompt is hydrated (non-empty string)
  - Verify meta contains templateSlug, versionId, etc.

- **`GET /dispatch/next` — no eligible issues:**
  - Seed issues with status='done' and 'in_progress' only
  - Call dispatch/next → verify 204 No Content

- **`GET /dispatch/next` — blocked issue excluded:**
  - Seed issue A (todo) blocked by issue B (todo)
  - Seed issue C (todo, lower priority, unblocked)
  - Call dispatch/next → verify C is returned, not A

- **`GET /dispatch/next` — blocked by done issue not excluded:**
  - Seed issue A (todo) blocked by issue B (done)
  - Call dispatch/next → verify A is returned (B is done, so not actually blocking)

- **`GET /dispatch/next` — project filter:**
  - Seed issues in different projects
  - Call dispatch/next?project=X → verify only project X issues considered

- **`GET /dispatch/next` — soft-deleted excluded:**
  - Seed a soft-deleted todo issue
  - Call dispatch/next → verify 204 (not dispatched)

- **`GET /dispatch/next` — template selection and hydration:**
  - Seed a signal issue + the default signal-triage template
  - Call dispatch/next → verify prompt contains signal-specific instructions

- **`GET /dispatch/next` — no matching template:**
  - Delete all templates, seed an issue
  - Call dispatch/next → verify issue returned with prompt=null

- **`GET /dispatch/queue` — returns scored list:**
  - Seed 5 issues with varying priorities
  - Call dispatch/queue → verify sorted by score descending
  - Verify score breakdown included

- **`GET /dispatch/queue` — pagination:**
  - Seed 10 issues, request limit=3, offset=0, then offset=3
  - Verify correct items and total count

- **`GET /templates/preview/:issueId` — happy path:**
  - Seed an issue + matching template
  - Call preview → verify template selected and prompt hydrated

- **`GET /templates/preview/:issueId` — issue not found:**
  - Call with non-existent ID → verify 404

### Integration Tests: Enhanced Prompt Reviews (`dispatch.test.ts` or separate)

- **EWMA score update:**
  - Create template + version + issue
  - Submit review (clarity=4, completeness=5, relevance=3) → composite = 4.0
  - Verify version.reviewScore = 4.0 (first review, set directly)
  - Submit second review (clarity=2, completeness=2, relevance=2) → composite = 2.0
  - Verify version.reviewScore = 0.3 * 2.0 + 0.7 * 4.0 = 3.4

- **Improvement issue auto-creation:**
  - Submit 3 reviews with low scores (all 2/5)
  - Verify an improvement issue was created with type='task', title containing template slug
  - Verify issue is in 'todo' status (enters dispatch queue)

- **Duplicate prevention:**
  - Trigger improvement issue creation
  - Submit another low review
  - Verify no second improvement issue created

- **Min samples respected:**
  - Submit 1 low review (score=1.0)
  - Verify no improvement issue created (below REVIEW_MIN_SAMPLES=3)

---

## Performance Considerations

| Area | Strategy | Impact |
|------|----------|--------|
| Template compilation | `Map<versionId, compiled>` cache — compile once per version per process lifetime | Eliminates re-compilation on every dispatch |
| Dispatch query | Single SQL query with `FOR UPDATE SKIP LOCKED` — scoring computed in SQL, not application code | One round-trip, atomic claim |
| Partial index | `CREATE INDEX idx_issues_dispatch ON issues (status, priority, created_at) WHERE deleted_at IS NULL AND status = 'todo'` | Keeps dispatch query fast as table grows |
| Template selection | In-memory pure function after single fetch — O(n) where n = template count | Negligible for < 1000 templates |
| EWMA scoring | Single UPDATE per review, O(1) compute | No aggregation queries needed |
| Context assembly | Parallel queries via `Promise.all` for independent lookups | Reduces latency for context building |

**Performance index:** Consider adding a partial index for dispatch queries. This can be added as a follow-up migration if query performance becomes an issue — not required for MVP launch since the table will be small.

---

## Security Considerations

| Risk | Mitigation |
|------|------------|
| Server-Side Template Injection (SSTI) | Templates are authored by trusted humans/agents in the DB. Content validated on write. Triple-braces `{{{` banned via validation. |
| Prototype pollution | Handlebars >= 4.6.0 (pinned) disables prototype property access by default. Never enable `allowProtoPropertiesByDefault`. |
| Race condition in dispatch | `FOR UPDATE SKIP LOCKED` at PostgreSQL level prevents double-claiming. |
| Condition schema injection | `TemplateConditionsSchema` with `.strict()` rejects unknown keys. |
| Threshold manipulation | `EWMA_ALPHA`, `REVIEW_SCORE_THRESHOLD`, `REVIEW_COUNT_THRESHOLD`, `REVIEW_MIN_SAMPLES` are code constants, not DB-configurable. |
| API token in prompts | `loopToken` is injected into hydrated prompts so agents can call back. This is intentional — the same token is already required for dispatch. Tokens should be scoped per-environment. |

---

## Implementation Phases

### Phase A: Pure Functions + Dependencies

1. Add `handlebars` to `apps/api/package.json`
2. Implement `priority-scoring.ts` with all constants and `scoreIssue()`
3. Implement template selection in `prompt-engine.ts`: types, `TemplateConditionsSchema`, `matchesConditions()`, `selectTemplate()`
4. Write unit tests for both (`priority-scoring.test.ts`, `prompt-engine.test.ts`)

**Verification:** All unit tests pass. No DB or routes involved yet.

### Phase B: Handlebars + Partials

1. Implement `partials.ts` with all 5 partial contents
2. Implement Handlebars setup in `prompt-engine.ts`: `initHandlebars()`, `compileTemplate()`, `hydrateTemplate()`
3. Implement `buildHydrationContext()` (requires DB)
4. Add hydration unit tests
5. Add triple-brace validation to version creation in `templates.ts`

**Verification:** Hydration tests pass with mock contexts.

### Phase C: Default Templates + Migration

1. Generate custom migration: `npx drizzle-kit generate --custom`
2. Write seed SQL for 5 templates + 5 versions with full Handlebars content from MVP doc
3. Apply migration and verify in tests

**Verification:** `withTestDb()` tests can query for default templates after migration.

### Phase D: Dispatch Endpoints

1. Implement `dispatch.ts` route handler: `/next`, `/queue`, template preview
2. Mount routes in `app.ts`
3. Update `TemplateConditionsSchema` in `templates.ts`
4. Write integration tests for all dispatch endpoints

**Verification:** Full dispatch flow works end-to-end in tests.

### Phase E: Enhanced Prompt Reviews

1. Modify `prompt-reviews.ts`: replace simple average with EWMA
2. Add improvement loop trigger (threshold check + auto-create issue)
3. Add duplicate prevention check
4. Write integration tests for EWMA and improvement loop

**Verification:** Review submission triggers score update and improvement issue creation.

### Phase F: Integration Verification

1. Run full test suite (`npm test`)
2. Run type checker (`npm run typecheck`)
3. Run linter (`npm run lint`)
4. Manual smoke test: create issue → dispatch/next → verify prompt → submit review

---

## Related ADRs

| ADR | Relevance |
|-----|-----------|
| ADR-003: Use Neon PostgreSQL | Transaction support via Pool driver for `FOR UPDATE SKIP LOCKED` |
| ADR-004: Use Drizzle ORM | Raw SQL via `db.execute(sql\`...\`)` for features Drizzle doesn't support natively |
| ADR-005: Use CUID2 Primary Keys | Default template IDs use stable strings (not CUID2-generated) for idempotent seeding |
| ADR-006: Use Soft Delete | Dispatch query must filter `deleted_at IS NULL` |
| ADR-007: Use PGlite for Testing | Test infrastructure supports migration-based seeding; PGlite may not fully simulate `FOR UPDATE SKIP LOCKED` contention |

---

## Open Questions

*None — all 7 clarification questions were resolved during ideation.*

---

## References

- **MVP Spec:** `meta/loop-mvp.md` — Sections: Prompt Selection (line 361), Prompt Hydration (line 406), Priority Logic (line 126), Prompt Reviews (line 496), Default Templates (line 902)
- **Litepaper:** `meta/loop-litepaper.md` — Pull-based architecture, self-improving prompt layer
- **Phase 1 Spec:** `specs/data-layer-core-api/02-specification.md`
- **Ideation:** `specs/prompt-dispatch-engine/01-ideation.md`
- **Research:** `research/20260220_prompt-dispatch-engine.md`
- **Build Plan:** `specs/mvp-build-plan.md` — Phase 2 scope
- **Handlebars Docs:** https://handlebarsjs.com/api-reference/compilation.html
- **PostgreSQL SKIP LOCKED:** https://www.postgresql.org/docs/current/explicit-locking.html
