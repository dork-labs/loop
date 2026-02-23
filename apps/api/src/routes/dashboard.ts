import { Hono } from 'hono';
import { desc, eq, sql, and, isNull, gte } from 'drizzle-orm';
import { issues, issueRelations } from '../db/schema/issues';
import { goals } from '../db/schema/projects';
import { promptTemplates, promptVersions, promptReviews } from '../db/schema/prompts';
import type { AppEnv } from '../types';

/** Dashboard routes — aggregated system health metrics. */
export const dashboardRoutes = new Hono<AppEnv>();

/** GET /stats — System health metrics with issue, goal, and dispatch counts. */
dashboardRoutes.get('/stats', async (c) => {
  const db = c.get('db');

  const [issueStats, goalStats, dispatchStats] = await Promise.all([
    // Issue counts by status and type
    db
      .select({
        status: issues.status,
        type: issues.type,
        count: sql<number>`count(*)::int`,
      })
      .from(issues)
      .where(isNull(issues.deletedAt))
      .groupBy(issues.status, issues.type),

    // Goal counts by status
    db
      .select({
        status: goals.status,
        count: sql<number>`count(*)::int`,
      })
      .from(goals)
      .where(isNull(goals.deletedAt))
      .groupBy(goals.status),

    // Dispatch stats: queue depth, active count, completed last 24h
    Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(issues)
        .where(and(isNull(issues.deletedAt), sql`${issues.status} IN ('todo', 'backlog')`)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(issues)
        .where(and(isNull(issues.deletedAt), eq(issues.status, 'in_progress'))),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(issues)
        .where(
          and(
            isNull(issues.deletedAt),
            eq(issues.status, 'done'),
            gte(issues.completedAt, sql`NOW() - INTERVAL '24 hours'`)
          )
        ),
    ]),
  ]);

  // Aggregate issue stats into byStatus and byType maps
  const byStatus: Record<string, number> = {};
  const byType: Record<string, number> = {};
  let total = 0;
  for (const row of issueStats) {
    byStatus[row.status] = (byStatus[row.status] ?? 0) + row.count;
    byType[row.type] = (byType[row.type] ?? 0) + row.count;
    total += row.count;
  }

  // Aggregate goal stats
  const goalAgg = { total: 0, active: 0, achieved: 0 };
  for (const row of goalStats) {
    goalAgg.total += row.count;
    if (row.status === 'active') goalAgg.active = row.count;
    if (row.status === 'achieved') goalAgg.achieved = row.count;
  }

  return c.json({
    data: {
      issues: { total, byStatus, byType },
      goals: goalAgg,
      dispatch: {
        queueDepth: dispatchStats[0][0]?.count ?? 0,
        activeCount: dispatchStats[1][0]?.count ?? 0,
        completedLast24h: dispatchStats[2][0]?.count ?? 0,
      },
    },
  });
});

/** GET /activity — Pre-assembled signal chains for the Loop Activity view. */
dashboardRoutes.get('/activity', async (c) => {
  const db = c.get('db');
  const limit = Number(c.req.query('limit') ?? '20');

  // 1. Query root issues (parentId IS NULL) ordered by updatedAt DESC
  const rootIssues = await db
    .select()
    .from(issues)
    .where(and(isNull(issues.deletedAt), isNull(issues.parentId)))
    .orderBy(desc(issues.updatedAt))
    .limit(limit);

  // 2. For each root, query children with their relations
  const chains = await Promise.all(
    rootIssues.map(async (root) => {
      const children = await db
        .select()
        .from(issues)
        .where(and(isNull(issues.deletedAt), eq(issues.parentId, root.id)))
        .orderBy(issues.createdAt);

      const childrenWithRelations = await Promise.all(
        children.map(async (child) => {
          const relations = await db
            .select()
            .from(issueRelations)
            .where(eq(issueRelations.issueId, child.id));
          return { issue: child, relations };
        })
      );

      // Latest activity is the most recent updatedAt across root + children
      const allTimestamps = [root.updatedAt, ...children.map((ch) => ch.updatedAt)];
      const latestActivity = allTimestamps
        .map((t) => new Date(t).getTime())
        .reduce((max, t) => Math.max(max, t), 0);

      return {
        root,
        children: childrenWithRelations,
        latestActivity: new Date(latestActivity).toISOString(),
      };
    })
  );

  // 3. Sort chains by latestActivity descending
  chains.sort(
    (a, b) => new Date(b.latestActivity).getTime() - new Date(a.latestActivity).getTime()
  );

  return c.json({
    data: chains,
    total: chains.length,
  });
});

/** GET /prompts — Prompt template health data with version history and review scores. */
dashboardRoutes.get('/prompts', async (c) => {
  const db = c.get('db');

  // Get all non-deleted templates
  const templates = await db
    .select()
    .from(promptTemplates)
    .where(isNull(promptTemplates.deletedAt));

  const data = await Promise.all(
    templates.map(async (template) => {
      // Get recent versions (last 5) ordered by version descending
      const versions = await db
        .select()
        .from(promptVersions)
        .where(eq(promptVersions.templateId, template.id))
        .orderBy(desc(promptVersions.version))
        .limit(5);

      // Find active version from the fetched versions
      const activeVersion = versions.find((v) => v.status === 'active') ?? null;

      // Get review aggregates for all versions of this template
      const reviewAgg = await db
        .select({
          totalReviews: sql<number>`count(*)::int`,
          avgClarity: sql<number>`avg(${promptReviews.clarity})`,
          avgCompleteness: sql<number>`avg(${promptReviews.completeness})`,
          avgRelevance: sql<number>`avg(${promptReviews.relevance})`,
        })
        .from(promptReviews)
        .innerJoin(promptVersions, eq(promptReviews.versionId, promptVersions.id))
        .where(eq(promptVersions.templateId, template.id));

      const summary = reviewAgg[0] ?? {
        totalReviews: 0,
        avgClarity: null,
        avgCompleteness: null,
        avgRelevance: null,
      };

      // Use EWMA score from the active version (stored as reviewScore in schema)
      const compositeScore = activeVersion?.reviewScore ?? null;
      const completionRate = activeVersion?.completionRate ?? null;

      // Flag templates needing attention: low score or low completion rate
      const needsAttention =
        (compositeScore !== null && compositeScore < 3.0) ||
        (completionRate !== null && completionRate < 0.5);

      return {
        template,
        activeVersion,
        recentVersions: versions,
        reviewSummary: {
          totalReviews: summary.totalReviews,
          avgClarity: summary.avgClarity,
          avgCompleteness: summary.avgCompleteness,
          avgRelevance: summary.avgRelevance,
          compositeScore,
        },
        needsAttention,
      };
    })
  );

  return c.json({ data });
});
