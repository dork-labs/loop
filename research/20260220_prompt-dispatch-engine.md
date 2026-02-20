# Research: Prompt & Dispatch Engine

**Date:** 2026-02-20
**Feature:** prompt-dispatch-engine
**Depth:** Deep Research (15 tool calls)

---

## Research Summary

This report covers six technical areas required to build the Prompt & Dispatch Engine for Loop: Handlebars.js in TypeScript, priority queue / scoring patterns in PostgreSQL, template selection / matching algorithms, prompt review feedback loops, database seeding strategies in Drizzle ORM, and testing strategies using the existing PGlite/Vitest infrastructure. Each section provides concrete patterns grounded in the existing codebase (`prompts.ts`, `issues.ts`, `setup.ts`) with pros, cons, and a clear recommendation.

---

## RESEARCH FINDINGS

---

### 1. Handlebars.js in TypeScript APIs

#### Potential Solutions

**A. Runtime compile with Map-based cache (recommended)**

Compile templates on first use and cache the compiled function in a `Map<string, HandlebarsTemplateDelegate>`. Subsequent calls skip compilation entirely.

```typescript
import Handlebars from 'handlebars'

const templateCache = new Map<string, HandlebarsTemplateDelegate>()

export function compileTemplate(content: string): HandlebarsTemplateDelegate {
  const cached = templateCache.get(content)
  if (cached) return cached

  const compiled = Handlebars.compile(content, {
    strict: true,        // throw on missing properties (no silent undefined)
    noEscape: false,     // keep HTML escaping enabled
    preventIndent: true, // avoid whitespace surprises in multiline templates
  })

  templateCache.set(content, compiled)
  return compiled
}
```

Pros: Simple, no file system dependency, works identically in Vercel Functions and Node.js local dev, cache survives across requests within a warm instance.

Cons: Cold starts re-compile; cache is per-process (not shared across serverless instances).

**B. Startup precompilation**

At server startup, load all active prompt versions from the database and compile them into a module-level Map.

Pros: Zero per-request compilation latency.

Cons: Adds database read to startup path, complicates hot-reload in dev, requires cache invalidation logic when a new version is promoted.

**C. Precompiled template strings (Handlebars CLI)**

Use `handlebars --precompile` to generate JavaScript that registers templates directly without the runtime compiler. Ship these as `.js` modules.

Pros: Fastest possible execution, smallest runtime bundle.

Cons: Requires a build step, templates must be file-based (not DB-stored), incompatible with the dynamic DB-driven template model Loop uses.

#### Security Considerations

- **SSTI (Server-Side Template Injection):** The critical rule: _never_ pass user input as the template string itself. Templates live in the DB (`prompt_versions.content`) and are authored by humans/agents, not end-user request data. User/issue data is only ever the _context_ passed to a compiled template, not the template source.
- **Triple braces `{{{…}}}`:** Disable or ban via ESLint custom rule. They bypass HTML escaping and are almost never needed in prompt templates.
- **Prototype pollution:** Handlebars >= 4.6.0 blocks prototype property access by default. Pin to a version above this and ensure `allowProtoPropertiesByDefault` and `allowProtoMethodsByDefault` remain `false` (their defaults).
- **Custom helpers:** Any helper using `new Handlebars.SafeString(...)` must sanitize its input first. Avoid `SafeString` unless the helper's output is known-clean.
- **Version pinning:** Keep `handlebars` updated. Check `npm audit` in CI — several historical prototype pollution CVEs have been patched in minor releases.

#### Performance Considerations

- Compilation is the most expensive Handlebars operation. Caching with a `Map<string, HandlebarsTemplateDelegate>` (keyed on template content or version ID) eliminates repeat compilation cost.
- In serverless environments (Vercel Functions), the cache warms quickly and stays warm for the lifetime of the function instance.
- Register custom helpers once at module load time using `Handlebars.registerHelper(name, fn)`. Do not re-register per request.
- Partials (reusable sub-templates like `{{> issue_context}}`) should be registered at startup and cached by Handlebars internally.

#### Recommendation

Use **Option A** (runtime compile + Map cache), keyed by `promptVersion.id` rather than raw content (avoids hashing long strings). Register all helpers and partials at module initialization. Enforce a lint rule banning triple-brace syntax in `.hbs` or template string content. Example structure:

```
apps/api/src/
  prompt-engine/
    compile.ts      ← compile() + cache
    helpers.ts      ← registerHelpers() called once at startup
    partials.ts     ← registerPartials() called once at startup
    hydrate.ts      ← hydrateTemplate(version, context) → string
```

---

### 2. Priority Queue / Scoring Algorithm Patterns

#### Potential Solutions

**A. SQL composite priority score with `FOR UPDATE SKIP LOCKED` (recommended)**

Compute a composite score in the `ORDER BY` clause of the dispatch query. Atomically claim the highest-priority unclaimed issue in a single transaction.

```sql
-- Dispatch: claim the highest-priority available issue for an agent
UPDATE issues
SET
  status        = 'in_progress',
  agent_session_id = $agentSessionId,
  updated_at    = now()
WHERE id = (
  SELECT id
  FROM issues
  WHERE
    status        = 'todo'
    AND deleted_at IS NULL
    AND project_id = $projectId   -- optional scope
  ORDER BY
    -- Composite score: explicit priority wins, then decay by age
    priority DESC,
    EXTRACT(EPOCH FROM (now() - created_at)) / 86400.0 * 0.1 DESC,
    -- Tiebreak: deterministic ordering
    created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED
)
RETURNING *;
```

The `FOR UPDATE SKIP LOCKED` clause inside the subquery means: "lock this row for update; if another transaction already holds a lock on it, skip it and try the next row." This is fully atomic — no two agents can claim the same issue.

The outer `UPDATE` immediately sets `status = 'in_progress'` and records the `agent_session_id`. If the inner `SELECT` returns nothing (all matching issues are locked), the `UPDATE` is a no-op and returns zero rows, which is the signal to the agent to back off.

**B. Application-level optimistic locking**

Use a `version` integer column. Agent reads the issue, then updates it with `WHERE version = $readVersion`. If another agent already incremented the version, the update returns 0 rows and the agent retries.

Pros: No special SQL syntax, works with any ORM.

Cons: Requires retry logic, still has a window for contention, more round trips.

**C. PostgreSQL advisory locks**

Acquire a session-level advisory lock keyed on the issue's numeric ID (`pg_try_advisory_lock(issue.number)`) before claiming. Release when done.

Pros: Can lock at application-level without holding a row lock, flexible scope.

Cons: Session-level locks persist across transactions if not explicitly released — a crashed worker can deadlock other workers until the session ends (connection pool timeout). Transaction-level advisory locks are safer but add complexity.

#### Priority Score Formula

Decompose priority into weighted components (normalized 0–1 each):

```
score = (w_explicit × normalized_priority)
      + (w_age      × age_days_normalized)
      + (w_type     × type_weight)
```

In practice, for Loop's issue model:

| Factor | Formula | Rationale |
|--------|---------|-----------|
| Explicit priority | `issues.priority / 10.0` | Direct human/agent signal |
| Age | `LEAST(age_days / 30.0, 1.0)` | Prevents starvation |
| Issue type | `CASE type WHEN 'task' THEN 1.0 WHEN 'hypothesis' THEN 0.7 WHEN 'monitor' THEN 0.5 ELSE 0.3 END` | Actionable types first |

Weights can start at `0.6 / 0.2 / 0.2` and be tuned later.

#### Race Condition Prevention

The `FOR UPDATE SKIP LOCKED` pattern is the industry-standard approach, used by Solid Queue (37signals), PG Boss, Graphile Worker, and Inferable. It provides:

- Zero deadlocks (skipping = non-blocking)
- Atomic claim (no double-processing)
- No retry storms (workers move to next available)
- Intentional inconsistency by design (exactly what a dispatch queue needs)

**Required index** for performance:

```sql
CREATE INDEX idx_issues_dispatch
  ON issues (project_id, status, priority DESC, created_at ASC)
  WHERE deleted_at IS NULL AND status = 'todo';
```

A partial index on `status = 'todo'` keeps the index small and the dispatch query fast.

#### Recommendation

Use **Option A** exclusively. The `FOR UPDATE SKIP LOCKED` pattern is already well-suited to Neon's serverless PostgreSQL. Implement the dispatch as a Drizzle `db.transaction()` call wrapping a raw SQL `sql\`...\`` query (Drizzle's relational query builder does not yet support `FOR UPDATE SKIP LOCKED` natively; use `db.execute(sql\`...\`)` inside the transaction).

---

### 3. Template Selection / Matching Algorithms

#### Potential Solutions

The existing `promptTemplates.conditions` column is a `jsonb` field, and `promptTemplates.specificity` is already an `integer`. This schema anticipates a CSS-specificity-style selection system.

**A. Specificity-scored condition matching (recommended)**

Each template has a `conditions` JSON object defining key-value match criteria against the incoming issue context. The template with the highest `specificity` score that fully satisfies all its conditions wins.

```typescript
type TemplateConditions = {
  issueType?: IssueType | IssueType[]
  projectId?: string
  labelIds?: string[]        // issue must have ALL listed labels
  signalSource?: string
  priorityMin?: number
  priorityMax?: number
}

type IssueContext = {
  issueType: IssueType
  projectId: string | null
  labelIds: string[]
  signalSource: string | null
  priority: number
}

function matchesConditions(
  conditions: TemplateConditions,
  context: IssueContext,
): boolean {
  if (conditions.issueType) {
    const allowed = Array.isArray(conditions.issueType)
      ? conditions.issueType
      : [conditions.issueType]
    if (!allowed.includes(context.issueType)) return false
  }
  if (conditions.projectId && conditions.projectId !== context.projectId) return false
  if (conditions.labelIds?.length) {
    const hasAll = conditions.labelIds.every((id) => context.labelIds.includes(id))
    if (!hasAll) return false
  }
  if (conditions.signalSource && conditions.signalSource !== context.signalSource) return false
  if (conditions.priorityMin != null && context.priority < conditions.priorityMin) return false
  if (conditions.priorityMax != null && context.priority > conditions.priorityMax) return false
  return true
}

function selectTemplate(
  templates: Array<{ conditions: TemplateConditions; specificity: number; id: string }>,
  context: IssueContext,
): string | null {
  const candidates = templates
    .filter((t) => matchesConditions(t.conditions, context))
    .sort((a, b) => b.specificity - a.specificity)

  return candidates[0]?.id ?? null
}
```

A "catch-all" template has `conditions = {}` and `specificity = 0`. Any template with specific conditions gets a higher specificity score (e.g., 10 per condition field matched). The number of conditions present can auto-derive specificity at creation time:

```typescript
function deriveSpecificity(conditions: TemplateConditions): number {
  return Object.keys(conditions).filter(
    (k) => conditions[k as keyof TemplateConditions] != null
  ).length * 10
}
```

**B. Rete algorithm / rules engine**

Use a library like `rules-engine-ts` or implement a Rete network. Rete is optimized for many rules evaluated against many facts repeatedly.

Pros: Extremely efficient for large rule sets (50+ templates).

Cons: Significant complexity, overkill for the expected template count (tens, not thousands), obscures the matching logic.

**C. SQL-side filtering**

Push condition matching into PostgreSQL using `jsonb` operators (`@>`, `?`, etc.) to filter matching templates at query time.

Pros: Works for simple equality conditions, no application-side filtering.

Cons: Complex conditions (range checks, array containment with `AND` semantics, enum arrays) become difficult to express in SQL `jsonb` operators. Hard to debug and extend.

#### Recommendation

Use **Option A**. The `matchesConditions` function is a pure function with zero dependencies — trivially unit-testable. Specificity is stored in the DB column (already in schema) and auto-derived at template creation time. Keep the condition schema in a Zod type (`TemplateConditionsSchema`) so it is validated on write. Start with the ~6 condition fields above; add more as needed without touching the DB schema.

---

### 4. Prompt Review / Feedback Loop Systems

#### Potential Solutions

The existing `promptReviews` table has `clarity`, `completeness`, and `relevance` (each 1–5), and `promptVersions` has a `reviewScore` (double precision). The feedback loop needs to:
1. Aggregate new review scores onto the version.
2. Trigger actions (auto-create issues, auto-retire versions) at thresholds.

**A. Exponentially Weighted Moving Average (EWMA) — recommended**

EWMA gives more weight to recent reviews than old ones. This is ideal because prompt quality can drift: a prompt that was 4.5/5 six months ago but is now 2.0/5 should reflect the recent decline, not the historical mean.

```typescript
const EWMA_ALPHA = 0.3   // λ: 0.3 weights recent reviews heavily; 0.1 is more conservative

function computeEwmaScore(
  current: number | null,
  incoming: number,
  alpha: number = EWMA_ALPHA,
): number {
  if (current == null) return incoming
  // EWMA formula: new = α × incoming + (1 − α) × old
  return alpha * incoming + (1 - alpha) * current
}
```

The composite review score for a version is computed from the three sub-scores:

```typescript
function reviewToScore(review: { clarity: number; completeness: number; relevance: number }): number {
  // Equal-weight average of three 1-5 dimensions, normalized to 0-1
  return (review.clarity + review.completeness + review.relevance) / 15
}
```

After creating a `promptReview`, run an update:

```typescript
const score = reviewToScore(newReview)
const updated = computeEwmaScore(version.reviewScore, score)
await db.update(promptVersions)
  .set({ reviewScore: updated })
  .where(eq(promptVersions.id, versionId))
```

**B. Simple rolling average**

Keep a running sum and count, divide. Easy to implement.

Pros: Deterministic, easy to understand.

Cons: A version with 100 good old reviews will dilute 10 recent bad ones significantly — misses degradation signals.

**C. Windowed average (last N reviews)**

Store the last N review scores in a `jsonb` array column, compute mean.

Pros: Pure recency, ignores all history beyond window.

Cons: Requires storing review history redundantly, schema complexity, window-boundary artifacts.

#### Threshold-Based Auto-Actions

Define thresholds as constants (not magic numbers):

```typescript
const REVIEW_THRESHOLD_RETIRE = 0.35    // score below 35% → auto-retire (≈ 1.75/5 avg)
const REVIEW_THRESHOLD_WARN   = 0.50    // score below 50% → create degradation issue
const REVIEW_MIN_SAMPLES      = 3       // ignore threshold checks until 3 reviews exist
```

After each review insertion, check thresholds:

```typescript
async function handleReviewThresholds(
  db: DbType,
  version: PromptVersion,
  newScore: number,
): Promise<void> {
  if (version.usageCount < REVIEW_MIN_SAMPLES) return

  if (newScore < REVIEW_THRESHOLD_RETIRE && version.status === 'active') {
    // Auto-retire the version
    await db.update(promptVersions)
      .set({ status: 'retired' })
      .where(eq(promptVersions.id, version.id))
    // Create a 'task' issue for human review
    await createDegradationIssue(db, version, 'critical')
  } else if (newScore < REVIEW_THRESHOLD_WARN) {
    await createDegradationIssue(db, version, 'warning')
  }
}
```

#### Recommendation

Use **Option A** (EWMA with α = 0.3) for the rolling score. This is the same algorithm used by monitoring systems (EWMA control charts, Redis's latency tracking). It is a single multiply-add per review — O(1) storage, O(1) compute. Use `REVIEW_MIN_SAMPLES = 3` to prevent a single bad review from triggering auto-retire.

---

### 5. Database Seeding Strategies

#### Potential Solutions

Loop needs to ship default prompt templates (e.g., a generic issue-triaging template, a code-review template) that exist in any new deployment without manual setup.

**A. Custom Drizzle migration with `ON CONFLICT DO NOTHING` (recommended)**

Generate an empty migration file (`drizzle-kit generate --custom`) and write `INSERT ... ON CONFLICT DO NOTHING` SQL. This seed runs exactly once via the normal `db:migrate` command and is idempotent.

```sql
-- 0005_seed_default_prompt_templates.sql
INSERT INTO prompt_templates (id, slug, name, description, conditions, specificity, created_at, updated_at)
VALUES
  (
    'cm_default_triage_template',
    'default-triage',
    'Default Issue Triage',
    'Catch-all triage prompt for any issue type.',
    '{}',
    0,
    now(),
    now()
  )
ON CONFLICT (slug) DO NOTHING;

INSERT INTO prompt_versions (id, template_id, version, content, author_type, author_name, status, usage_count, created_at)
VALUES
  (
    'cm_default_triage_v1',
    'cm_default_triage_template',
    1,
    'You are an AI agent. Analyze issue #{{issue.number}}: {{issue.title}}\n\nDescription: {{issue.description}}\n\nRecommend the next action.',
    'human',
    'system',
    'active',
    0,
    now()
  )
ON CONFLICT DO NOTHING;

-- Set the active version
UPDATE prompt_templates
SET active_version_id = 'cm_default_triage_v1'
WHERE id = 'cm_default_triage_template'
  AND active_version_id IS NULL;
```

Pros: Runs as part of `npm run db:migrate`, zero extra tooling, idempotent, version-controlled alongside schema, works in CI/CD pipelines.

Cons: Hard-coded IDs — must use well-known stable IDs (fine for system defaults, not for user data).

**B. Separate `seed.ts` script**

A standalone TypeScript script (`npm run db:seed`) using Drizzle's `db.insert().onConflictDoNothing()`.

Pros: Full TypeScript, type-safe, readable.

Cons: Separate command to run/remember, not automatically part of migration flow, CI must call it explicitly.

**C. Drizzle `drizzle-seed` library**

Use the `drizzle-seed` package with deterministic seed numbers for fake data.

Pros: Great for test fixtures and development.

Cons: Generates fake/random data, not appropriate for production default templates with specific content.

**D. Application startup seeding**

On server start, check if default templates exist and insert if missing.

Pros: Always runs.

Cons: Adds latency to cold starts, race conditions in concurrent serverless instances, harder to test, mixes seeding with application code.

#### Recommendation

Use **Option A** for production system defaults: a custom Drizzle migration with hard-coded stable IDs and `ON CONFLICT DO NOTHING`. Use **Option B** (`seed.ts` script) as a supplementary dev/staging tool for richer test fixtures. Never use startup seeding.

---

### 6. Testing Strategies

#### Overview of Existing Infrastructure

The project already has an excellent test foundation in `apps/api/src/__tests__/setup.ts`:
- `withTestDb()` — spins up a fresh PGlite in-memory database per test with full migrations applied
- `createTestApp()` — injects the test DB into a Hono app context
- Migrations are applied from `apps/api/drizzle/migrations/` — meaning seeded test data in migrations appears in tests automatically

#### Testing Template Selection Logic

Template selection (`matchesConditions`, `selectTemplate`) is a pure function with no DB or IO dependencies. Test it with Vitest directly:

```typescript
describe('selectTemplate', () => {
  it('selects the most specific matching template', () => {
    const templates = [
      { id: 'generic', conditions: {}, specificity: 0 },
      { id: 'task-only', conditions: { issueType: 'task' }, specificity: 10 },
      { id: 'task-project', conditions: { issueType: 'task', projectId: 'proj_1' }, specificity: 20 },
    ]
    const context: IssueContext = {
      issueType: 'task',
      projectId: 'proj_1',
      labelIds: [],
      signalSource: null,
      priority: 5,
    }
    expect(selectTemplate(templates, context)).toBe('task-project')
  })

  it('falls back to catch-all when no specific template matches', () => {
    // ...
  })
})
```

No database needed. These tests run in microseconds.

#### Testing Handlebars Rendering

```typescript
describe('hydrateTemplate', () => {
  it('interpolates issue context into the template', () => {
    const content = 'Issue #{{issue.number}}: {{issue.title}}'
    const context = { issue: { number: 42, title: 'Fix login bug' } }
    const result = hydrateTemplate(content, context)
    expect(result).toBe('Issue #42: Fix login bug')
  })

  it('throws on missing required properties in strict mode', () => {
    const content = '{{issue.missingField}}'
    expect(() => hydrateTemplate(content, { issue: {} })).toThrow()
  })
})
```

#### Testing Atomic Dispatch (Database Integration)

Use `withTestDb()` with concurrent test workers to verify the `FOR UPDATE SKIP LOCKED` claim pattern. Run two dispatch calls simultaneously and assert each gets a distinct issue:

```typescript
describe('dispatch', () => {
  withTestDb()

  it('prevents two agents claiming the same issue', async () => {
    const db = getTestDb()
    // Seed one issue
    await db.insert(issues).values({ title: 'Test', type: 'task', status: 'todo', priority: 5 })

    // Simulate two concurrent dispatch calls
    const [result1, result2] = await Promise.all([
      claimNextIssue(db, 'agent-1'),
      claimNextIssue(db, 'agent-2'),
    ])

    // Only one agent should have claimed the issue
    const claimed = [result1, result2].filter(Boolean)
    expect(claimed).toHaveLength(1)
  })
})
```

Note: PGlite runs in a single Node.js process with cooperative concurrency. True concurrent locking behavior is best verified with integration tests against a real Neon database in CI. PGlite tests verify the SQL logic is correct; the locking semantics are proven by PostgreSQL itself.

#### Testing Priority Scoring Determinism

```typescript
it('claims the highest-priority todo issue first', async () => {
  const db = getTestDb()
  await db.insert(issues).values([
    { title: 'Low priority', type: 'task', status: 'todo', priority: 1 },
    { title: 'High priority', type: 'task', status: 'todo', priority: 9 },
    { title: 'Medium priority', type: 'task', status: 'todo', priority: 5 },
  ])

  const claimed = await claimNextIssue(db, 'agent-1')
  expect(claimed?.title).toBe('High priority')
})
```

#### Testing EWMA Review Score Computation

The EWMA function is pure — test without any DB:

```typescript
describe('computeEwmaScore', () => {
  it('returns the incoming score when there is no prior score', () => {
    expect(computeEwmaScore(null, 0.8)).toBe(0.8)
  })

  it('weights recent scores higher than historical', () => {
    // Historical score was 0.9, new review is 0.2 — EWMA should fall significantly
    const result = computeEwmaScore(0.9, 0.2, 0.3)
    expect(result).toBeCloseTo(0.69, 2)   // 0.3 * 0.2 + 0.7 * 0.9 = 0.69
    expect(result).toBeLessThan(0.9)
  })
})
```

---

## Detailed Analysis

### Handlebars vs Alternatives

Other TypeScript templating options were considered:

- **Mustache**: Logic-less, even simpler, no helpers. Too limiting for prompt templates that may need conditional sections (`{{#if issue.hypothesis}}`).
- **Nunjucks**: More powerful (loops, filters, inheritance), but more complex API surface and larger bundle.
- **Template literals**: Native TypeScript, zero dependencies, but no safe escaping, no DB-stored templates.

Handlebars is the right choice: logic-limited (discourages complex template logic), widely understood, active maintenance (4.7.x series), TypeScript types available (`@types/handlebars`).

### Dispatch Architecture

The dispatch endpoint (`POST /api/dispatch` or similar) should follow this sequence:

1. Receive dispatch request with agent context (`agentSessionId`, optional `projectId`)
2. Run the composite `SELECT ... FOR UPDATE SKIP LOCKED` + `UPDATE` in a single transaction
3. If an issue is claimed: run template selection against the issue context
4. Compile and hydrate the selected template version
5. Return `{ issue, promptContent }` to the agent
6. Agent works, then POSTs a review to `/api/prompt-reviews`
7. Review insertion triggers EWMA update + threshold check

This entire flow should be a single route handler using `db.transaction()`.

### Conditions Schema Design

The `conditions` JSONB column should be validated by a Zod schema on every write:

```typescript
const TemplateConditionsSchema = z.object({
  issueType: z.union([IssueTypeSchema, z.array(IssueTypeSchema)]).optional(),
  projectId: z.string().cuid2().optional(),
  labelIds: z.array(z.string().cuid2()).optional(),
  signalSource: z.string().optional(),
  priorityMin: z.number().int().min(0).max(10).optional(),
  priorityMax: z.number().int().min(0).max(10).optional(),
}).strict()   // reject unknown keys — future conditions must be explicitly added
```

The `.strict()` call prevents silently-ignored condition keys from being stored (which would make a template appear non-specific when it was intended to be specific).

---

## Security Considerations

| Risk | Mitigation |
|------|-----------|
| SSTI via user-authored templates | Templates authored by humans/agents in trusted DB, not from request input. Never call `Handlebars.compile(req.body.template)`. |
| Triple-brace XSS | Ban `{{{` via ESLint rule or grep CI check. |
| Prototype pollution | Pin `handlebars >= 4.6.0`, keep updated, never set `allowProtoPropertiesByDefault = true`. |
| Race condition in dispatch | `FOR UPDATE SKIP LOCKED` eliminates this at the database level. |
| Advisory lock leaks | Avoid advisory locks for dispatch — `SKIP LOCKED` is sufficient and leak-safe. |
| Condition schema injection | Validate `conditions` JSON with Zod `.strict()` on every insert/update. |
| Threshold manipulation | Thresholds are code constants, not DB-configurable, preventing configuration drift attacks. |

---

## Performance Considerations

| Area | Strategy |
|------|---------|
| Template compilation | `Map<versionId, HandlebarsTemplateDelegate>` cache, compiled once per version ID per process lifetime |
| Dispatch query | Partial index on `(status = 'todo', priority DESC, created_at ASC)` — small, fast, covers the exact query shape |
| Template selection | In-memory pure function — O(n × c) where n = template count and c = condition fields; negligible for n < 1000 |
| Review score update | Single UPDATE per review, no aggregation query needed (EWMA is O(1)) |
| Handlebars helpers | Register once at module load, reused across all requests |
| PGlite test speed | Snapshot pattern (restore from snapshot vs. re-migrate) reduces test setup from ~575ms to ~190ms if needed |

---

## Contradictions and Disputes

- **EWMA alpha value**: Literature recommends λ between 0.2 and 0.3 as a starting point. A value of 0.3 reacts to change quickly (good for detecting prompt degradation). A value of 0.1 is more conservative and less reactive to a single bad review. Start at 0.3 and tune based on observed false-positive retire rates.
- **Migration-based seeding vs. startup seeding**: Some sources suggest startup seeding for simplicity. This is categorically wrong for a serverless deployment — Vercel Functions can cold-start multiple instances simultaneously, creating a race condition window. Migration-based seeding with `ON CONFLICT DO NOTHING` is the safe choice.
- **Advisory locks vs SKIP LOCKED**: The PostgreSQL documentation treats both as valid for queue use. However, advisory locks require explicit session-level release, which is a correctness risk in connection-pooled environments. `SKIP LOCKED` has no such risk and is the near-universal choice in modern PostgreSQL job queues.

---

## Research Gaps and Limitations

- **Handlebars partial caching**: The behavior of Handlebars' internal partial cache when the same partial is registered multiple times (e.g., across request handlers) is not well-documented. The recommendation to register partials once at startup sidesteps this.
- **SKIP LOCKED with PGlite**: PGlite uses a single-process WASM PostgreSQL. Concurrent lock testing within PGlite via `Promise.all` may not accurately simulate row-level lock contention between separate connections. Full lock-contention testing requires a real PostgreSQL instance. This is acceptable — PGlite tests verify SQL correctness; PostgreSQL's locking implementation is trusted.
- **Handlebars compile() options in TypeScript**: The `@types/handlebars` types may not fully reflect all runtime compile options. Verify `strict` and `preventIndent` are available in the installed type version.

---

## Sources and Evidence

- "SKIP LOCKED provides an inconsistent view of the data by design. This is why it's perfect for queue-like tables where we want to distribute work." - [The Unreasonable Effectiveness of SKIP LOCKED](https://www.inferable.ai/blog/posts/postgres-skip-locked)
- "Inferable's approach updates job status atomically while claiming: setting status to 'running', decrementing remaining attempts, and recording the executing machine ID in a single UPDATE statement." - [Inferable SKIP LOCKED](https://www.inferable.ai/blog/posts/postgres-skip-locked)
- "Never compile templates from untrusted sources. Instead, only use predefined templates and sanitize inputs before rendering." - [Handlebars JS Safe Usage](https://xygeni.io/blog/handlebars-js-safe-usage-to-avoid-injection-flaws/)
- "HandleBars introduced a new restriction to forbidden access prototype properties and methods of the context object by default since 4.6.0" - [Handlebars Security](https://xygeni.io/blog/handlebars-js-safe-usage-to-avoid-injection-flaws/)
- "Each test receives a fresh, isolated database instance rather than relying on transaction rollback." - [Fun & Sane Node.js TDD](https://nikolamilovic.com/posts/fun-sane-node-tdd-postgres-pglite-drizzle-vitest/)
- "Reduces per-test overhead from ~575ms to ~190ms, achieving approximately 3x faster test execution." - [Fun & Sane Node.js TDD](https://nikolamilovic.com/posts/fun-sane-node-tdd-postgres-pglite-drizzle-vitest/)
- "Drizzle lets you generate empty migration files to write your own custom SQL migrations for DDL alterations currently not supported by Drizzle Kit or data seeding" - [Drizzle ORM Custom Migrations](https://orm.drizzle.team/docs/kit-custom-migrations)
- "An exponential moving average gives more weight to recent reviews, never reaching zero for older observations." - [Moving Average - Wikipedia](https://en.wikipedia.org/wiki/Moving_average)
- Algolia's Rule Matching Algorithm uses specificity as the primary tiebreaker for rule precedence - [Algolia Rule Matching](https://www.algolia.com/doc/guides/managing-results/rules/rules-overview/in-depth/rule-matching-algorithm)
- PostgreSQL advisory locks: "if you acquire a session level lock from the application, it is the responsibility of the application to explicitly release that lock." - [PostgreSQL Explicit Locking](https://www.postgresql.org/docs/current/explicit-locking.html)

---

## Search Methodology

- Searches performed: 13 web searches + 4 page fetches
- Most productive search terms: "SKIP LOCKED Neon queue system", "Handlebars TypeScript security SSTI", "PGlite Vitest integration test", "Drizzle custom migration seeding"
- Primary information sources: PostgreSQL official docs, Handlebars official docs, Neon guides, Drizzle ORM docs, inferable.ai engineering blog, nikolamilovic.com testing guide
- Codebase files read: `prompts.ts`, `issues.ts`, `_helpers.ts`, `setup.ts` — to ground recommendations in the actual schema and test infrastructure
