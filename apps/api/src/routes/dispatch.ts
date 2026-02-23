import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { eq, and, isNull, count, notInArray, sql } from 'drizzle-orm';
import { issues, issueRelations, labels, issueLabels, goals } from '../db/schema';
import { promptTemplates, promptVersions } from '../db/schema';
import { scoreIssue } from '../lib/priority-scoring';
import type { ScoringInput } from '../lib/priority-scoring';
import { selectTemplate, buildHydrationContext, hydrateTemplate } from '../lib/prompt-engine';
import type { IssueContext, TemplateCandidate } from '../lib/prompt-engine';
import type { AppEnv } from '../types';

// ─── Validation schemas ──────────────────────────────────────────────────────

const nextQuerySchema = z.object({
  projectId: z.string().optional(),
});

const queueQuerySchema = z.object({
  projectId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// ─── Route handler ───────────────────────────────────────────────────────────

/** Dispatch routes — atomic claim and queue preview for AI agent work. */
export const dispatchRoutes = new Hono<AppEnv>();

/**
 * GET /next — Atomically claim the highest-priority unblocked todo issue.
 * Uses FOR UPDATE SKIP LOCKED to prevent concurrent agents from claiming the same issue.
 */
dispatchRoutes.get('/next', zValidator('query', nextQuerySchema), async (c) => {
  const db = c.get('db');
  const { projectId } = c.req.valid('query');

  const projectFilter = projectId ? sql`AND i.project_id = ${projectId}` : sql``;

  // Atomic claim: find highest-priority unblocked todo issue and set to in_progress
  const claimQuery = sql`
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
        ${projectFilter}
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
  `;

  const claimed = (await db.execute(claimQuery)) as { rows: Record<string, unknown>[] };
  const rows = claimed.rows;

  if (rows.length === 0) {
    return c.body(null, 204);
  }

  const raw = rows[0];

  // Map snake_case DB columns to the issue shape expected by prompt engine
  const claimedIssue = mapRowToIssue(raw);

  // Build IssueContext for template selection
  const issueContext = await buildIssueContext(db, claimedIssue);

  // Fetch all active templates and select the best match
  const allTemplates = await db
    .select({
      id: promptTemplates.id,
      slug: promptTemplates.slug,
      conditions: promptTemplates.conditions,
      specificity: promptTemplates.specificity,
      projectId: promptTemplates.projectId,
      activeVersionId: promptTemplates.activeVersionId,
    })
    .from(promptTemplates)
    .where(isNull(promptTemplates.deletedAt));

  const candidates: TemplateCandidate[] = allTemplates.map((t) => ({
    ...t,
    conditions: (t.conditions ?? {}) as TemplateCandidate['conditions'],
  }));

  let selected = selectTemplate(candidates, issueContext);

  // Fallback: find a default template for this issue type
  if (!selected) {
    selected = findDefaultTemplate(candidates, claimedIssue.type, issueContext);
  }

  if (!selected || !selected.activeVersionId) {
    // No template available — return the issue without a prompt
    return c.json({
      issue: summarizeIssue(claimedIssue),
      prompt: null,
      meta: null,
    });
  }

  // Fetch the active version content
  const [version] = await db
    .select()
    .from(promptVersions)
    .where(eq(promptVersions.id, selected.activeVersionId));

  if (!version) {
    return c.json({
      issue: summarizeIssue(claimedIssue),
      prompt: null,
      meta: null,
    });
  }

  // Build hydration context and render the prompt
  const hydrationCtx = await buildHydrationContext(
    db,
    claimedIssue as typeof issues.$inferSelect,
    { id: selected.id, slug: selected.slug },
    { id: version.id, version: version.version }
  );

  const prompt = hydrateTemplate(version.id, version.content, hydrationCtx);

  // Increment usage count on the version
  await db
    .update(promptVersions)
    .set({ usageCount: sql`${promptVersions.usageCount} + 1` })
    .where(eq(promptVersions.id, version.id));

  return c.json({
    issue: summarizeIssue(claimedIssue),
    prompt,
    meta: {
      templateSlug: selected.slug,
      templateId: selected.id,
      versionId: version.id,
      versionNumber: version.version,
      reviewUrl: 'POST /api/prompt-reviews',
    },
  });
});

/**
 * GET /queue — Preview the priority-ordered queue of unblocked todo issues.
 * Does not claim or modify any issues.
 */
dispatchRoutes.get('/queue', zValidator('query', queueQuerySchema), async (c) => {
  const db = c.get('db');
  const { projectId, limit, offset } = c.req.valid('query');

  const conditions = [eq(issues.status, 'todo'), isNull(issues.deletedAt)];

  if (projectId) {
    conditions.push(eq(issues.projectId, projectId));
  }

  const whereClause = and(...conditions);

  // Fetch unblocked todo issues: exclude those with unresolved blocked_by relations
  const blockedIssueIds = db
    .select({ issueId: issueRelations.issueId })
    .from(issueRelations)
    .innerJoin(issues, eq(issueRelations.relatedIssueId, issues.id))
    .where(
      and(
        eq(issueRelations.type, 'blocked_by'),
        notInArray(issues.status, ['done', 'canceled']),
        isNull(issues.deletedAt)
      )
    );

  const unblockedCondition = and(whereClause, sql`${issues.id} NOT IN (${blockedIssueIds})`);

  // Fetch all goal-aligned project IDs for scoring
  const activeGoalProjects = await db
    .select({ projectId: goals.projectId })
    .from(goals)
    .where(eq(goals.status, 'active'));

  const activeGoalProjectIds = new Set(activeGoalProjects.map((g) => g.projectId).filter(Boolean));

  const [data, totalResult] = await Promise.all([
    db.select().from(issues).where(unblockedCondition).limit(limit).offset(offset),
    db.select({ count: count() }).from(issues).where(unblockedCondition),
  ]);

  // Score each issue and sort by score descending
  const scored = data
    .map((issue) => {
      const input: ScoringInput = {
        priority: issue.priority,
        type: issue.type,
        createdAt: issue.createdAt,
        hasActiveGoal: issue.projectId !== null && activeGoalProjectIds.has(issue.projectId),
      };
      const breakdown = scoreIssue(input);
      return {
        issue,
        score: breakdown.total,
        breakdown: {
          priorityWeight: breakdown.priorityWeight,
          goalBonus: breakdown.goalAlignmentBonus,
          ageBonus: breakdown.ageBonus,
          typeBonus: breakdown.typeBonus,
        },
      };
    })
    .sort((a, b) => b.score - a.score);

  return c.json({ data: scored, total: totalResult[0].count });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Map a raw SQL row (snake_case) to the issue shape used by the prompt engine. */
function mapRowToIssue(raw: Record<string, unknown>) {
  return {
    id: raw.id as string,
    number: raw.number as number,
    title: raw.title as string,
    description: raw.description as string | null,
    type: raw.type as string,
    status: raw.status as string,
    priority: raw.priority as number,
    parentId: raw.parent_id as string | null,
    projectId: raw.project_id as string | null,
    signalSource: raw.signal_source as string | null,
    signalPayload: raw.signal_payload as Record<string, unknown> | null,
    hypothesis: raw.hypothesis as Record<string, unknown> | null,
    agentSessionId: raw.agent_session_id as string | null,
    agentSummary: raw.agent_summary as string | null,
    commits: raw.commits as unknown[] | null,
    pullRequests: raw.pull_requests as unknown[] | null,
    completedAt: raw.completed_at ? new Date(raw.completed_at as string) : null,
    createdAt: new Date(raw.created_at as string),
    updatedAt: new Date(raw.updated_at as string),
    deletedAt: raw.deleted_at ? new Date(raw.deleted_at as string) : null,
  };
}

/** Extract summary fields for the response payload. */
function summarizeIssue(issue: ReturnType<typeof mapRowToIssue>) {
  return {
    id: issue.id,
    number: issue.number,
    title: issue.title,
    type: issue.type,
    priority: issue.priority,
    status: issue.status,
  };
}

/** Build IssueContext from a claimed issue for template matching. */
async function buildIssueContext(
  db: import('../types').AnyDb,
  issue: ReturnType<typeof mapRowToIssue>
): Promise<IssueContext> {
  const [labelRows, hasFailedSessionRows] = await Promise.all([
    db
      .select({ name: labels.name })
      .from(issueLabels)
      .innerJoin(labels, eq(issueLabels.labelId, labels.id))
      .where(eq(issueLabels.issueId, issue.id)),
    // Check if any sibling issues (same parent) have failed agent sessions
    issue.parentId
      ? db
          .select({ id: issues.id })
          .from(issues)
          .where(
            and(
              eq(issues.parentId, issue.parentId),
              eq(issues.status, 'canceled'),
              isNull(issues.deletedAt),
              sql`${issues.agentSummary} IS NOT NULL`
            )
          )
      : Promise.resolve([]),
  ]);

  const hypothesisData = issue.hypothesis as { confidence?: number } | null;

  return {
    type: issue.type,
    signalSource: issue.signalSource,
    labels: labelRows.map((l) => l.name),
    projectId: issue.projectId,
    hasFailedSessions: hasFailedSessionRows.length > 0,
    hypothesisConfidence: hypothesisData?.confidence ?? null,
  };
}

/**
 * Fallback: find a template whose conditions match only on issue type.
 * Re-runs selectTemplate with a subset filtered to type-matching conditions.
 */
function findDefaultTemplate(
  candidates: TemplateCandidate[],
  issueType: string,
  context: IssueContext
): TemplateCandidate | null {
  const typeDefaults = candidates.filter(
    (t) =>
      t.activeVersionId !== null &&
      t.conditions.type === issueType &&
      Object.keys(t.conditions).length === 1
  );
  return selectTemplate(typeDefaults, context);
}
