import { describe, expect, it } from 'vitest';
import { createTestApp, withTestDb, getTestDb } from './setup';
import { dashboardRoutes } from '../routes/dashboard';
import { issues, issueRelations } from '../db/schema/issues';
import { goals } from '../db/schema/projects';
import { promptTemplates, promptVersions, promptReviews } from '../db/schema/prompts';
import { apiKeyAuth } from '../middleware/auth';
import { HTTPException } from 'hono/http-exception';
import { cors } from 'hono/cors';
import type { AppEnv } from '../types';

const AUTH_HEADER = { Authorization: `Bearer ${process.env.LOOP_API_KEY}` };

/** Mounts dashboard routes on a test app with auth and error handling. */
function buildApp() {
  const app = createTestApp();
  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return c.json({ error: err.message }, err.status);
    }
    return c.json({ error: 'Internal server error' }, 500);
  });
  app.use('/dashboard/*', apiKeyAuth);
  app.route('/dashboard', dashboardRoutes);
  return app;
}

/** Builds a test app with CORS middleware applied. */
function buildAppWithCors() {
  const app = createTestApp();
  app.use(
    '*',
    cors({
      origin: ['http://localhost:5668', 'https://app.looped.me'],
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Authorization', 'Content-Type'],
      maxAge: 86400,
    })
  );
  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return c.json({ error: err.message }, err.status);
    }
    return c.json({ error: 'Internal server error' }, 500);
  });
  app.use('/dashboard/*', apiKeyAuth);
  app.route('/dashboard', dashboardRoutes);
  return app;
}

describe('dashboard API', () => {
  withTestDb();

  describe('GET /dashboard/stats', () => {
    it('returns correct response shape with empty database', async () => {
      const app = buildApp();
      const res = await app.request('/dashboard/stats', { headers: AUTH_HEADER });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveProperty('issues');
      expect(body.data).toHaveProperty('goals');
      expect(body.data).toHaveProperty('dispatch');
      expect(body.data.issues).toEqual({ total: 0, byStatus: {}, byType: {} });
      expect(body.data.goals).toEqual({ total: 0, active: 0, achieved: 0 });
      expect(body.data.dispatch).toEqual({
        queueDepth: 0,
        activeCount: 0,
        completedLast24h: 0,
      });
    });

    it('counts issues by status and type accurately', async () => {
      const db = getTestDb();
      const app = buildApp();

      // Insert test issues with various statuses and types
      await db.insert(issues).values([
        { title: 'Signal 1', type: 'signal', status: 'triage', priority: 0 },
        { title: 'Signal 2', type: 'signal', status: 'todo', priority: 1 },
        { title: 'Task 1', type: 'task', status: 'in_progress', priority: 2 },
        { title: 'Task 2', type: 'task', status: 'done', priority: 1 },
        { title: 'Plan 1', type: 'plan', status: 'backlog', priority: 0 },
      ]);

      const res = await app.request('/dashboard/stats', { headers: AUTH_HEADER });
      expect(res.status).toBe(200);

      const { data } = await res.json();
      expect(data.issues.total).toBe(5);
      expect(data.issues.byStatus.triage).toBe(1);
      expect(data.issues.byStatus.todo).toBe(1);
      expect(data.issues.byStatus.in_progress).toBe(1);
      expect(data.issues.byStatus.done).toBe(1);
      expect(data.issues.byStatus.backlog).toBe(1);
      expect(data.issues.byType.signal).toBe(2);
      expect(data.issues.byType.task).toBe(2);
      expect(data.issues.byType.plan).toBe(1);
    });

    it('counts goals by status accurately', async () => {
      const db = getTestDb();
      const app = buildApp();

      await db.insert(goals).values([
        { title: 'Goal 1', status: 'active' },
        { title: 'Goal 2', status: 'active' },
        { title: 'Goal 3', status: 'achieved' },
        { title: 'Goal 4', status: 'abandoned' },
      ]);

      const res = await app.request('/dashboard/stats', { headers: AUTH_HEADER });
      const { data } = await res.json();

      expect(data.goals.total).toBe(4);
      expect(data.goals.active).toBe(2);
      expect(data.goals.achieved).toBe(1);
    });

    it('computes dispatch queue depth from todo + backlog issues', async () => {
      const db = getTestDb();
      const app = buildApp();

      await db.insert(issues).values([
        { title: 'Backlog 1', type: 'task', status: 'backlog', priority: 0 },
        { title: 'Todo 1', type: 'task', status: 'todo', priority: 0 },
        { title: 'Todo 2', type: 'task', status: 'todo', priority: 1 },
        { title: 'In Progress', type: 'task', status: 'in_progress', priority: 0 },
      ]);

      const res = await app.request('/dashboard/stats', { headers: AUTH_HEADER });
      const { data } = await res.json();

      expect(data.dispatch.queueDepth).toBe(3);
      expect(data.dispatch.activeCount).toBe(1);
    });

    it('counts completed issues in the last 24h', async () => {
      const db = getTestDb();
      const app = buildApp();

      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

      await db.insert(issues).values([
        {
          title: 'Recently done',
          type: 'task',
          status: 'done',
          priority: 0,
          completedAt: twoHoursAgo,
        },
        {
          title: 'Old done',
          type: 'task',
          status: 'done',
          priority: 0,
          completedAt: twoDaysAgo,
        },
      ]);

      const res = await app.request('/dashboard/stats', { headers: AUTH_HEADER });
      const { data } = await res.json();

      expect(data.dispatch.completedLast24h).toBe(1);
    });

    it('excludes soft-deleted issues from counts', async () => {
      const db = getTestDb();
      const app = buildApp();

      await db.insert(issues).values([
        { title: 'Active', type: 'task', status: 'todo', priority: 0 },
        {
          title: 'Deleted',
          type: 'task',
          status: 'todo',
          priority: 0,
          deletedAt: new Date(),
        },
      ]);

      const res = await app.request('/dashboard/stats', { headers: AUTH_HEADER });
      const { data } = await res.json();

      expect(data.issues.total).toBe(1);
      expect(data.dispatch.queueDepth).toBe(1);
    });
  });

  describe('CORS', () => {
    it('includes CORS headers for allowed origin (localhost:5668)', async () => {
      const app = buildAppWithCors();

      const res = await app.request('/dashboard/stats', {
        headers: { ...AUTH_HEADER, Origin: 'http://localhost:5668' },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5668');
    });

    it('includes CORS headers for allowed origin (app.looped.me)', async () => {
      const app = buildAppWithCors();

      const res = await app.request('/dashboard/stats', {
        headers: { ...AUTH_HEADER, Origin: 'https://app.looped.me' },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('access-control-allow-origin')).toBe('https://app.looped.me');
    });

    it('does not include CORS allow-origin for disallowed origin', async () => {
      const app = buildAppWithCors();

      const res = await app.request('/dashboard/stats', {
        headers: { ...AUTH_HEADER, Origin: 'https://evil.example.com' },
      });

      expect(res.headers.get('access-control-allow-origin')).toBeNull();
    });

    it('handles OPTIONS preflight with correct headers', async () => {
      const app = buildAppWithCors();

      const res = await app.request('/dashboard/stats', {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:5668',
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'Authorization, Content-Type',
        },
      });

      expect(res.status).toBe(204);
      expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5668');
      expect(res.headers.get('access-control-allow-methods')).toContain('GET');
      expect(res.headers.get('access-control-allow-headers')).toContain('Authorization');
    });
  });

  describe('GET /dashboard/activity', () => {
    it('returns empty array when no issues exist', async () => {
      const app = buildApp();
      const res = await app.request('/dashboard/activity', {
        headers: AUTH_HEADER,
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toEqual([]);
      expect(body.total).toBe(0);
    });

    it('returns root issues with no children as single-element chains', async () => {
      const db = getTestDb();
      const app = buildApp();

      await db.insert(issues).values([
        { title: 'Root 1', type: 'signal', status: 'triage', priority: 0 },
        { title: 'Root 2', type: 'task', status: 'todo', priority: 1 },
      ]);

      const res = await app.request('/dashboard/activity', {
        headers: AUTH_HEADER,
      });
      expect(res.status).toBe(200);

      const { data } = await res.json();
      expect(data).toHaveLength(2);
      // Each chain has root with no children
      for (const chain of data) {
        expect(chain.root).toBeDefined();
        expect(chain.root.parentId).toBeNull();
        expect(chain.children).toEqual([]);
        expect(chain.latestActivity).toBeDefined();
      }
    });

    it('groups children under their parent root issue', async () => {
      const db = getTestDb();
      const app = buildApp();

      // Insert root issue
      const [root] = await db
        .insert(issues)
        .values({
          title: 'Root Signal',
          type: 'signal',
          status: 'triage',
          priority: 0,
        })
        .returning();

      // Insert children under the root
      await db.insert(issues).values([
        {
          title: 'Child Task 1',
          type: 'task',
          status: 'todo',
          priority: 1,
          parentId: root.id,
        },
        {
          title: 'Child Task 2',
          type: 'task',
          status: 'in_progress',
          priority: 2,
          parentId: root.id,
        },
      ]);

      const res = await app.request('/dashboard/activity', {
        headers: AUTH_HEADER,
      });
      const { data } = await res.json();

      expect(data).toHaveLength(1);
      expect(data[0].root.id).toBe(root.id);
      expect(data[0].children).toHaveLength(2);
    });

    it('includes relations on child issues', async () => {
      const db = getTestDb();
      const app = buildApp();

      const [root] = await db
        .insert(issues)
        .values({
          title: 'Root',
          type: 'signal',
          status: 'triage',
          priority: 0,
        })
        .returning();

      const [child] = await db
        .insert(issues)
        .values({
          title: 'Child',
          type: 'task',
          status: 'todo',
          priority: 1,
          parentId: root.id,
        })
        .returning();

      // Create a standalone issue to relate to
      const [related] = await db
        .insert(issues)
        .values({
          title: 'Related Issue',
          type: 'task',
          status: 'backlog',
          priority: 0,
        })
        .returning();

      await db.insert(issueRelations).values({
        type: 'related',
        issueId: child.id,
        relatedIssueId: related.id,
      });

      const res = await app.request('/dashboard/activity', {
        headers: AUTH_HEADER,
      });
      const { data } = await res.json();

      // Root chain should have the child with its relation
      const rootChain = data.find((c: { root: { id: string } }) => c.root.id === root.id);
      expect(rootChain).toBeDefined();
      expect(rootChain.children).toHaveLength(1);
      expect(rootChain.children[0].relations).toHaveLength(1);
      expect(rootChain.children[0].relations[0].relatedIssueId).toBe(related.id);
    });

    it('sorts chains by latestActivity descending', async () => {
      const db = getTestDb();
      const app = buildApp();

      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

      // Insert roots with different updatedAt timestamps
      await db.insert(issues).values([
        {
          title: 'Oldest Root',
          type: 'signal',
          status: 'triage',
          priority: 0,
          updatedAt: twoHoursAgo,
          createdAt: twoHoursAgo,
        },
        {
          title: 'Newest Root',
          type: 'signal',
          status: 'triage',
          priority: 0,
          updatedAt: now,
          createdAt: now,
        },
        {
          title: 'Middle Root',
          type: 'signal',
          status: 'triage',
          priority: 0,
          updatedAt: oneHourAgo,
          createdAt: oneHourAgo,
        },
      ]);

      const res = await app.request('/dashboard/activity', {
        headers: AUTH_HEADER,
      });
      const { data } = await res.json();

      expect(data).toHaveLength(3);
      expect(data[0].root.title).toBe('Newest Root');
      expect(data[1].root.title).toBe('Middle Root');
      expect(data[2].root.title).toBe('Oldest Root');
    });

    it('respects the limit query parameter', async () => {
      const db = getTestDb();
      const app = buildApp();

      await db.insert(issues).values([
        { title: 'Root 1', type: 'signal', status: 'triage', priority: 0 },
        { title: 'Root 2', type: 'signal', status: 'triage', priority: 0 },
        { title: 'Root 3', type: 'signal', status: 'triage', priority: 0 },
      ]);

      const res = await app.request('/dashboard/activity?limit=2', {
        headers: AUTH_HEADER,
      });
      const { data } = await res.json();

      expect(data).toHaveLength(2);
    });

    it('excludes soft-deleted issues from chains', async () => {
      const db = getTestDb();
      const app = buildApp();

      await db.insert(issues).values([
        { title: 'Active Root', type: 'signal', status: 'triage', priority: 0 },
        {
          title: 'Deleted Root',
          type: 'signal',
          status: 'triage',
          priority: 0,
          deletedAt: new Date(),
        },
      ]);

      const res = await app.request('/dashboard/activity', {
        headers: AUTH_HEADER,
      });
      const { data } = await res.json();

      expect(data).toHaveLength(1);
      expect(data[0].root.title).toBe('Active Root');
    });

    it('excludes soft-deleted children from chains', async () => {
      const db = getTestDb();
      const app = buildApp();

      const [root] = await db
        .insert(issues)
        .values({
          title: 'Root',
          type: 'signal',
          status: 'triage',
          priority: 0,
        })
        .returning();

      await db.insert(issues).values([
        {
          title: 'Active Child',
          type: 'task',
          status: 'todo',
          priority: 1,
          parentId: root.id,
        },
        {
          title: 'Deleted Child',
          type: 'task',
          status: 'todo',
          priority: 1,
          parentId: root.id,
          deletedAt: new Date(),
        },
      ]);

      const res = await app.request('/dashboard/activity', {
        headers: AUTH_HEADER,
      });
      const { data } = await res.json();

      expect(data).toHaveLength(1);
      expect(data[0].children).toHaveLength(1);
      expect(data[0].children[0].issue.title).toBe('Active Child');
    });
  });

  describe('GET /dashboard/prompts', () => {
    /** Response shape for a single prompt health entry from the dashboard. */
    interface PromptHealthEntry {
      template: { slug: string; name: string };
      activeVersion: { version: number; status: string; reviewScore: number | null } | null;
      recentVersions: Array<{ version: number }>;
      reviewSummary: {
        totalReviews: number;
        avgClarity: number | null;
        avgCompleteness: number | null;
        avgRelevance: number | null;
        compositeScore: number | null;
      };
      needsAttention: boolean;
    }

    /** Helper to find a template entry by slug in the response data array. */
    function findBySlug(data: PromptHealthEntry[], slug: string) {
      return data.find((d) => d.template.slug === slug);
    }

    it('returns correct response shape for seeded and new templates', async () => {
      const app = buildApp();
      const res = await app.request('/dashboard/prompts', {
        headers: AUTH_HEADER,
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      // Seed data exists; verify every entry has the right shape
      expect(body.data.length).toBeGreaterThan(0);
      for (const entry of body.data) {
        expect(entry).toHaveProperty('template');
        expect(entry).toHaveProperty('activeVersion');
        expect(entry).toHaveProperty('recentVersions');
        expect(entry).toHaveProperty('reviewSummary');
        expect(entry).toHaveProperty('needsAttention');
      }
    });

    it('returns a newly created template with correct shape', async () => {
      const db = getTestDb();
      const app = buildApp();

      await db.insert(promptTemplates).values({
        slug: 'test-template',
        name: 'Test Template',
        description: 'A test template',
      });

      const res = await app.request('/dashboard/prompts', {
        headers: AUTH_HEADER,
      });
      const { data } = await res.json();

      const entry = findBySlug(data, 'test-template');
      expect(entry).toBeDefined();
      expect(entry!.template.name).toBe('Test Template');
      expect(entry!.activeVersion).toBeNull();
      expect(entry!.recentVersions).toEqual([]);
      expect(entry!.reviewSummary.totalReviews).toBe(0);
    });

    it('identifies the active version correctly', async () => {
      const db = getTestDb();
      const app = buildApp();

      const [template] = await db
        .insert(promptTemplates)
        .values({
          slug: 'versioned-template',
          name: 'Versioned Template',
        })
        .returning();

      // Insert draft and active versions
      await db.insert(promptVersions).values([
        {
          templateId: template.id,
          version: 1,
          content: 'v1 content',
          authorType: 'human',
          authorName: 'tester',
          status: 'draft',
        },
        {
          templateId: template.id,
          version: 2,
          content: 'v2 content',
          authorType: 'human',
          authorName: 'tester',
          status: 'active',
        },
      ]);

      const res = await app.request('/dashboard/prompts', {
        headers: AUTH_HEADER,
      });
      const { data } = await res.json();

      const entry = findBySlug(data, 'versioned-template');
      expect(entry).toBeDefined();
      expect(entry!.activeVersion).not.toBeNull();
      expect(entry!.activeVersion!.version).toBe(2);
      expect(entry!.activeVersion!.status).toBe('active');
    });

    it('limits recent versions to 5', async () => {
      const db = getTestDb();
      const app = buildApp();

      const [template] = await db
        .insert(promptTemplates)
        .values({
          slug: 'many-versions',
          name: 'Many Versions Template',
        })
        .returning();

      // Insert 7 versions
      const versionValues = Array.from({ length: 7 }, (_, i) => ({
        templateId: template.id,
        version: i + 1,
        content: `v${i + 1} content`,
        authorType: 'human' as const,
        authorName: 'tester',
        status: i === 6 ? ('active' as const) : ('draft' as const),
      }));

      await db.insert(promptVersions).values(versionValues);

      const res = await app.request('/dashboard/prompts', {
        headers: AUTH_HEADER,
      });
      const { data } = await res.json();

      const entry = findBySlug(data, 'many-versions');
      expect(entry).toBeDefined();
      expect(entry!.recentVersions).toHaveLength(5);
      // Should be the 5 most recent versions (ordered by version DESC)
      expect(entry!.recentVersions[0].version).toBe(7);
      expect(entry!.recentVersions[4].version).toBe(3);
    });

    it('computes review aggregation averages correctly', async () => {
      const db = getTestDb();
      const app = buildApp();

      const [template] = await db
        .insert(promptTemplates)
        .values({
          slug: 'reviewed-template',
          name: 'Reviewed Template',
        })
        .returning();

      const [version] = await db
        .insert(promptVersions)
        .values({
          templateId: template.id,
          version: 1,
          content: 'content',
          authorType: 'human',
          authorName: 'tester',
          status: 'active',
        })
        .returning();

      // Insert two issues for reviews
      const [issue1, issue2] = await db
        .insert(issues)
        .values([
          { title: 'Issue 1', type: 'task', status: 'done', priority: 0 },
          { title: 'Issue 2', type: 'task', status: 'done', priority: 0 },
        ])
        .returning();

      // Insert reviews with known scores
      await db.insert(promptReviews).values([
        {
          versionId: version.id,
          issueId: issue1.id,
          clarity: 4,
          completeness: 5,
          relevance: 3,
          authorType: 'agent',
        },
        {
          versionId: version.id,
          issueId: issue2.id,
          clarity: 2,
          completeness: 3,
          relevance: 5,
          authorType: 'agent',
        },
      ]);

      const res = await app.request('/dashboard/prompts', {
        headers: AUTH_HEADER,
      });
      const { data } = await res.json();

      const entry = findBySlug(data, 'reviewed-template');
      expect(entry).toBeDefined();
      expect(entry!.reviewSummary.totalReviews).toBe(2);
      // PostgreSQL avg() returns a numeric string; compare via Number()
      expect(Number(entry!.reviewSummary.avgClarity)).toBe(3); // (4+2)/2
      expect(Number(entry!.reviewSummary.avgCompleteness)).toBe(4); // (5+3)/2
      expect(Number(entry!.reviewSummary.avgRelevance)).toBe(4); // (3+5)/2
    });

    it('sets needsAttention = true when compositeScore < 3.0', async () => {
      const db = getTestDb();
      const app = buildApp();

      const [template] = await db
        .insert(promptTemplates)
        .values({
          slug: 'low-score-template',
          name: 'Low Score Template',
        })
        .returning();

      // Active version with low review score
      await db.insert(promptVersions).values({
        templateId: template.id,
        version: 1,
        content: 'content',
        authorType: 'human',
        authorName: 'tester',
        status: 'active',
        reviewScore: 2.5,
        completionRate: 0.8,
      });

      const res = await app.request('/dashboard/prompts', {
        headers: AUTH_HEADER,
      });
      const { data } = await res.json();

      const entry = findBySlug(data, 'low-score-template');
      expect(entry).toBeDefined();
      expect(entry!.needsAttention).toBe(true);
      expect(entry!.reviewSummary.compositeScore).toBe(2.5);
    });

    it('sets needsAttention = true when completionRate < 0.5', async () => {
      const db = getTestDb();
      const app = buildApp();

      const [template] = await db
        .insert(promptTemplates)
        .values({
          slug: 'low-completion-template',
          name: 'Low Completion Template',
        })
        .returning();

      // Active version with low completion rate but passing review score
      await db.insert(promptVersions).values({
        templateId: template.id,
        version: 1,
        content: 'content',
        authorType: 'human',
        authorName: 'tester',
        status: 'active',
        reviewScore: 4.0,
        completionRate: 0.3,
      });

      const res = await app.request('/dashboard/prompts', {
        headers: AUTH_HEADER,
      });
      const { data } = await res.json();

      const entry = findBySlug(data, 'low-completion-template');
      expect(entry).toBeDefined();
      expect(entry!.needsAttention).toBe(true);
    });

    it('sets needsAttention = false when both thresholds are met', async () => {
      const db = getTestDb();
      const app = buildApp();

      const [template] = await db
        .insert(promptTemplates)
        .values({
          slug: 'healthy-template',
          name: 'Healthy Template',
        })
        .returning();

      await db.insert(promptVersions).values({
        templateId: template.id,
        version: 1,
        content: 'content',
        authorType: 'human',
        authorName: 'tester',
        status: 'active',
        reviewScore: 4.2,
        completionRate: 0.85,
      });

      const res = await app.request('/dashboard/prompts', {
        headers: AUTH_HEADER,
      });
      const { data } = await res.json();

      const entry = findBySlug(data, 'healthy-template');
      expect(entry).toBeDefined();
      expect(entry!.needsAttention).toBe(false);
    });

    it('excludes soft-deleted templates', async () => {
      const db = getTestDb();
      const app = buildApp();

      // Count pre-existing (seeded) templates
      const baseRes = await app.request('/dashboard/prompts', {
        headers: AUTH_HEADER,
      });
      const baseData = await baseRes.json();
      const baseCount = baseData.data.length;

      // Add one active and one soft-deleted template
      await db.insert(promptTemplates).values([
        { slug: 'visible-template', name: 'Visible Template' },
        {
          slug: 'deleted-template',
          name: 'Deleted Template',
          deletedAt: new Date(),
        },
      ]);

      const res = await app.request('/dashboard/prompts', {
        headers: AUTH_HEADER,
      });
      const { data } = await res.json();

      // Only the non-deleted new template should appear (on top of seeds)
      expect(data).toHaveLength(baseCount + 1);
      expect(findBySlug(data, 'visible-template')).toBeDefined();
      expect(findBySlug(data, 'deleted-template')).toBeUndefined();
    });
  });
});
