---
slug: prompt-dispatch-engine
number: 3
created: 2026-02-20
status: draft
---

# Tasks: Prompt & Dispatch Engine (MVP Phase 2)

**Spec:** `specs/prompt-dispatch-engine/02-specification.md`
**Total Tasks:** 18
**Phases:** 6 (A-F)
**Estimated New Files:** 8
**Estimated Modified Files:** 4

---

## Dependency Graph

```
Phase A (Pure Functions)         Phase C (Migration)
  1.1 ──┐                         3.1 (depends on A types)
  1.2 ──┤                           │
  1.3 ──┤                           │
  1.4 ──┤ (depends on 1.2)          │
  1.5 ──┘ (depends on 1.3)          │
    │                                │
    ▼                                │
Phase B (Handlebars)                 │
  2.1 ──┐                           │
  2.2 ──┤ (depends on 2.1)          │
  2.3 ──┤ (depends on 2.2)          │
  2.4 ──┤                           │
  2.5 ──┘ (depends on 2.2)          │
    │                                │
    ▼                                ▼
Phase D (Dispatch Endpoints)
  4.1 ──┐ (depends on A, B, C)
  4.2 ──┤ (depends on A, B, C)
  4.3 ──┤ (depends on 4.1, 4.2)
  4.4 ──┤ (depends on 1.3)
  4.5 ──┘ (depends on 4.1-4.4)
    │
    ▼
Phase E (Enhanced Reviews)
  5.1 ──┐ (depends on A constants)
  5.2 ──┤ (depends on 5.1)
  5.3 ──┘ (depends on 5.1, 5.2)
    │
    ▼
Phase F (Integration Verification)
  6.1 ── (depends on ALL)
```

**Parallel Execution Opportunities:**
- Tasks 1.1, 1.2, 1.3 can run in parallel
- Tasks 1.4, 1.5 can run in parallel (after their respective deps)
- Tasks 2.1, 2.4 can run in parallel with each other
- Phase C (3.1) can run in parallel with Phase B
- Tasks 4.1, 4.2, 4.4 can run in parallel
- Phase E can start as soon as Phase A is done (parallel with Phase D)

---

## Phase A: Pure Functions + Dependencies

### Task 1.1: Add handlebars dependency

**File:** `apps/api/package.json`
**Status:** todo
**Dependencies:** none

Add the `handlebars` npm package to `apps/api`:

```bash
cd apps/api && npm install handlebars@^4.7.0
```

This adds `handlebars` to the `dependencies` section of `apps/api/package.json`. Version `^4.7.0` is required (>= 4.6.0 for prototype pollution protection).

**Verification:** `npm ls handlebars` shows the package installed. `npm run typecheck` still passes.

---

### Task 1.2: Implement priority-scoring.ts

**File:** `apps/api/src/lib/priority-scoring.ts` (new)
**Status:** todo
**Dependencies:** none

Create the priority scoring pure function with zero external dependencies. This file exports all scoring constants and the `scoreIssue()` function.

**Full implementation:**

```typescript
/** Priority level -> score weight */
export const PRIORITY_WEIGHTS: Record<number, number> = {
  1: 100, // urgent
  2: 75,  // high
  3: 50,  // medium
  4: 25,  // low
  0: 10,  // none
}

/** Issue type -> score bonus */
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
export function scoreIssue(input: ScoringInput): ScoreBreakdown {
  const priorityWeight = PRIORITY_WEIGHTS[input.priority] ?? 10
  const typeBonus = TYPE_WEIGHTS[input.type] ?? 0
  const goalAlignmentBonus = input.hasActiveGoal ? GOAL_ALIGNMENT_BONUS : 0
  const ageBonus = Math.floor((Date.now() - input.createdAt.getTime()) / 86_400_000) * AGE_BONUS_PER_DAY
  const total = priorityWeight + typeBonus + goalAlignmentBonus + ageBonus

  return { priorityWeight, goalAlignmentBonus, ageBonus, typeBonus, total }
}
```

**Verification:** File compiles with no errors. `npm run typecheck` passes.

---

### Task 1.3: Implement template selection types and functions

**File:** `apps/api/src/lib/prompt-engine.ts` (new — selection portion only)
**Status:** todo
**Dependencies:** none

Create the prompt engine file with template selection types, Zod schema, and pure matching/selection functions. Hydration code will be added in Phase B (Task 2.2, 2.3).

**Full implementation:**

```typescript
import { z } from 'zod'
import { issueTypeValues } from '../db/schema'

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Zod Schema ──────────────────────────────────────────────────────────────

export const TemplateConditionsSchema = z.object({
  type: z.enum(issueTypeValues).optional(),
  signalSource: z.string().optional(),
  labels: z.array(z.string()).optional(),
  projectId: z.string().optional(),
  hasFailedSessions: z.boolean().optional(),
  hypothesisConfidence: z.number().min(0).max(1).optional(),
}).strict()

// ─── Selection Algorithm ─────────────────────────────────────────────────────

/**
 * Check if a template's conditions match the given issue context.
 * Empty conditions {} matches everything.
 * All specified conditions must match (AND logic).
 */
export function matchesConditions(
  conditions: TemplateConditions,
  context: IssueContext
): boolean {
  if (conditions.type !== undefined && conditions.type !== context.type) {
    return false
  }
  if (conditions.signalSource !== undefined) {
    if (context.signalSource === null || conditions.signalSource !== context.signalSource) {
      return false
    }
  }
  if (conditions.labels !== undefined) {
    if (!conditions.labels.every((label) => context.labels.includes(label))) {
      return false
    }
  }
  if (conditions.projectId !== undefined) {
    if (context.projectId === null || conditions.projectId !== context.projectId) {
      return false
    }
  }
  if (conditions.hasFailedSessions !== undefined) {
    if (conditions.hasFailedSessions !== context.hasFailedSessions) {
      return false
    }
  }
  if (conditions.hypothesisConfidence !== undefined) {
    if (
      context.hypothesisConfidence === null ||
      context.hypothesisConfidence < conditions.hypothesisConfidence
    ) {
      return false
    }
  }
  return true
}

export interface TemplateCandidate {
  id: string
  slug: string
  conditions: TemplateConditions
  specificity: number
  projectId: string | null
  activeVersionId: string | null
}

/**
 * Select the best matching template for an issue context.
 *
 * 1. Filter to templates where conditions match the context
 * 2. Filter to templates with a non-null activeVersionId
 * 3. Sort: project-specific first, then by specificity descending
 * 4. Return first match, or null
 */
export function selectTemplate(
  templates: TemplateCandidate[],
  context: IssueContext
): TemplateCandidate | null {
  const matching = templates
    .filter((t) => t.activeVersionId !== null)
    .filter((t) => matchesConditions(t.conditions, context))
    .sort((a, b) => {
      // Project-specific templates first
      const aProjectMatch = a.projectId === context.projectId && a.projectId !== null ? 1 : 0
      const bProjectMatch = b.projectId === context.projectId && b.projectId !== null ? 1 : 0
      if (aProjectMatch !== bProjectMatch) return bProjectMatch - aProjectMatch
      // Then by specificity descending
      return b.specificity - a.specificity
    })

  return matching[0] ?? null
}
```

**Verification:** File compiles. `npm run typecheck` passes. Pure functions are ready for unit testing.

---

### Task 1.4: Write unit tests for priority-scoring.test.ts

**File:** `apps/api/src/__tests__/priority-scoring.test.ts` (new)
**Status:** todo
**Dependencies:** 1.2

Write comprehensive unit tests for the priority scoring pure function. No database required.

**Test cases to implement:**

```typescript
import { describe, it, expect } from 'vitest'
import {
  scoreIssue,
  PRIORITY_WEIGHTS,
  TYPE_WEIGHTS,
  GOAL_ALIGNMENT_BONUS,
  AGE_BONUS_PER_DAY,
} from '../lib/priority-scoring'

describe('scoreIssue', () => {
  // 1. Score calculation correctness:
  //    Given priority=2 (high), type='signal', hasActiveGoal=true, created 3 days ago
  //    -> verify exact score breakdown: 75 + 50 + 20 + 3 = 148
  it('computes correct total for high-priority signal with goal alignment', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000)
    const result = scoreIssue({
      priority: 2,
      type: 'signal',
      createdAt: threeDaysAgo,
      hasActiveGoal: true,
    })
    expect(result.priorityWeight).toBe(75)
    expect(result.typeBonus).toBe(50)
    expect(result.goalAlignmentBonus).toBe(20)
    expect(result.ageBonus).toBe(3)
    expect(result.total).toBe(148)
  })

  // 2. Priority weight mapping: Test all 5 priority levels
  it.each([
    [1, 100],
    [2, 75],
    [3, 50],
    [4, 25],
    [0, 10],
  ])('maps priority %i to weight %i', (priority, expected) => {
    const result = scoreIssue({
      priority,
      type: 'task',
      createdAt: new Date(),
      hasActiveGoal: false,
    })
    expect(result.priorityWeight).toBe(expected)
  })

  // 3. Type weight mapping: Test all 5 issue types
  it.each([
    ['signal', 50],
    ['hypothesis', 40],
    ['plan', 30],
    ['task', 20],
    ['monitor', 10],
  ])('maps type %s to bonus %i', (type, expected) => {
    const result = scoreIssue({
      priority: 0,
      type,
      createdAt: new Date(),
      hasActiveGoal: false,
    })
    expect(result.typeBonus).toBe(expected)
  })

  // 4. Unknown priority/type: fallback to defaults (10 and 0)
  it('falls back to default weight for unknown priority', () => {
    const result = scoreIssue({
      priority: 99,
      type: 'task',
      createdAt: new Date(),
      hasActiveGoal: false,
    })
    expect(result.priorityWeight).toBe(10)
  })

  it('falls back to zero bonus for unknown type', () => {
    const result = scoreIssue({
      priority: 0,
      type: 'unknown_type',
      createdAt: new Date(),
      hasActiveGoal: false,
    })
    expect(result.typeBonus).toBe(0)
  })

  // 5. Age bonus accumulation: 0 days, 30 days, 365 days
  it('returns zero age bonus for just-created issue', () => {
    const result = scoreIssue({
      priority: 0,
      type: 'task',
      createdAt: new Date(),
      hasActiveGoal: false,
    })
    expect(result.ageBonus).toBe(0)
  })

  it('returns 30 age bonus for 30-day-old issue', () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000)
    const result = scoreIssue({
      priority: 0,
      type: 'task',
      createdAt: thirtyDaysAgo,
      hasActiveGoal: false,
    })
    expect(result.ageBonus).toBe(30)
  })

  it('returns 365 age bonus for 1-year-old issue', () => {
    const oneYearAgo = new Date(Date.now() - 365 * 86_400_000)
    const result = scoreIssue({
      priority: 0,
      type: 'task',
      createdAt: oneYearAgo,
      hasActiveGoal: false,
    })
    expect(result.ageBonus).toBe(365)
  })

  // 6. Goal alignment: with and without active goal
  it('adds goal alignment bonus when hasActiveGoal is true', () => {
    const result = scoreIssue({
      priority: 0,
      type: 'task',
      createdAt: new Date(),
      hasActiveGoal: true,
    })
    expect(result.goalAlignmentBonus).toBe(GOAL_ALIGNMENT_BONUS)
  })

  it('adds zero goal bonus when hasActiveGoal is false', () => {
    const result = scoreIssue({
      priority: 0,
      type: 'task',
      createdAt: new Date(),
      hasActiveGoal: false,
    })
    expect(result.goalAlignmentBonus).toBe(0)
  })
})
```

**Verification:** `npx vitest run apps/api/src/__tests__/priority-scoring.test.ts` — all tests pass.

---

### Task 1.5: Write unit tests for template selection (prompt-engine.test.ts)

**File:** `apps/api/src/__tests__/prompt-engine.test.ts` (new — selection tests only)
**Status:** todo
**Dependencies:** 1.3

Write unit tests for `matchesConditions` and `selectTemplate` pure functions. No database required. Hydration tests will be added in Task 2.5.

**Test cases to implement:**

```typescript
import { describe, it, expect } from 'vitest'
import {
  matchesConditions,
  selectTemplate,
  type IssueContext,
  type TemplateCandidate,
  type TemplateConditions,
} from '../lib/prompt-engine'

const baseContext: IssueContext = {
  type: 'signal',
  signalSource: 'posthog',
  labels: ['frontend', 'urgent'],
  projectId: 'proj_1',
  hasFailedSessions: false,
  hypothesisConfidence: null,
}

describe('matchesConditions', () => {
  it('empty conditions match everything', () => {
    expect(matchesConditions({}, baseContext)).toBe(true)
  })

  it('single type condition matches correct type', () => {
    expect(matchesConditions({ type: 'signal' }, baseContext)).toBe(true)
    expect(matchesConditions({ type: 'task' }, baseContext)).toBe(false)
  })

  it('multiple conditions require all to match (AND)', () => {
    expect(matchesConditions({ type: 'signal', signalSource: 'posthog' }, baseContext)).toBe(true)
    expect(matchesConditions({ type: 'signal', signalSource: 'sentry' }, baseContext)).toBe(false)
  })

  it('labels condition requires all specified labels present', () => {
    expect(matchesConditions({ labels: ['frontend'] }, baseContext)).toBe(true)
    expect(matchesConditions({ labels: ['frontend', 'urgent'] }, baseContext)).toBe(true)
    expect(matchesConditions({ labels: ['backend'] }, baseContext)).toBe(false)
  })

  it('null context signalSource does not match signalSource condition', () => {
    const ctx: IssueContext = { ...baseContext, signalSource: null }
    expect(matchesConditions({ signalSource: 'posthog' }, ctx)).toBe(false)
  })

  it('null context projectId does not match projectId condition', () => {
    const ctx: IssueContext = { ...baseContext, projectId: null }
    expect(matchesConditions({ projectId: 'proj_1' }, ctx)).toBe(false)
  })

  it('hasFailedSessions exact match', () => {
    expect(matchesConditions({ hasFailedSessions: false }, baseContext)).toBe(true)
    expect(matchesConditions({ hasFailedSessions: true }, baseContext)).toBe(false)
  })

  it('hypothesisConfidence matches when context >= condition', () => {
    const ctx: IssueContext = { ...baseContext, hypothesisConfidence: 0.8 }
    expect(matchesConditions({ hypothesisConfidence: 0.7 }, ctx)).toBe(true)
    expect(matchesConditions({ hypothesisConfidence: 0.8 }, ctx)).toBe(true)
    expect(matchesConditions({ hypothesisConfidence: 0.9 }, ctx)).toBe(false)
  })

  it('hypothesisConfidence with null context does not match', () => {
    expect(matchesConditions({ hypothesisConfidence: 0.5 }, baseContext)).toBe(false)
  })
})

describe('selectTemplate', () => {
  const makeCandidate = (overrides: Partial<TemplateCandidate>): TemplateCandidate => ({
    id: 'tpl_1',
    slug: 'test',
    conditions: {},
    specificity: 10,
    projectId: null,
    activeVersionId: 'ver_1',
    ...overrides,
  })

  it('returns highest specificity match', () => {
    const templates = [
      makeCandidate({ id: 'low', slug: 'low', specificity: 10, conditions: { type: 'signal' } }),
      makeCandidate({ id: 'high', slug: 'high', specificity: 50, conditions: { type: 'signal' } }),
    ]
    const result = selectTemplate(templates, baseContext)
    expect(result?.id).toBe('high')
  })

  it('project-specific template wins over higher-specificity generic', () => {
    const templates = [
      makeCandidate({ id: 'generic', slug: 'generic', specificity: 100, conditions: { type: 'signal' } }),
      makeCandidate({ id: 'proj', slug: 'proj', specificity: 10, projectId: 'proj_1', conditions: { type: 'signal' } }),
    ]
    const result = selectTemplate(templates, baseContext)
    expect(result?.id).toBe('proj')
  })

  it('returns null when no templates match', () => {
    const templates = [
      makeCandidate({ conditions: { type: 'task' } }),
    ]
    const result = selectTemplate(templates, baseContext)
    expect(result).toBeNull()
  })

  it('filters out templates without activeVersionId', () => {
    const templates = [
      makeCandidate({ activeVersionId: null, conditions: { type: 'signal' } }),
    ]
    const result = selectTemplate(templates, baseContext)
    expect(result).toBeNull()
  })

  it('returns null for empty template list', () => {
    const result = selectTemplate([], baseContext)
    expect(result).toBeNull()
  })
})
```

**Verification:** `npx vitest run apps/api/src/__tests__/prompt-engine.test.ts` — all tests pass.

---

## Phase B: Handlebars + Partials

### Task 2.1: Implement partials.ts with all 5 partial contents

**File:** `apps/api/src/lib/partials.ts` (new)
**Status:** todo
**Dependencies:** Phase A complete

Create the partials file that exports a `Record<string, string>` of partial name to Handlebars content. These are registered during `initHandlebars()`.

**Full implementation with all 5 partials:**

```typescript
/** Shared Handlebars partials registered during initHandlebars(). */
export const PARTIALS: Record<string, string> = {
  api_reference: `## Loop API Reference

Base URL: {{loopUrl}}
Auth: \`Authorization: Bearer {{loopToken}}\`

### Create Issue
\`\`\`
curl -X POST {{loopUrl}}/api/issues \\
  -H "Authorization: Bearer {{loopToken}}" \\
  -H "Content-Type: application/json" \\
  -d '{"title": "...", "type": "task", "parentId": "{{issue.parentId}}"}'
\`\`\`

### Update Issue Status
\`\`\`
curl -X PATCH {{loopUrl}}/api/issues/{{issue.id}} \\
  -H "Authorization: Bearer {{loopToken}}" \\
  -H "Content-Type: application/json" \\
  -d '{"status": "done", "agentSummary": "..."}'
\`\`\`

### Add Comment
\`\`\`
curl -X POST {{loopUrl}}/api/issues/{{issue.id}}/comments \\
  -H "Authorization: Bearer {{loopToken}}" \\
  -H "Content-Type: application/json" \\
  -d '{"body": "...", "authorName": "Agent", "authorType": "agent"}'
\`\`\`

### Create Relation
\`\`\`
curl -X POST {{loopUrl}}/api/issues/{{issue.id}}/relations \\
  -H "Authorization: Bearer {{loopToken}}" \\
  -H "Content-Type: application/json" \\
  -d '{"type": "blocks", "relatedIssueId": "..."}'
\`\`\``,

  review_instructions: `## After Completion

Rate the quality of these instructions:

\`\`\`
curl -X POST {{loopUrl}}/api/prompt-reviews \\
  -H "Authorization: Bearer {{loopToken}}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "versionId": "{{meta.versionId}}",
    "issueId": "{{issue.id}}",
    "clarity": <1-5>,
    "completeness": <1-5>,
    "relevance": <1-5>,
    "feedback": "<what was missing, confusing, or unnecessary>"
  }'
\`\`\``,

  parent_context: `{{#if parent}}
## Parent Issue
#{{parent.number}} [{{parent.type}}]: {{parent.title}}
{{#if parent.description}}
{{parent.description}}
{{/if}}
{{#if parent.hypothesis}}
Hypothesis: {{parent.hypothesis.statement}} (confidence: {{parent.hypothesis.confidence}})
Validation: {{parent.hypothesis.validationCriteria}}
{{/if}}
{{/if}}`,

  sibling_context: `{{#if siblings.length}}
## Sibling Issues
{{#each siblings}}
- #{{this.number}} [{{this.status}}]: {{this.title}}
{{/each}}
{{/if}}`,

  project_and_goal_context: `{{#if project}}
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
{{/if}}`,
}
```

**Verification:** File compiles. Partials contain all 5 entries per spec: `api_reference`, `review_instructions`, `parent_context`, `sibling_context`, `project_and_goal_context`.

---

### Task 2.2: Implement Handlebars setup (initHandlebars, compileTemplate, hydrateTemplate)

**File:** `apps/api/src/lib/prompt-engine.ts` (append to existing from Task 1.3)
**Status:** todo
**Dependencies:** 2.1

Add Handlebars initialization, compilation with caching, and hydration functions to the prompt engine file created in Task 1.3.

**Code to add to prompt-engine.ts:**

```typescript
import Handlebars from 'handlebars'
import { PARTIALS } from './partials'

// ─── Handlebars Setup ────────────────────────────────────────────────────────

/** Compiled template cache, keyed by version ID */
const templateCache = new Map<string, Handlebars.TemplateDelegate>()

/** Register shared partials and helpers. Call once at module load. */
export function initHandlebars(): void {
  // Register all 5 shared partials
  for (const [name, content] of Object.entries(PARTIALS)) {
    Handlebars.registerPartial(name, content)
  }

  // Register json helper for rendering JSONB fields
  Handlebars.registerHelper('json', (ctx: unknown) => JSON.stringify(ctx, null, 2))

  // Register priority_label helper mapping priority int to human label
  Handlebars.registerHelper('priority_label', (priority: number) => {
    const labels: Record<number, string> = {
      1: 'urgent',
      2: 'high',
      3: 'medium',
      4: 'low',
      0: 'none',
    }
    return labels[priority] ?? 'unknown'
  })
}

// Initialize at module load
initHandlebars()

/**
 * Compile a Handlebars template with caching by version ID.
 * Uses strict: false so templates render gracefully when optional context is missing.
 * Uses noEscape: true because prompts are plain text, not HTML.
 */
export function compileTemplate(versionId: string, content: string): Handlebars.TemplateDelegate {
  const cached = templateCache.get(versionId)
  if (cached) return cached
  const compiled = Handlebars.compile(content, { strict: false, noEscape: true })
  templateCache.set(versionId, compiled)
  return compiled
}

/**
 * Hydrate a template version with the full context.
 * Compiles (or retrieves from cache) and renders with the provided context.
 */
export function hydrateTemplate(
  versionId: string,
  content: string,
  context: HydrationContext
): string {
  const compiled = compileTemplate(versionId, content)
  return compiled(context)
}
```

Also add the `HydrationContext` type (needed by `hydrateTemplate`):

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
```

**Verification:** File compiles. `npm run typecheck` passes. Cache uses `Map<string, Handlebars.TemplateDelegate>`.

---

### Task 2.3: Implement buildHydrationContext

**File:** `apps/api/src/lib/prompt-engine.ts` (append)
**Status:** todo
**Dependencies:** 2.2

Add the `buildHydrationContext` function that assembles full context for Handlebars hydration from the database. Uses `Promise.all` for parallel queries where possible.

**Full implementation:**

```typescript
import { eq, and, ne, isNull } from 'drizzle-orm'
import {
  issues,
  projects,
  goals,
  issueLabels,
  labels,
  issueRelations,
} from '../db/schema'
import type { AnyDb } from '../types'

/**
 * Assemble full context for Handlebars hydration.
 * Executes parallel database queries for independent lookups.
 */
export async function buildHydrationContext(
  db: AnyDb,
  issue: typeof issues.$inferSelect,
  template: { id: string; slug: string },
  version: { id: string; version: number }
): Promise<HydrationContext> {
  // Parallel query group 1: parent, labels, blocking, blockedBy, previousSessions
  const [parentResult, labelResults, blockingResults, blockedByResults] = await Promise.all([
    // Parent issue (if parentId set)
    issue.parentId
      ? db.select().from(issues).where(eq(issues.id, issue.parentId))
      : Promise.resolve([]),

    // Labels via join
    db
      .select({ name: labels.name, color: labels.color })
      .from(issueLabels)
      .innerJoin(labels, eq(issueLabels.labelId, labels.id))
      .where(eq(issueLabels.issueId, issue.id)),

    // Blocking: issues this issue blocks
    db
      .select({
        id: issues.id,
        number: issues.number,
        title: issues.title,
      })
      .from(issueRelations)
      .innerJoin(issues, eq(issueRelations.relatedIssueId, issues.id))
      .where(
        and(
          eq(issueRelations.issueId, issue.id),
          eq(issueRelations.type, 'blocks')
        )
      ),

    // BlockedBy: issues blocking this issue
    db
      .select({
        id: issues.id,
        number: issues.number,
        title: issues.title,
      })
      .from(issueRelations)
      .innerJoin(issues, eq(issueRelations.relatedIssueId, issues.id))
      .where(
        and(
          eq(issueRelations.issueId, issue.id),
          eq(issueRelations.type, 'blocked_by')
        )
      ),
  ])

  // Parallel query group 2: siblings/children, project, goal
  const [siblingsOrChildren, projectResult] = await Promise.all([
    // Siblings (if has parent) or children (if root issue)
    issue.parentId
      ? db
          .select()
          .from(issues)
          .where(
            and(
              eq(issues.parentId, issue.parentId!),
              ne(issues.id, issue.id),
              isNull(issues.deletedAt)
            )
          )
      : db
          .select()
          .from(issues)
          .where(and(eq(issues.parentId, issue.id), isNull(issues.deletedAt))),

    // Project (if projectId set)
    issue.projectId
      ? db.select().from(projects).where(eq(projects.id, issue.projectId))
      : Promise.resolve([]),
  ])

  const parent = parentResult[0] ?? null
  const project = projectResult[0] ?? null

  // Goal (if project found)
  let goal = null
  if (project) {
    const [goalResult] = await db
      .select()
      .from(goals)
      .where(eq(goals.projectId, project.id))
    goal = goalResult ?? null
  }

  // Previous sessions: extract from the issue itself for MVP
  const previousSessions: Array<{ status: string; agentSummary: string | null }> = []
  if (issue.agentSummary) {
    previousSessions.push({
      status: issue.status,
      agentSummary: issue.agentSummary,
    })
  }

  const siblings = issue.parentId ? siblingsOrChildren : []
  const children = issue.parentId ? [] : siblingsOrChildren

  return {
    issue: issue as unknown as Record<string, unknown>,
    parent: parent as Record<string, unknown> | null,
    siblings: siblings as Record<string, unknown>[],
    children: children as Record<string, unknown>[],
    project: project as Record<string, unknown> | null,
    goal: goal as Record<string, unknown> | null,
    labels: labelResults,
    blocking: blockingResults,
    blockedBy: blockedByResults,
    previousSessions,
    loopUrl: process.env.LOOP_URL ?? 'http://localhost:4242',
    loopToken: process.env.LOOP_API_KEY ?? '',
    meta: {
      templateId: template.id,
      templateSlug: template.slug,
      versionId: version.id,
      versionNumber: version.version,
    },
  }
}
```

**Verification:** File compiles. `npm run typecheck` passes. Queries execute in parallel via `Promise.all`.

---

### Task 2.4: Add triple-brace validation to version creation

**File:** `apps/api/src/routes/templates.ts` (modify)
**Status:** todo
**Dependencies:** Phase A complete

Add validation to the version creation endpoint (`POST /:id/versions`) that rejects template content containing triple-braces `{{{`. This prevents server-side template injection.

**Change in `templates.ts` — inside the `POST /:id/versions` handler, after the template existence check and before the version insert:**

Add this validation after `const isFirstVersion = template.activeVersionId === null`:

```typescript
// Validate content does not contain triple-braces (SSTI prevention)
if (body.content.includes('{{{')) {
  throw new HTTPException(422, {
    message: 'Template content must not contain triple-braces ({{{...}}}). Use {{...}} instead.',
  })
}
```

**Verification:** Creating a version with `{{{raw}}}` in content returns 422. Normal `{{variable}}` content succeeds.

---

### Task 2.5: Write hydration unit tests in prompt-engine.test.ts

**File:** `apps/api/src/__tests__/prompt-engine.test.ts` (append to existing from Task 1.5)
**Status:** todo
**Dependencies:** 2.2

Add Handlebars hydration test cases to the existing prompt-engine test file. Tests use mock contexts, no database.

**Test cases to add:**

```typescript
import {
  compileTemplate,
  hydrateTemplate,
  initHandlebars,
  type HydrationContext,
} from '../lib/prompt-engine'

const mockContext: HydrationContext = {
  issue: { id: 'iss_1', title: 'Test Issue', number: 42, type: 'task', parentId: null },
  parent: null,
  siblings: [],
  children: [],
  project: null,
  goal: null,
  labels: [{ name: 'frontend', color: '#ff0000' }],
  blocking: [{ number: 45, title: 'Blocked Task' }],
  blockedBy: [],
  previousSessions: [],
  loopUrl: 'http://localhost:4242',
  loopToken: 'test-token',
  meta: {
    templateId: 'tpl_1',
    templateSlug: 'test-template',
    versionId: 'ver_1',
    versionNumber: 1,
  },
}

describe('hydrateTemplate', () => {
  it('injects issue variables', () => {
    const result = hydrateTemplate('v_inject', '# {{issue.title}}', mockContext)
    expect(result).toBe('# Test Issue')
  })

  it('renders conditional sections only when present', () => {
    const template = '{{#if parent}}Parent: {{parent.title}}{{/if}}No parent'
    const result = hydrateTemplate('v_cond', template, mockContext)
    expect(result).toBe('No parent')

    const withParent: HydrationContext = {
      ...mockContext,
      parent: { title: 'Parent Task', number: 1 },
    }
    const result2 = hydrateTemplate('v_cond2', template, withParent)
    expect(result2).toBe('Parent: Parent TaskNo parent')
  })

  it('iterates with each loops', () => {
    const ctx: HydrationContext = {
      ...mockContext,
      siblings: [
        { number: 1, status: 'todo', title: 'Sibling A' },
        { number: 2, status: 'done', title: 'Sibling B' },
      ] as Record<string, unknown>[],
    }
    const template = '{{#each siblings}}#{{this.number}} {{/each}}'
    const result = hydrateTemplate('v_each', template, ctx)
    expect(result).toBe('#1 #2 ')
  })

  it('renders json helper', () => {
    const ctx: HydrationContext = {
      ...mockContext,
      issue: { ...mockContext.issue, signalPayload: { key: 'value' } },
    }
    const template = '{{json issue.signalPayload}}'
    const result = hydrateTemplate('v_json', template, ctx)
    expect(result).toContain('"key": "value"')
  })

  it('renders partials', () => {
    const template = '{{> sibling_context}}'
    const ctx: HydrationContext = {
      ...mockContext,
      siblings: [
        { number: 10, status: 'todo', title: 'Sib' },
      ] as Record<string, unknown>[],
    }
    const result = hydrateTemplate('v_partial', template, ctx)
    expect(result).toContain('#10')
    expect(result).toContain('Sib')
  })

  it('renders without error when optional context is null/empty', () => {
    const template = '{{#if parent}}{{parent.title}}{{/if}}{{#if goal}}{{goal.title}}{{/if}}OK'
    const result = hydrateTemplate('v_missing', template, mockContext)
    expect(result).toBe('OK')
  })

  it('returns cached compiled template on second call', () => {
    const content = 'Hello {{issue.title}}'
    const compiled1 = compileTemplate('v_cache_test', content)
    const compiled2 = compileTemplate('v_cache_test', content)
    expect(compiled1).toBe(compiled2) // Same reference = cache hit
  })
})
```

**Verification:** `npx vitest run apps/api/src/__tests__/prompt-engine.test.ts` — all tests pass (both selection and hydration).

---

## Phase C: Default Templates + Migration

### Task 3.1: Generate custom migration and write seed SQL for 5 templates + 5 versions

**File:** `apps/api/drizzle/migrations/0002_seed_default_templates.sql` (new, via drizzle-kit generate --custom)
**Status:** todo
**Dependencies:** Phase A (schema types)

Generate a custom migration file and populate it with seed SQL for all 5 default templates and their initial versions.

**Step 1:** Generate the empty migration:
```bash
cd apps/api && npx drizzle-kit generate --custom
```
This creates a timestamped migration file. Rename it or note the filename.

**Step 2:** Write the migration SQL. The file must contain INSERT statements for 5 templates and 5 versions with ON CONFLICT for idempotency.

**Template IDs (stable, hard-coded):**
- `tpl_default_signal_triage` / `ver_default_signal_triage_v1`
- `tpl_default_hypothesis_planning` / `ver_default_hypothesis_planning_v1`
- `tpl_default_task_execution` / `ver_default_task_execution_v1`
- `tpl_default_plan_decomposition` / `ver_default_plan_decomposition_v1`
- `tpl_default_monitor_check` / `ver_default_monitor_check_v1`

**SQL structure for each template pair:**

```sql
-- Signal Triage
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
  E'# Signal Triage: {{issue.title}}\n\nYou are triaging signal #{{issue.number}}.\n\n## Signal Data\n{{json issue.signalPayload}}\n\nSource: {{issue.signalSource}}\n\n{{> parent_context}}\n{{> project_and_goal_context}}\n\n## Instructions\n\n1. Analyze the signal data above\n2. Determine if this signal is actionable\n3. If actionable, create a hypothesis issue as a child of this signal\n4. Update this issue status to \"done\" with a summary of your analysis\n\n{{> api_reference}}\n{{> review_instructions}}',
  'Initial default template',
  'human',
  'system',
  'active',
  0,
  NOW()
)
ON CONFLICT DO NOTHING;

-- Hypothesis Planning
INSERT INTO prompt_templates (id, slug, name, description, conditions, specificity, active_version_id, created_at, updated_at)
VALUES (
  'tpl_default_hypothesis_planning',
  'hypothesis-planning',
  'Hypothesis Planning',
  'Default template for planning hypothesis validation. Decomposes the hypothesis into actionable tasks.',
  '{"type": "hypothesis"}',
  10,
  'ver_default_hypothesis_planning_v1',
  NOW(), NOW()
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO prompt_versions (id, template_id, version, content, changelog, author_type, author_name, status, usage_count, created_at)
VALUES (
  'ver_default_hypothesis_planning_v1',
  'tpl_default_hypothesis_planning',
  1,
  E'# Hypothesis Planning: {{issue.title}}\n\nYou are planning validation for hypothesis #{{issue.number}}.\n\n{{#if issue.hypothesis}}\n## Hypothesis\nStatement: {{issue.hypothesis.statement}}\nConfidence: {{issue.hypothesis.confidence}}\nValidation Criteria: {{issue.hypothesis.validationCriteria}}\n{{#if issue.hypothesis.prediction}}\nPrediction: {{issue.hypothesis.prediction}}\n{{/if}}\n{{/if}}\n\n{{> parent_context}}\n{{> sibling_context}}\n{{> project_and_goal_context}}\n\n## Instructions\n\n1. Review the hypothesis and validation criteria\n2. Decompose into concrete tasks (create child issues)\n3. Set up blocking relations so tasks execute in correct order\n4. Update this issue status to \"done\" with your plan summary\n\n{{> api_reference}}\n{{> review_instructions}}',
  'Initial default template',
  'human',
  'system',
  'active',
  0,
  NOW()
)
ON CONFLICT DO NOTHING;

-- Task Execution
INSERT INTO prompt_templates (id, slug, name, description, conditions, specificity, active_version_id, created_at, updated_at)
VALUES (
  'tpl_default_task_execution',
  'task-execution',
  'Task Execution',
  'Default template for executing concrete tasks. Provides implementation guidance and reporting instructions.',
  '{"type": "task"}',
  10,
  'ver_default_task_execution_v1',
  NOW(), NOW()
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO prompt_versions (id, template_id, version, content, changelog, author_type, author_name, status, usage_count, created_at)
VALUES (
  'ver_default_task_execution_v1',
  'tpl_default_task_execution',
  1,
  E'# Task Execution: {{issue.title}}\n\nYou are executing task #{{issue.number}}.\n\n{{#if issue.description}}\n## Description\n{{issue.description}}\n{{/if}}\n\n{{> parent_context}}\n{{> sibling_context}}\n{{> project_and_goal_context}}\n\n{{#if blockedBy.length}}\n## Blocked By\n{{#each blockedBy}}\n- #{{this.number}}: {{this.title}}\n{{/each}}\n{{/if}}\n\n{{#if previousSessions.length}}\n## Previous Sessions\n{{#each previousSessions}}\nStatus: {{this.status}}\n{{#if this.agentSummary}}Summary: {{this.agentSummary}}{{/if}}\n{{/each}}\n{{/if}}\n\n## Instructions\n\n1. Implement the task described above\n2. Add comments to track your progress\n3. When complete, update status to \"done\" with an agent summary\n4. If you create sub-tasks, add them as child issues\n\n{{> api_reference}}\n{{> review_instructions}}',
  'Initial default template',
  'human',
  'system',
  'active',
  0,
  NOW()
)
ON CONFLICT DO NOTHING;

-- Plan Decomposition
INSERT INTO prompt_templates (id, slug, name, description, conditions, specificity, active_version_id, created_at, updated_at)
VALUES (
  'tpl_default_plan_decomposition',
  'plan-decomposition',
  'Plan Decomposition',
  'Default template for decomposing plans into tasks. Breaks down a plan into ordered, actionable work items.',
  '{"type": "plan"}',
  10,
  'ver_default_plan_decomposition_v1',
  NOW(), NOW()
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO prompt_versions (id, template_id, version, content, changelog, author_type, author_name, status, usage_count, created_at)
VALUES (
  'ver_default_plan_decomposition_v1',
  'tpl_default_plan_decomposition',
  1,
  E'# Plan Decomposition: {{issue.title}}\n\nYou are decomposing plan #{{issue.number}} into actionable tasks.\n\n{{#if issue.description}}\n## Plan Description\n{{issue.description}}\n{{/if}}\n\n{{> parent_context}}\n{{> sibling_context}}\n{{> project_and_goal_context}}\n\n## Instructions\n\n1. Analyze the plan and break it into concrete tasks\n2. Create child issues for each task\n3. Set up blocking relations for ordering dependencies\n4. Assign appropriate priority levels to each task\n5. Update this issue status to \"done\" with decomposition summary\n\n{{> api_reference}}\n{{> review_instructions}}',
  'Initial default template',
  'human',
  'system',
  'active',
  0,
  NOW()
)
ON CONFLICT DO NOTHING;

-- Monitor Check
INSERT INTO prompt_templates (id, slug, name, description, conditions, specificity, active_version_id, created_at, updated_at)
VALUES (
  'tpl_default_monitor_check',
  'monitor-check',
  'Monitor Check',
  'Default template for monitoring checks. Reviews metrics and creates signals if thresholds are breached.',
  '{"type": "monitor"}',
  10,
  'ver_default_monitor_check_v1',
  NOW(), NOW()
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO prompt_versions (id, template_id, version, content, changelog, author_type, author_name, status, usage_count, created_at)
VALUES (
  'ver_default_monitor_check_v1',
  'tpl_default_monitor_check',
  1,
  E'# Monitor Check: {{issue.title}}\n\nYou are performing monitor check #{{issue.number}}.\n\n{{#if issue.description}}\n## Monitor Description\n{{issue.description}}\n{{/if}}\n\n{{> project_and_goal_context}}\n\n{{#if previousSessions.length}}\n## Previous Checks\n{{#each previousSessions}}\nStatus: {{this.status}}\n{{#if this.agentSummary}}Summary: {{this.agentSummary}}{{/if}}\n{{/each}}\n{{/if}}\n\n## Instructions\n\n1. Review the monitoring criteria described above\n2. Check relevant metrics and data sources\n3. If thresholds are breached, create a signal issue via the API\n4. Add a comment summarizing your findings\n5. Update status to \"done\" with your monitoring summary\n\n{{> api_reference}}\n{{> review_instructions}}',
  'Initial default template',
  'human',
  'system',
  'active',
  0,
  NOW()
)
ON CONFLICT DO NOTHING;
```

**Verification:** Run `npm run db:migrate` and verify templates exist. `withTestDb()` tests can query for default templates after migration.

---

## Phase D: Dispatch Endpoints

### Task 4.1: Implement dispatch.ts route handler (GET /dispatch/next, GET /dispatch/queue)

**File:** `apps/api/src/routes/dispatch.ts` (new)
**Status:** todo
**Dependencies:** 1.2, 1.3, 2.2, 2.3, 3.1

Implement the dispatch route handler with two endpoints:

**`GET /dispatch/next` — Claim highest-priority unblocked issue + hydrated prompt:**

Flow:
1. Get `db` from Hono context
2. Read optional `project` query param
3. Begin database transaction
4. Execute raw SQL to find and claim highest-priority unblocked issue using `FOR UPDATE SKIP LOCKED`
5. If no row returned: return `204 No Content`
6. Build `IssueContext` from claimed issue
7. Fetch all non-deleted templates with active versions
8. Run `selectTemplate(templates, context)` — fall back to default for issue type if null
9. If no template: return issue with `prompt: null` and warning in meta
10. Fetch active version content
11. Build `HydrationContext` via `buildHydrationContext()`
12. Hydrate template via `hydrateTemplate()`
13. Increment version's `usageCount`
14. Return response with issue, prompt, and meta

**SQL for claim query (from spec):**

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
    ${projectId ? sql`AND i.project_id = ${projectId}` : sql``}
  ORDER BY
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

**`GET /dispatch/queue` — Preview dispatch queue with scores (no claim):**

Flow:
1. Read optional `project`, `limit` (1-200, default 50), `offset` (default 0) query params
2. Same filtering as `/next` (status='todo', not deleted, not blocked) — but using Drizzle query builder
3. Score each issue using `scoreIssue()` from `priority-scoring.ts`
4. Sort by score descending
5. Apply pagination
6. Return `{ data: [...], total }` with score breakdown per issue

**Response shapes per spec (see spec lines 590-649).**

**Verification:** Both endpoints respond correctly. `GET /dispatch/next` returns 200 with issue+prompt or 204. `GET /dispatch/queue` returns scored list with pagination.

---

### Task 4.2: Implement template preview endpoint (GET /templates/preview/:issueId)

**File:** `apps/api/src/routes/templates.ts` (append to existing)
**Status:** todo
**Dependencies:** 1.3, 2.2, 2.3, 3.1

Add the template preview endpoint to the existing template routes. This allows debugging template selection and hydration for any issue without claiming it.

**Implementation:**

```typescript
/** GET /preview/:issueId — Preview template selection + hydration for an issue. */
templateRoutes.get('/preview/:issueId', async (c) => {
  const db = c.get('db')
  const issueId = c.req.param('issueId')

  // 1. Fetch issue by ID (404 if not found or deleted)
  const [issue] = await db
    .select()
    .from(issues)
    .where(and(eq(issues.id, issueId), isNull(issues.deletedAt)))

  if (!issue) {
    throw new HTTPException(404, { message: 'Issue not found' })
  }

  // 2. Build IssueContext from issue
  const issueContext: IssueContext = {
    type: issue.type,
    signalSource: issue.signalSource,
    labels: [], // Would need to fetch labels for full context
    projectId: issue.projectId,
    hasFailedSessions: issue.agentSummary !== null,
    hypothesisConfidence: issue.hypothesis?.confidence ?? null,
  }

  // 3. Fetch all non-deleted templates with active versions
  const allTemplates = await db
    .select()
    .from(promptTemplates)
    .where(isNull(promptTemplates.deletedAt))

  const candidates: TemplateCandidate[] = allTemplates.map((t) => ({
    id: t.id,
    slug: t.slug,
    conditions: t.conditions as TemplateConditions,
    specificity: t.specificity,
    projectId: t.projectId,
    activeVersionId: t.activeVersionId,
  }))

  // 4. Select template with fallback
  let selected = selectTemplate(candidates, issueContext)
  if (!selected) {
    // Fallback: look for default template matching issue type
    selected = candidates.find(
      (t) => (t.conditions as TemplateConditions).type === issue.type && t.activeVersionId
    ) ?? null
  }

  // 5. No template found
  if (!selected || !selected.activeVersionId) {
    return c.json({
      issue: { id: issue.id, number: issue.number, title: issue.title, type: issue.type },
      template: null,
      version: null,
      prompt: null,
      message: 'No matching template found',
    })
  }

  // 6. Fetch version, build context, hydrate
  const [version] = await db
    .select()
    .from(promptVersions)
    .where(eq(promptVersions.id, selected.activeVersionId))

  if (!version) {
    return c.json({
      issue: { id: issue.id, number: issue.number, title: issue.title, type: issue.type },
      template: null,
      version: null,
      prompt: null,
      message: 'Active version not found',
    })
  }

  const hydrationContext = await buildHydrationContext(
    db, issue, { id: selected.id, slug: selected.slug }, { id: version.id, version: version.version }
  )
  const prompt = hydrateTemplate(version.id, version.content, hydrationContext)

  // 7. Return preview
  return c.json({
    issue: { id: issue.id, number: issue.number, title: issue.title, type: issue.type },
    template: {
      id: selected.id,
      slug: selected.slug,
      name: allTemplates.find((t) => t.id === selected!.id)?.name,
      conditions: selected.conditions,
      specificity: selected.specificity,
    },
    version: { id: version.id, version: version.version },
    prompt,
  })
})
```

**Required imports to add to templates.ts:**
```typescript
import { issues } from '../db/schema'
import {
  selectTemplate,
  matchesConditions,
  buildHydrationContext,
  hydrateTemplate,
  type IssueContext,
  type TemplateCandidate,
  type TemplateConditions,
} from '../lib/prompt-engine'
```

**Verification:** `GET /api/templates/preview/:issueId` returns template + hydrated prompt for a valid issue, or 404 for missing issues.

---

### Task 4.3: Mount dispatch routes in app.ts

**File:** `apps/api/src/app.ts` (modify)
**Status:** todo
**Dependencies:** 4.1, 4.2

Mount the dispatch routes on the authenticated API group.

**Changes to app.ts:**

1. Add import:
```typescript
import { dispatchRoutes } from './routes/dispatch'
```

2. Add route mount after the existing route registrations (after `api.route('/prompt-reviews', promptReviewRoutes)`):
```typescript
api.route('/dispatch', dispatchRoutes)
```

**Verification:** `GET /api/dispatch/next` and `GET /api/dispatch/queue` are accessible (with auth). `GET /api/templates/preview/:issueId` is accessible via existing template routes mount.

---

### Task 4.4: Update conditions validation in templates.ts (strict Zod schema)

**File:** `apps/api/src/routes/templates.ts` (modify)
**Status:** todo
**Dependencies:** 1.3

Replace the loose `z.record(z.string(), z.unknown())` conditions validation with the strict `TemplateConditionsSchema` from `prompt-engine.ts`.

**Changes:**

1. Add import:
```typescript
import { TemplateConditionsSchema } from '../lib/prompt-engine'
```

2. In `createTemplateSchema`, replace:
```typescript
// BEFORE:
conditions: z.record(z.string(), z.unknown()).default({})
// AFTER:
conditions: TemplateConditionsSchema.default({})
```

3. In `updateTemplateSchema`, replace:
```typescript
// BEFORE:
conditions: z.record(z.string(), z.unknown()).optional()
// AFTER:
conditions: TemplateConditionsSchema.optional()
```

**Verification:** Creating a template with `{ conditions: { type: "signal" } }` succeeds. Creating with `{ conditions: { unknownKey: "value" } }` returns 422 (rejected by `.strict()`).

---

### Task 4.5: Write integration tests for dispatch endpoints

**File:** `apps/api/src/__tests__/dispatch.test.ts` (new)
**Status:** todo
**Dependencies:** 4.1, 4.2, 4.3, 4.4

Write integration tests using `withTestDb()` and `createTestApp()`.

**Test cases to implement (from spec Testing Strategy section):**

1. **`GET /dispatch/next` — happy path:** Seed 3 issues with different priorities (status='todo'), call dispatch/next, verify highest-priority issue returned with status='in_progress', verify prompt is hydrated (non-empty string), verify meta contains templateSlug, versionId, etc.

2. **`GET /dispatch/next` — no eligible issues:** Seed issues with status='done' and 'in_progress' only, call dispatch/next, verify 204 No Content.

3. **`GET /dispatch/next` — blocked issue excluded:** Seed issue A (todo) blocked by issue B (todo), seed issue C (todo, lower priority, unblocked), call dispatch/next, verify C is returned, not A.

4. **`GET /dispatch/next` — blocked by done issue not excluded:** Seed issue A (todo) blocked by issue B (done), call dispatch/next, verify A is returned.

5. **`GET /dispatch/next` — project filter:** Seed issues in different projects, call dispatch/next?project=X, verify only project X issues considered.

6. **`GET /dispatch/next` — soft-deleted excluded:** Seed a soft-deleted todo issue, call dispatch/next, verify 204.

7. **`GET /dispatch/next` — template selection and hydration:** Seed a signal issue + the default signal-triage template, call dispatch/next, verify prompt contains signal-specific instructions.

8. **`GET /dispatch/next` — no matching template:** Delete all templates, seed an issue, call dispatch/next, verify issue returned with prompt=null.

9. **`GET /dispatch/queue` — returns scored list:** Seed 5 issues with varying priorities, call dispatch/queue, verify sorted by score descending, verify score breakdown included.

10. **`GET /dispatch/queue` — pagination:** Seed 10 issues, request limit=3 offset=0 then offset=3, verify correct items and total count.

11. **`GET /templates/preview/:issueId` — happy path:** Seed issue + matching template, call preview, verify template selected and prompt hydrated.

12. **`GET /templates/preview/:issueId` — issue not found:** Call with non-existent ID, verify 404.

**Verification:** `npx vitest run apps/api/src/__tests__/dispatch.test.ts` — all tests pass.

---

## Phase E: Enhanced Prompt Reviews

### Task 5.1: Replace simple average with EWMA scoring in prompt-reviews.ts

**File:** `apps/api/src/routes/prompt-reviews.ts` (modify)
**Status:** todo
**Dependencies:** Phase A (constants)

Replace the current simple average review score calculation with Exponentially Weighted Moving Average (EWMA).

**Constants to add at top of file:**

```typescript
/** EWMA smoothing factor — higher = more weight on recent reviews */
export const EWMA_ALPHA = 0.3

/** Score threshold below which improvement issue is triggered */
export const REVIEW_SCORE_THRESHOLD = 3.5

/** Review count threshold that also triggers improvement */
export const REVIEW_COUNT_THRESHOLD = 15

/** Minimum number of reviews before thresholds are checked */
export const REVIEW_MIN_SAMPLES = 3
```

**Replace the existing score calculation block** (the `scoreResult` + `reviewScore` + update section) with:

```typescript
// Compute composite score for this review
const composite = (body.clarity + body.completeness + body.relevance) / 3

// Fetch current version with its review score
const [currentVersion] = await db
  .select()
  .from(promptVersions)
  .where(eq(promptVersions.id, body.versionId))

// EWMA update
const newScore = currentVersion.reviewScore === null
  ? composite
  : EWMA_ALPHA * composite + (1 - EWMA_ALPHA) * currentVersion.reviewScore

// Update version with new EWMA score
await db
  .update(promptVersions)
  .set({ reviewScore: newScore })
  .where(eq(promptVersions.id, body.versionId))
```

**Remove** the old `avg()` subquery computation entirely — it is replaced by the EWMA calculation above.

**Verification:** First review sets score directly. Second review applies EWMA formula. `npm run typecheck` passes.

---

### Task 5.2: Add improvement loop trigger (threshold check + auto-create issue)

**File:** `apps/api/src/routes/prompt-reviews.ts` (append after EWMA update)
**Status:** todo
**Dependencies:** 5.1

Add the prompt improvement loop trigger that auto-creates improvement issues when prompt quality degrades below thresholds.

**Code to add after the EWMA score update in the POST handler:**

```typescript
import { count } from 'drizzle-orm'
import { promptTemplates, issues, labels, issueLabels } from '../db/schema'

// Count reviews for this version
const [{ count: reviewCount }] = await db
  .select({ count: count() })
  .from(promptReviews)
  .where(eq(promptReviews.versionId, body.versionId))

// Only check thresholds if minimum samples met
if (Number(reviewCount) >= REVIEW_MIN_SAMPLES) {
  const shouldCreateIssue =
    newScore < REVIEW_SCORE_THRESHOLD ||
    Number(reviewCount) >= REVIEW_COUNT_THRESHOLD

  if (shouldCreateIssue) {
    // Fetch the template for this version
    const [template] = await db
      .select()
      .from(promptTemplates)
      .where(eq(promptTemplates.id, currentVersion.templateId))

    // Check if an improvement issue already exists (prevent duplicates)
    const existingImprovementTitle = `Improve prompt template: ${template.slug}`
    const [existingIssue] = await db
      .select({ id: issues.id })
      .from(issues)
      .where(
        and(
          sql`${issues.title} LIKE ${existingImprovementTitle + '%'}`,
          sql`${issues.status} NOT IN ('done', 'canceled')`,
          isNull(issues.deletedAt)
        )
      )

    if (!existingIssue) {
      // Auto-create improvement issue
      const [improvementIssue] = await db.insert(issues).values({
        title: `Improve prompt template: ${template.slug} (avg review ${newScore.toFixed(1)}/5, ${reviewCount} reviews since v${currentVersion.version})`,
        type: 'task',
        status: 'todo',
        priority: 3, // medium
        description: [
          `## Prompt Improvement Required`,
          ``,
          `Template **${template.slug}** (${template.name}) has degraded quality.`,
          ``,
          `- EWMA Score: ${newScore.toFixed(2)}/5`,
          `- Review Count: ${reviewCount}`,
          `- Version: v${currentVersion.version}`,
          `- Version ID: ${currentVersion.id}`,
          ``,
          `## Action Required`,
          ``,
          `1. Review recent feedback on this template`,
          `2. Create a new version addressing the issues`,
          `3. Promote the new version to active`,
        ].join('\n'),
      }).returning()

      // Create/find "prompt-improvement" and "meta" labels, link to issue
      for (const labelName of ['prompt-improvement', 'meta']) {
        await db.execute(
          sql`INSERT INTO labels (id, name, color, created_at)
              VALUES (${`lbl_${labelName}`}, ${labelName}, ${labelName === 'meta' ? '#6b7280' : '#f59e0b'}, NOW())
              ON CONFLICT (name) DO NOTHING`
        )
        const [label] = await db
          .select({ id: labels.id })
          .from(labels)
          .where(eq(labels.name, labelName))
        if (label) {
          await db.insert(issueLabels).values({
            issueId: improvementIssue.id,
            labelId: label.id,
          }).onConflictDoNothing()
        }
      }
    }
  }
}
```

**Required additional imports:**
```typescript
import { and, isNull, sql } from 'drizzle-orm'
import { promptTemplates, issues, labels, issueLabels } from '../db/schema'
```

**Verification:** Submitting 3+ low-score reviews triggers automatic improvement issue creation. Duplicate prevention works (no second issue created). Below REVIEW_MIN_SAMPLES, no issue created.

---

### Task 5.3: Write integration tests for EWMA and improvement loop

**File:** `apps/api/src/__tests__/dispatch.test.ts` (append) or `apps/api/src/__tests__/prompt-reviews.test.ts` (new)
**Status:** todo
**Dependencies:** 5.1, 5.2

Write integration tests for the enhanced prompt review system.

**Test cases (from spec):**

1. **EWMA score update:**
   - Create template + version + issue
   - Submit review (clarity=4, completeness=5, relevance=3) -> composite = 4.0
   - Verify version.reviewScore = 4.0 (first review, set directly)
   - Submit second review (clarity=2, completeness=2, relevance=2) -> composite = 2.0
   - Verify version.reviewScore = 0.3 * 2.0 + 0.7 * 4.0 = 3.4

2. **Improvement issue auto-creation:**
   - Submit 3 reviews with low scores (all 2/5)
   - Verify an improvement issue was created with type='task', title containing template slug
   - Verify issue is in 'todo' status

3. **Duplicate prevention:**
   - Trigger improvement issue creation
   - Submit another low review
   - Verify no second improvement issue created

4. **Min samples respected:**
   - Submit 1 low review (score=1.0)
   - Verify no improvement issue created (below REVIEW_MIN_SAMPLES=3)

**Verification:** `npx vitest run apps/api/src/__tests__/prompt-reviews.test.ts` — all tests pass.

---

## Phase F: Integration Verification

### Task 6.1: Run full test suite, typecheck, linter — verify everything passes

**Status:** todo
**Dependencies:** ALL previous tasks

Run the complete verification suite to confirm all Phase 2 work integrates correctly:

```bash
# 1. Run full test suite
npm test

# 2. Run type checker
npm run typecheck

# 3. Run linter
npm run lint

# 4. Run formatter check
npm run format:check
```

**Expected results:**
- All existing Phase 1 tests still pass (no regressions)
- All new Phase 2 tests pass (priority-scoring, prompt-engine, dispatch, prompt-reviews)
- TypeScript reports zero errors
- ESLint reports zero errors
- Prettier formatting is consistent

**If any failures:** Fix issues and re-run until clean.

**Verification:** All 4 commands exit with code 0.

---

## Summary

| Phase | Tasks | New Files | Modified Files |
|-------|-------|-----------|----------------|
| A: Pure Functions | 1.1-1.5 | priority-scoring.ts, prompt-engine.ts (partial), 2 test files | package.json |
| B: Handlebars | 2.1-2.5 | partials.ts | prompt-engine.ts, templates.ts, prompt-engine.test.ts |
| C: Migration | 3.1 | 0002_seed_default_templates.sql | — |
| D: Dispatch | 4.1-4.5 | dispatch.ts, dispatch.test.ts | app.ts, templates.ts |
| E: Reviews | 5.1-5.3 | prompt-reviews.test.ts | prompt-reviews.ts |
| F: Verify | 6.1 | — | — |
| **Total** | **18** | **8** | **4** |
