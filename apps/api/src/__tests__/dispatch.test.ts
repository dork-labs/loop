import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { ZodError } from 'zod'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import {
  issues,
  issueRelations,
  projects,
  goals,
  promptTemplates,
  promptVersions,
} from '../db/schema'
import { apiKeyAuth } from '../middleware/auth'
import { dispatchRoutes } from '../routes/dispatch'
import { templateRoutes } from '../routes/templates'
import { withTestDb, getTestDb, type TestAppEnv } from './setup'

const AUTH_HEADER = { Authorization: 'Bearer test-api-key' }

/** Creates a Hono app with auth + dispatch routes at /api/dispatch and template routes at /api/templates. */
function buildApp() {
  const app = new Hono<TestAppEnv>()

  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return c.json({ error: err.message }, err.status)
    }
    if (err instanceof ZodError) {
      return c.json({ error: 'Validation error', details: err.flatten() }, 422)
    }
    return c.json({ error: 'Internal server error' }, 500)
  })

  // Inject test db
  app.use('*', async (c, next) => {
    const db = getTestDb()
    c.set('db', db)
    await next()
  })

  const api = new Hono<TestAppEnv>()
  api.use('*', apiKeyAuth)
  api.route('/dispatch', dispatchRoutes)
  api.route('/templates', templateRoutes)
  app.route('/api', api)

  return app
}

/** Seed a todo issue directly into the database. Returns the inserted row. */
async function seedIssue(overrides: Record<string, unknown> = {}) {
  const db = getTestDb()
  const [row] = await db
    .insert(issues)
    .values({
      title: 'Seed Issue',
      type: 'task',
      status: 'todo',
      priority: 0,
      ...overrides,
    } as typeof issues.$inferInsert)
    .returning()
  return row
}

/** Seed a template with an active version. Returns both template and version rows. */
async function seedTemplateWithVersion(
  templateOverrides: Record<string, unknown> = {},
  versionContent = 'You are helping with issue #{{issue.number}}: {{issue.title}}',
) {
  const db = getTestDb()
  const [template] = await db
    .insert(promptTemplates)
    .values({
      slug: 'test-tmpl',
      name: 'Test Template',
      conditions: {},
      specificity: 10,
      ...templateOverrides,
    } as typeof promptTemplates.$inferInsert)
    .returning()

  const [version] = await db
    .insert(promptVersions)
    .values({
      templateId: template.id,
      version: 1,
      content: versionContent,
      authorType: 'human',
      authorName: 'Tester',
      status: 'active',
    })
    .returning()

  // Point the template to the active version
  await db
    .update(promptTemplates)
    .set({ activeVersionId: version.id })
    .where(eq(promptTemplates.id, template.id))

  return { template, version }
}

// ─── GET /api/dispatch/next ───────────────────────────────────────────────────

describe('GET /api/dispatch/next', () => {
  withTestDb()

  it('returns highest-priority unblocked todo issue and sets it to in_progress', async () => {
    await seedIssue({ title: 'Low', priority: 4 })
    await seedIssue({ title: 'Urgent', priority: 1 })
    await seedIssue({ title: 'Medium', priority: 3 })

    const app = buildApp()
    const res = await app.request('/api/dispatch/next', {
      headers: AUTH_HEADER,
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.issue.title).toBe('Urgent')
    expect(body.issue.status).toBe('in_progress')
    // Default seed templates exist via migrations, so a prompt should be hydrated
    expect(body.prompt).toBeDefined()
    expect(typeof body.prompt).toBe('string')
    expect(body.prompt.length).toBeGreaterThan(0)
    expect(body.meta).toBeDefined()
    expect(typeof body.meta.templateSlug).toBe('string')
    expect(body.meta.versionId).toBeDefined()
  })

  it('returns 204 when no eligible issues exist', async () => {
    await seedIssue({ title: 'Done', status: 'done' })
    await seedIssue({ title: 'In Progress', status: 'in_progress' })

    const app = buildApp()
    const res = await app.request('/api/dispatch/next', {
      headers: AUTH_HEADER,
    })

    expect(res.status).toBe(204)
  })

  it('excludes issues blocked by unresolved blockers', async () => {
    const issueA = await seedIssue({ title: 'Blocked Issue', priority: 1 })
    const issueB = await seedIssue({ title: 'Blocker', priority: 0 })
    const issueC = await seedIssue({ title: 'Unblocked Lower', priority: 4 })

    const db = getTestDb()
    await db.insert(issueRelations).values({
      type: 'blocked_by',
      issueId: issueA.id,
      relatedIssueId: issueB.id,
    })

    const app = buildApp()
    const res = await app.request('/api/dispatch/next', {
      headers: AUTH_HEADER,
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.issue.title).toBe('Unblocked Lower')
    expect(body.issue.id).toBe(issueC.id)
  })

  it('includes issues blocked by resolved (done) blockers', async () => {
    const issueA = await seedIssue({ title: 'Was Blocked', priority: 1 })
    const issueB = await seedIssue({
      title: 'Resolved Blocker',
      status: 'done',
    })

    const db = getTestDb()
    await db.insert(issueRelations).values({
      type: 'blocked_by',
      issueId: issueA.id,
      relatedIssueId: issueB.id,
    })

    const app = buildApp()
    const res = await app.request('/api/dispatch/next', {
      headers: AUTH_HEADER,
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.issue.title).toBe('Was Blocked')
  })

  it('filters by projectId when provided', async () => {
    const db = getTestDb()
    const [projA] = await db
      .insert(projects)
      .values({ name: 'Project A' })
      .returning()
    const [projB] = await db
      .insert(projects)
      .values({ name: 'Project B' })
      .returning()

    await seedIssue({ title: 'Proj A Issue', priority: 1, projectId: projA.id })
    await seedIssue({ title: 'Proj B Issue', priority: 1, projectId: projB.id })

    const app = buildApp()
    const res = await app.request(
      `/api/dispatch/next?projectId=${projB.id}`,
      { headers: AUTH_HEADER },
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.issue.title).toBe('Proj B Issue')
  })

  it('excludes soft-deleted todo issues', async () => {
    await seedIssue({
      title: 'Deleted Todo',
      priority: 1,
      deletedAt: new Date(),
    })

    const app = buildApp()
    const res = await app.request('/api/dispatch/next', {
      headers: AUTH_HEADER,
    })

    expect(res.status).toBe(204)
  })

  it('selects and hydrates a matching template for signal-type issues', async () => {
    await seedIssue({ title: 'Sentry Alert', type: 'signal', priority: 1 })
    await seedTemplateWithVersion(
      {
        slug: 'signal-handler',
        name: 'Signal Handler',
        conditions: { type: 'signal' },
        specificity: 20,
      },
      'Investigate signal: {{issue.title}}',
    )

    const app = buildApp()
    const res = await app.request('/api/dispatch/next', {
      headers: AUTH_HEADER,
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.prompt).toContain('Investigate signal:')
    expect(body.prompt).toContain('Sentry Alert')
    expect(body.meta.templateSlug).toBe('signal-handler')
  })

  it('returns prompt=null when no matching templates exist', async () => {
    // Soft-delete all seeded default templates so none match
    const db = getTestDb()
    await db
      .update(promptTemplates)
      .set({ deletedAt: new Date() })

    await seedIssue({ title: 'Orphan Issue', priority: 1 })

    const app = buildApp()
    const res = await app.request('/api/dispatch/next', {
      headers: AUTH_HEADER,
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.issue.title).toBe('Orphan Issue')
    expect(body.prompt).toBeNull()
    expect(body.meta).toBeNull()
  })
})

// ─── GET /api/dispatch/queue ──────────────────────────────────────────────────

describe('GET /api/dispatch/queue', () => {
  withTestDb()

  it('returns scored list sorted by score descending with breakdown', async () => {
    await seedIssue({ title: 'Urgent', priority: 1, type: 'signal' })
    await seedIssue({ title: 'Medium', priority: 3, type: 'task' })
    await seedIssue({ title: 'Low', priority: 4, type: 'monitor' })

    const app = buildApp()
    const res = await app.request('/api/dispatch/queue', {
      headers: AUTH_HEADER,
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(3)
    expect(body.total).toBe(3)

    // Verify sorted by score descending
    for (let i = 0; i < body.data.length - 1; i++) {
      expect(body.data[i].score).toBeGreaterThanOrEqual(body.data[i + 1].score)
    }

    // Verify score breakdown fields exist
    const first = body.data[0]
    expect(first.breakdown).toBeDefined()
    expect(typeof first.breakdown.priorityWeight).toBe('number')
    expect(typeof first.breakdown.goalBonus).toBe('number')
    expect(typeof first.breakdown.ageBonus).toBe('number')
    expect(typeof first.breakdown.typeBonus).toBe('number')
    expect(typeof first.score).toBe('number')

    // Urgent signal should be first
    expect(first.issue.title).toBe('Urgent')
  })

  it('paginates correctly with limit and offset', async () => {
    for (let i = 0; i < 5; i++) {
      await seedIssue({ title: `Issue ${i}`, priority: 3 })
    }

    const app = buildApp()

    const page1 = await app.request('/api/dispatch/queue?limit=2&offset=0', {
      headers: AUTH_HEADER,
    })
    const body1 = await page1.json()
    expect(page1.status).toBe(200)
    expect(body1.data).toHaveLength(2)
    expect(body1.total).toBe(5)

    const page2 = await app.request('/api/dispatch/queue?limit=2&offset=2', {
      headers: AUTH_HEADER,
    })
    const body2 = await page2.json()
    expect(page2.status).toBe(200)
    expect(body2.data).toHaveLength(2)
    expect(body2.total).toBe(5)
  })
})

// ─── GET /api/templates/preview/:issueId ──────────────────────────────────────

describe('GET /api/templates/preview/:issueId', () => {
  withTestDb()

  it('returns template info and hydrated prompt for a matching issue', async () => {
    const issue = await seedIssue({
      title: 'Preview Issue',
      type: 'task',
      priority: 2,
    })
    await seedTemplateWithVersion(
      {
        slug: 'task-template',
        name: 'Task Template',
        conditions: { type: 'task' },
        specificity: 15,
      },
      'Work on task: {{issue.title}}',
    )

    const app = buildApp()
    const res = await app.request(`/api/templates/preview/${issue.id}`, {
      headers: AUTH_HEADER,
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.issue.id).toBe(issue.id)
    expect(body.template).toBeDefined()
    expect(body.template.slug).toBe('task-template')
    expect(body.version).toBeDefined()
    expect(body.prompt).toContain('Work on task:')
    expect(body.prompt).toContain('Preview Issue')
  })

  it('returns 404 for non-existent issue', async () => {
    const app = buildApp()
    const res = await app.request('/api/templates/preview/nonexistent-id', {
      headers: AUTH_HEADER,
    })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toContain('Issue not found')
  })
})
