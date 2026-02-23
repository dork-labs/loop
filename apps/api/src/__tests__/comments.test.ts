import { describe, expect, it } from 'vitest';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';
import { createTestApp, withTestDb, getTestDb } from './setup';
import { commentRoutes } from '../routes/comments';
import { issues } from '../db/schema';

/** Auth header used for all test requests. */
const AUTH = { Authorization: `Bearer ${process.env.LOOP_API_KEY ?? 'loop_test-api-key'}` };

/** Creates a test issue and returns it. */
async function createIssue(overrides: Partial<{ title: string }> = {}) {
  const db = getTestDb();
  const [issue] = await db
    .insert(issues)
    .values({
      title: overrides.title ?? 'Test Issue',
      type: 'task',
    })
    .returning();
  return issue;
}

describe('comments API', () => {
  withTestDb();

  /** Build a test app with the global error handler and comment routes mounted. */
  function buildApp() {
    const app = createTestApp();
    app.onError((err, c) => {
      if (err instanceof HTTPException) {
        return c.json({ error: err.message }, err.status);
      }
      if (err instanceof ZodError) {
        return c.json({ error: 'Validation error', details: err.flatten() }, 422);
      }
      return c.json({ error: 'Internal server error' }, 500);
    });
    app.route('/issues', commentRoutes);
    return app;
  }

  describe('POST /issues/:id/comments', () => {
    it('creates a comment on an issue', async () => {
      const app = buildApp();
      const issue = await createIssue();

      const res = await app.request(`/issues/${issue.id}/comments`, {
        method: 'POST',
        headers: { ...AUTH, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: 'This is a test comment',
          authorName: 'Alice',
          authorType: 'human',
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.body).toBe('This is a test comment');
      expect(json.data.authorName).toBe('Alice');
      expect(json.data.authorType).toBe('human');
      expect(json.data.issueId).toBe(issue.id);
      expect(json.data.id).toBeDefined();
    });

    it('creates a reply comment with parentId', async () => {
      const app = buildApp();
      const issue = await createIssue();

      // Create parent comment
      const parentRes = await app.request(`/issues/${issue.id}/comments`, {
        method: 'POST',
        headers: { ...AUTH, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: 'Parent comment',
          authorName: 'Alice',
          authorType: 'human',
        }),
      });
      const parentJson = await parentRes.json();
      const parentId = parentJson.data.id;

      // Create reply
      const res = await app.request(`/issues/${issue.id}/comments`, {
        method: 'POST',
        headers: { ...AUTH, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: 'Reply comment',
          authorName: 'Bot',
          authorType: 'agent',
          parentId,
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.parentId).toBe(parentId);
      expect(json.data.authorType).toBe('agent');
    });

    it('returns 404 when issue does not exist', async () => {
      const app = buildApp();

      const res = await app.request('/issues/nonexistent/comments', {
        method: 'POST',
        headers: { ...AUTH, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: 'Orphan comment',
          authorName: 'Alice',
          authorType: 'human',
        }),
      });

      expect(res.status).toBe(404);
    });

    it('returns 422 when parent comment does not exist', async () => {
      const app = buildApp();
      const issue = await createIssue();

      const res = await app.request(`/issues/${issue.id}/comments`, {
        method: 'POST',
        headers: { ...AUTH, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: 'Reply to nothing',
          authorName: 'Alice',
          authorType: 'human',
          parentId: 'nonexistent',
        }),
      });

      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.error).toBe('Parent comment not found');
    });

    it('validates required fields', async () => {
      const app = buildApp();
      const issue = await createIssue();

      const res = await app.request(`/issues/${issue.id}/comments`, {
        method: 'POST',
        headers: { ...AUTH, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      // zValidator returns 400 for schema validation failures
      expect(res.status).toBe(400);
    });

    it('validates authorType enum', async () => {
      const app = buildApp();
      const issue = await createIssue();

      const res = await app.request(`/issues/${issue.id}/comments`, {
        method: 'POST',
        headers: { ...AUTH, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: 'Test',
          authorName: 'Alice',
          authorType: 'invalid',
        }),
      });

      // zValidator returns 400 for schema validation failures
      expect(res.status).toBe(400);
    });
  });

  describe('GET /issues/:id/comments', () => {
    it('returns an empty array when no comments exist', async () => {
      const app = buildApp();
      const issue = await createIssue();

      const res = await app.request(`/issues/${issue.id}/comments`, {
        headers: AUTH,
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toEqual([]);
    });

    it('returns comments in threaded structure', async () => {
      const app = buildApp();
      const issue = await createIssue();

      // Create two top-level comments
      const c1Res = await app.request(`/issues/${issue.id}/comments`, {
        method: 'POST',
        headers: { ...AUTH, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: 'First comment',
          authorName: 'Alice',
          authorType: 'human',
        }),
      });
      const c1 = (await c1Res.json()).data;

      await app.request(`/issues/${issue.id}/comments`, {
        method: 'POST',
        headers: { ...AUTH, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: 'Second comment',
          authorName: 'Bob',
          authorType: 'human',
        }),
      });

      // Create a reply to the first comment
      await app.request(`/issues/${issue.id}/comments`, {
        method: 'POST',
        headers: { ...AUTH, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: 'Reply to first',
          authorName: 'Agent',
          authorType: 'agent',
          parentId: c1.id,
        }),
      });

      // List comments
      const res = await app.request(`/issues/${issue.id}/comments`, {
        headers: AUTH,
      });

      expect(res.status).toBe(200);
      const json = await res.json();

      // Should have 2 top-level comments
      expect(json.data).toHaveLength(2);

      // First comment should have one reply
      const first = json.data.find((c: { body: string }) => c.body === 'First comment');
      expect(first.replies).toHaveLength(1);
      expect(first.replies[0].body).toBe('Reply to first');

      // Second comment should have no replies
      const second = json.data.find((c: { body: string }) => c.body === 'Second comment');
      expect(second.replies).toHaveLength(0);
    });

    it('returns 404 when issue does not exist', async () => {
      const app = buildApp();

      const res = await app.request('/issues/nonexistent/comments', {
        headers: AUTH,
      });

      expect(res.status).toBe(404);
    });
  });
});
