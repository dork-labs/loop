import { describe, expect, it } from 'vitest';
import { createTestApp, withTestDb, getTestDb } from './setup';
import { templateRoutes } from '../routes/templates';
import { promptTemplates, promptVersions, promptReviews } from '../db/schema';
import { apiKeyAuth } from '../middleware/auth';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';
import { eq } from 'drizzle-orm';
import type { AppEnv } from '../types';
import type { Hono } from 'hono';

const AUTH_HEADER = { Authorization: `Bearer ${process.env.LOOP_API_KEY}` };
const JSON_HEADERS = { ...AUTH_HEADER, 'Content-Type': 'application/json' };

/** Mounts template routes on a test app with auth and error handling. */
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
  app.use('/templates/*', apiKeyAuth);
  app.route('/templates', templateRoutes);
  return app;
}

/** Helper to create a template via the API. */
async function createTemplate(
  app: Hono<AppEnv>,
  body: Record<string, unknown> = {
    slug: 'test-template',
    name: 'Test Template',
  }
) {
  return app.request('/templates', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });
}

/** Helper to create a version via the API. */
async function createVersion(
  app: Hono<AppEnv>,
  templateId: string,
  body: Record<string, unknown> = {
    content: 'You are a helpful assistant.',
    authorType: 'human',
    authorName: 'Test User',
  }
) {
  return app.request(`/templates/${templateId}/versions`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });
}

describe('templates CRUD', () => {
  withTestDb();

  // ─── POST /templates ────────────────────────────────────────────────────

  it('creates a template with valid data', async () => {
    const app = buildApp();
    const res = await createTemplate(app, {
      slug: 'my-template',
      name: 'My Template',
      description: 'A test template',
    });

    expect(res.status).toBe(201);
    const { data } = await res.json();
    expect(data.slug).toBe('my-template');
    expect(data.name).toBe('My Template');
    expect(data.description).toBe('A test template');
    expect(data.id).toBeDefined();
    expect(data.activeVersionId).toBeNull();
    expect(data.deletedAt).toBeNull();
  });

  it('rejects creating a template with a duplicate slug', async () => {
    const app = buildApp();
    await createTemplate(app, { slug: 'dup-slug', name: 'First' });
    const res = await createTemplate(app, { slug: 'dup-slug', name: 'Second' });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('Template slug already exists');
  });

  it('rejects creating a template with an invalid slug', async () => {
    const app = buildApp();
    const res = await createTemplate(app, {
      slug: 'Invalid Slug!',
      name: 'Bad',
    });

    expect([400, 422]).toContain(res.status);
  });

  it('rejects creating a template without a name', async () => {
    const app = buildApp();
    const res = await createTemplate(app, { slug: 'no-name' });

    expect([400, 422]).toContain(res.status);
  });

  // ─── GET /templates ─────────────────────────────────────────────────────

  it('lists templates excluding soft-deleted', async () => {
    const db = getTestDb();
    await db.insert(promptTemplates).values([
      { slug: 'active-1', name: 'Active 1' },
      { slug: 'active-2', name: 'Active 2' },
      { slug: 'deleted-1', name: 'Deleted', deletedAt: new Date() },
    ]);

    const app = buildApp();
    const res = await app.request('/templates', { headers: AUTH_HEADER });

    expect(res.status).toBe(200);
    const { data, total } = await res.json();
    // 5 default templates from seed migration + 2 user-created (1 deleted, excluded)
    expect(total).toBe(7);
    expect(data).toHaveLength(7);
  });

  it('paginates results correctly', async () => {
    const db = getTestDb();
    await db.insert(promptTemplates).values([
      { slug: 't-1', name: 'T1' },
      { slug: 't-2', name: 'T2' },
      { slug: 't-3', name: 'T3' },
    ]);

    const app = buildApp();
    // 5 default + 3 user-created = 8 total
    const res = await app.request('/templates?limit=2&offset=1', {
      headers: AUTH_HEADER,
    });

    expect(res.status).toBe(200);
    const { data, total } = await res.json();
    expect(total).toBe(8);
    expect(data).toHaveLength(2);
  });

  // ─── GET /templates/:id ─────────────────────────────────────────────────

  it('gets a template by id', async () => {
    const db = getTestDb();
    const [template] = await db
      .insert(promptTemplates)
      .values({ slug: 'get-me', name: 'Get Me' })
      .returning();

    const app = buildApp();
    const res = await app.request(`/templates/${template.id}`, {
      headers: AUTH_HEADER,
    });

    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.slug).toBe('get-me');
    expect(data.activeVersion).toBeNull();
  });

  it('returns 404 for non-existent template', async () => {
    const app = buildApp();
    const res = await app.request('/templates/nonexistent', {
      headers: AUTH_HEADER,
    });

    expect(res.status).toBe(404);
  });

  // ─── PATCH /templates/:id ──────────────────────────────────────────────

  it('updates a template', async () => {
    const db = getTestDb();
    const [template] = await db
      .insert(promptTemplates)
      .values({ slug: 'update-me', name: 'Original' })
      .returning();

    const app = buildApp();
    const res = await app.request(`/templates/${template.id}`, {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify({ name: 'Updated', description: 'New desc' }),
    });

    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.name).toBe('Updated');
    expect(data.description).toBe('New desc');
  });

  it('returns 404 when updating a non-existent template', async () => {
    const app = buildApp();
    const res = await app.request('/templates/nonexistent', {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify({ name: 'Nope' }),
    });

    expect(res.status).toBe(404);
  });

  // ─── DELETE /templates/:id ─────────────────────────────────────────────

  it('soft-deletes a template', async () => {
    const db = getTestDb();
    const [template] = await db
      .insert(promptTemplates)
      .values({ slug: 'delete-me', name: 'Delete Me' })
      .returning();

    const app = buildApp();
    const delRes = await app.request(`/templates/${template.id}`, {
      method: 'DELETE',
      headers: AUTH_HEADER,
    });
    expect(delRes.status).toBe(204);

    // Should not appear in list (5 seed templates remain)
    const listRes = await app.request('/templates', { headers: AUTH_HEADER });
    const { total } = await listRes.json();
    expect(total).toBe(5);
  });

  it('returns 404 when deleting a non-existent template', async () => {
    const app = buildApp();
    const res = await app.request('/templates/nonexistent', {
      method: 'DELETE',
      headers: AUTH_HEADER,
    });

    expect(res.status).toBe(404);
  });
});

describe('template versions', () => {
  withTestDb();

  // ─── POST /templates/:id/versions ──────────────────────────────────────

  it('creates a first version and sets it as active on the template', async () => {
    const db = getTestDb();
    const [template] = await db
      .insert(promptTemplates)
      .values({ slug: 'versioned', name: 'Versioned' })
      .returning();

    const app = buildApp();
    const res = await createVersion(app, template.id, {
      content: 'Version 1 content',
      authorType: 'human',
      authorName: 'Tester',
    });

    expect(res.status).toBe(201);
    const { data: version } = await res.json();
    expect(version.version).toBe(1);
    expect(version.status).toBe('active');
    expect(version.templateId).toBe(template.id);

    // Template should now have this version as active
    const [updated] = await db
      .select()
      .from(promptTemplates)
      .where(eq(promptTemplates.id, template.id));
    expect(updated.activeVersionId).toBe(version.id);
  });

  it('auto-increments version numbers', async () => {
    const db = getTestDb();
    const [template] = await db
      .insert(promptTemplates)
      .values({ slug: 'multi-ver', name: 'Multi' })
      .returning();

    const app = buildApp();
    const res1 = await createVersion(app, template.id);
    const { data: v1 } = await res1.json();
    expect(v1.version).toBe(1);

    const res2 = await createVersion(app, template.id, {
      content: 'V2',
      authorType: 'agent',
      authorName: 'Bot',
    });
    const { data: v2 } = await res2.json();
    expect(v2.version).toBe(2);
    // Second version should be draft (not auto-promoted)
    expect(v2.status).toBe('draft');
  });

  it('returns 404 when creating a version for non-existent template', async () => {
    const app = buildApp();
    const res = await createVersion(app, 'nonexistent');

    expect(res.status).toBe(404);
  });

  // ─── GET /templates/:id/versions ───────────────────────────────────────

  it('lists versions for a template ordered by version desc', async () => {
    const db = getTestDb();
    const [template] = await db
      .insert(promptTemplates)
      .values({ slug: 'list-ver', name: 'List Versions' })
      .returning();

    const app = buildApp();
    await createVersion(app, template.id, {
      content: 'V1',
      authorType: 'human',
      authorName: 'A',
    });
    await createVersion(app, template.id, {
      content: 'V2',
      authorType: 'human',
      authorName: 'B',
    });

    const res = await app.request(`/templates/${template.id}/versions`, {
      headers: AUTH_HEADER,
    });

    expect(res.status).toBe(200);
    const { data, total } = await res.json();
    expect(total).toBe(2);
    expect(data).toHaveLength(2);
    // Should be ordered by version descending
    expect(data[0].version).toBe(2);
    expect(data[1].version).toBe(1);
  });

  it('returns 404 when listing versions for non-existent template', async () => {
    const app = buildApp();
    const res = await app.request('/templates/nonexistent/versions', {
      headers: AUTH_HEADER,
    });

    expect(res.status).toBe(404);
  });

  // ─── POST /templates/:id/versions/:versionId/promote ──────────────────

  it('promotes a draft version to active and retires the previous', async () => {
    const db = getTestDb();
    const [template] = await db
      .insert(promptTemplates)
      .values({ slug: 'promote-test', name: 'Promote Test' })
      .returning();

    const app = buildApp();

    // Create first version (auto-active)
    const res1 = await createVersion(app, template.id, {
      content: 'V1',
      authorType: 'human',
      authorName: 'A',
    });
    const { data: v1 } = await res1.json();
    expect(v1.status).toBe('active');

    // Create second version (draft)
    const res2 = await createVersion(app, template.id, {
      content: 'V2',
      authorType: 'human',
      authorName: 'B',
    });
    const { data: v2 } = await res2.json();
    expect(v2.status).toBe('draft');

    // Promote v2
    const promoteRes = await app.request(`/templates/${template.id}/versions/${v2.id}/promote`, {
      method: 'POST',
      headers: AUTH_HEADER,
    });

    expect(promoteRes.status).toBe(200);
    const { data: promoted } = await promoteRes.json();
    expect(promoted.status).toBe('active');

    // v1 should now be retired
    const [retired] = await db.select().from(promptVersions).where(eq(promptVersions.id, v1.id));
    expect(retired.status).toBe('retired');

    // Template should point to v2
    const [updatedTemplate] = await db
      .select()
      .from(promptTemplates)
      .where(eq(promptTemplates.id, template.id));
    expect(updatedTemplate.activeVersionId).toBe(v2.id);
  });

  it('returns 422 when promoting an already active version', async () => {
    const db = getTestDb();
    const [template] = await db
      .insert(promptTemplates)
      .values({ slug: 'already-active', name: 'Already Active' })
      .returning();

    const app = buildApp();
    const res1 = await createVersion(app, template.id, {
      content: 'V1',
      authorType: 'human',
      authorName: 'A',
    });
    const { data: v1 } = await res1.json();

    const promoteRes = await app.request(`/templates/${template.id}/versions/${v1.id}/promote`, {
      method: 'POST',
      headers: AUTH_HEADER,
    });

    expect(promoteRes.status).toBe(422);
    const body = await promoteRes.json();
    expect(body.error).toBe('Version is already active');
  });

  it('returns 404 when promoting a non-existent version', async () => {
    const db = getTestDb();
    const [template] = await db
      .insert(promptTemplates)
      .values({ slug: 'no-version', name: 'No Version' })
      .returning();

    const app = buildApp();
    const res = await app.request(`/templates/${template.id}/versions/nonexistent/promote`, {
      method: 'POST',
      headers: AUTH_HEADER,
    });

    expect(res.status).toBe(404);
  });
});

describe('template reviews', () => {
  withTestDb();

  // ─── GET /templates/:id/reviews ────────────────────────────────────────

  it('lists reviews across all versions of a template', async () => {
    const db = getTestDb();
    const [template] = await db
      .insert(promptTemplates)
      .values({ slug: 'reviewed', name: 'Reviewed' })
      .returning();

    const [v1] = await db
      .insert(promptVersions)
      .values({
        templateId: template.id,
        version: 1,
        content: 'V1',
        authorType: 'human',
        authorName: 'A',
        status: 'active',
      })
      .returning();

    const [v2] = await db
      .insert(promptVersions)
      .values({
        templateId: template.id,
        version: 2,
        content: 'V2',
        authorType: 'human',
        authorName: 'B',
        status: 'draft',
      })
      .returning();

    // Insert reviews for both versions
    await db.insert(promptReviews).values([
      {
        versionId: v1.id,
        issueId: 'issue-1',
        clarity: 4,
        completeness: 3,
        relevance: 5,
        authorType: 'human',
      },
      {
        versionId: v2.id,
        issueId: 'issue-2',
        clarity: 5,
        completeness: 5,
        relevance: 4,
        feedback: 'Great improvement',
        authorType: 'agent',
      },
    ]);

    const app = buildApp();
    const res = await app.request(`/templates/${template.id}/reviews`, {
      headers: AUTH_HEADER,
    });

    expect(res.status).toBe(200);
    const { data, total } = await res.json();
    expect(total).toBe(2);
    expect(data).toHaveLength(2);
  });

  it('returns empty list when template has no versions', async () => {
    const db = getTestDb();
    const [template] = await db
      .insert(promptTemplates)
      .values({ slug: 'no-reviews', name: 'No Reviews' })
      .returning();

    const app = buildApp();
    const res = await app.request(`/templates/${template.id}/reviews`, {
      headers: AUTH_HEADER,
    });

    expect(res.status).toBe(200);
    const { data, total } = await res.json();
    expect(total).toBe(0);
    expect(data).toHaveLength(0);
  });

  it('returns 404 for reviews on non-existent template', async () => {
    const app = buildApp();
    const res = await app.request('/templates/nonexistent/reviews', {
      headers: AUTH_HEADER,
    });

    expect(res.status).toBe(404);
  });

  // ─── Auth ──────────────────────────────────────────────────────────────

  it('rejects unauthenticated requests with 401', async () => {
    const app = buildApp();
    const res = await app.request('/templates');

    expect(res.status).toBe(401);
  });
});
