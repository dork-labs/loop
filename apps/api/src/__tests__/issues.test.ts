import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { describe, expect, it } from 'vitest'
import { labels } from '../db/schema'
import { apiKeyAuth } from '../middleware/auth'
import { issueRoutes } from '../routes/issues'
import { withTestDb, getTestDb, type TestAppEnv } from './setup'

const AUTH_HEADER = { Authorization: 'Bearer loop_test-api-key' }
const JSON_HEADERS = { ...AUTH_HEADER, 'Content-Type': 'application/json' }

/** Creates a Hono app with auth + issue routes mounted at /api/issues. */
function createIssueApp() {
  const app = new Hono<TestAppEnv>()

  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return c.json({ error: err.message }, err.status)
    }
    return c.json({ error: 'Internal server error' }, 500)
  })

  // Propagate db from testApp middleware
  app.use('*', async (c, next) => {
    const db = getTestDb()
    c.set('db', db)
    await next()
  })

  const api = new Hono<TestAppEnv>()
  api.use('*', apiKeyAuth)
  api.route('/issues', issueRoutes)
  app.route('/api', api)

  return app
}

/** Helper to create an issue via POST and return the response body. */
async function createIssue(
  app: Hono<TestAppEnv>,
  data: Record<string, unknown> = {},
) {
  const body = { title: 'Test Issue', type: 'task', ...data }
  const res = await app.request('/api/issues', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  })
  return { res, body: await res.json() }
}

describe('Issues CRUD', () => {
  withTestDb()

  // ─── Auth ────────────────────────────────────────────────────────────────────

  it('rejects requests without auth token with 401', async () => {
    const app = createIssueApp()
    const res = await app.request('/api/issues', { method: 'GET' })
    expect(res.status).toBe(401)
  })

  // ─── POST /api/issues ────────────────────────────────────────────────────────

  it('creates an issue with minimal valid data', async () => {
    const app = createIssueApp()
    const { res, body } = await createIssue(app)

    expect(res.status).toBe(201)
    expect(body.data.title).toBe('Test Issue')
    expect(body.data.type).toBe('task')
    expect(body.data.status).toBe('triage')
    expect(body.data.priority).toBe(0)
    expect(body.data.id).toBeDefined()
  })

  it('creates an issue with all fields populated', async () => {
    const app = createIssueApp()
    const { res, body } = await createIssue(app, {
      title: 'Full Issue',
      description: 'A detailed description',
      type: 'hypothesis',
      status: 'backlog',
      priority: 3,
      signalSource: 'sentry',
      signalPayload: { event_id: '123' },
      hypothesis: {
        statement: 'Users prefer dark mode',
        confidence: 0.8,
        evidence: ['survey data'],
        validationCriteria: 'A/B test results',
        prediction: '60% adoption',
      },
    })

    expect(res.status).toBe(201)
    expect(body.data.description).toBe('A detailed description')
    expect(body.data.type).toBe('hypothesis')
    expect(body.data.status).toBe('backlog')
    expect(body.data.priority).toBe(3)
    expect(body.data.signalSource).toBe('sentry')
    expect(body.data.signalPayload).toEqual({ event_id: '123' })
    expect(body.data.hypothesis.statement).toBe('Users prefer dark mode')
  })

  it('creates a child issue (1 level deep)', async () => {
    const app = createIssueApp()
    const { body: parent } = await createIssue(app, { title: 'Parent' })

    const { res, body: child } = await createIssue(app, {
      title: 'Child',
      parentId: parent.data.id,
    })

    expect(res.status).toBe(201)
    expect(child.data.parentId).toBe(parent.data.id)
  })

  it('rejects grandchild creation (2 levels deep) with 422', async () => {
    const app = createIssueApp()
    const { body: grandparent } = await createIssue(app, {
      title: 'Grandparent',
    })
    const { body: parent } = await createIssue(app, {
      title: 'Parent',
      parentId: grandparent.data.id,
    })

    const { res, body } = await createIssue(app, {
      title: 'Grandchild',
      parentId: parent.data.id,
    })

    expect(res.status).toBe(422)
    expect(body.error).toContain('1-level hierarchy limit')
  })

  it('creates an issue with label associations', async () => {
    const app = createIssueApp()
    const db = getTestDb()

    // Insert labels directly into the database
    const [label1] = await db
      .insert(labels)
      .values({ name: 'bug', color: '#ff0000' })
      .returning()
    const [label2] = await db
      .insert(labels)
      .values({ name: 'urgent', color: '#ff9900' })
      .returning()

    const { res, body } = await createIssue(app, {
      title: 'Labeled Issue',
      labelIds: [label1.id, label2.id],
    })

    expect(res.status).toBe(201)

    // Verify labels are associated via GET
    const getRes = await app.request(`/api/issues/${body.data.id}`, {
      headers: AUTH_HEADER,
    })
    const getBody = await getRes.json()
    expect(getBody.data.labels).toHaveLength(2)
  })

  // ─── GET /api/issues ─────────────────────────────────────────────────────────

  it('lists issues excluding soft-deleted', async () => {
    const app = createIssueApp()
    await createIssue(app, { title: 'Active Issue' })
    const { body: toDelete } = await createIssue(app, {
      title: 'Deleted Issue',
    })

    // Soft-delete one
    await app.request(`/api/issues/${toDelete.data.id}`, {
      method: 'DELETE',
      headers: AUTH_HEADER,
    })

    const res = await app.request('/api/issues', { headers: AUTH_HEADER })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].title).toBe('Active Issue')
    expect(body.total).toBe(1)
  })

  it('filters issues by status (comma-separated)', async () => {
    const app = createIssueApp()
    await createIssue(app, { title: 'Triage', status: 'triage' })
    await createIssue(app, { title: 'Done', status: 'done' })
    await createIssue(app, { title: 'Backlog', status: 'backlog' })

    const res = await app.request('/api/issues?status=triage,done', {
      headers: AUTH_HEADER,
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(2)
    expect(body.total).toBe(2)
  })

  it('filters issues by type (comma-separated)', async () => {
    const app = createIssueApp()
    await createIssue(app, { title: 'Task', type: 'task' })
    await createIssue(app, { title: 'Signal', type: 'signal' })
    await createIssue(app, { title: 'Plan', type: 'plan' })

    const res = await app.request('/api/issues?type=task,signal', {
      headers: AUTH_HEADER,
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(2)
  })

  it('filters issues by projectId', async () => {
    const app = createIssueApp()
    await createIssue(app, { title: 'With Project', projectId: 'proj-1' })
    await createIssue(app, { title: 'No Project' })

    const res = await app.request('/api/issues?projectId=proj-1', {
      headers: AUTH_HEADER,
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].title).toBe('With Project')
  })

  it('filters issues by labelId', async () => {
    const app = createIssueApp()
    const db = getTestDb()

    const [label] = await db
      .insert(labels)
      .values({ name: 'critical', color: '#ff0000' })
      .returning()

    await createIssue(app, {
      title: 'Labeled',
      labelIds: [label.id],
    })
    await createIssue(app, { title: 'Unlabeled' })

    const res = await app.request(`/api/issues?labelId=${label.id}`, {
      headers: AUTH_HEADER,
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].title).toBe('Labeled')
  })

  it('paginates with limit and offset', async () => {
    const app = createIssueApp()
    await createIssue(app, { title: 'Issue 1' })
    await createIssue(app, { title: 'Issue 2' })
    await createIssue(app, { title: 'Issue 3' })

    const res = await app.request('/api/issues?limit=2&offset=1', {
      headers: AUTH_HEADER,
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(2)
    expect(body.total).toBe(3)
  })

  // ─── GET /api/issues/:id ─────────────────────────────────────────────────────

  it('gets an issue by ID with parent, children, labels, and relations', async () => {
    const app = createIssueApp()
    const { body: parent } = await createIssue(app, { title: 'Parent' })
    const { body: child } = await createIssue(app, {
      title: 'Child',
      parentId: parent.data.id,
    })

    const res = await app.request(`/api/issues/${child.data.id}`, {
      headers: AUTH_HEADER,
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.id).toBe(child.data.id)
    expect(body.data.parent).not.toBeNull()
    expect(body.data.parent.id).toBe(parent.data.id)
    expect(body.data.children).toEqual([])
    expect(body.data.labels).toEqual([])
    expect(body.data.relations).toEqual([])

    // Check parent has child in children list
    const parentRes = await app.request(`/api/issues/${parent.data.id}`, {
      headers: AUTH_HEADER,
    })
    const parentBody = await parentRes.json()
    expect(parentBody.data.children).toHaveLength(1)
    expect(parentBody.data.children[0].id).toBe(child.data.id)
  })

  it('returns 404 for soft-deleted issue', async () => {
    const app = createIssueApp()
    const { body: created } = await createIssue(app)

    await app.request(`/api/issues/${created.data.id}`, {
      method: 'DELETE',
      headers: AUTH_HEADER,
    })

    const res = await app.request(`/api/issues/${created.data.id}`, {
      headers: AUTH_HEADER,
    })
    expect(res.status).toBe(404)
  })

  it('returns 404 for non-existent issue', async () => {
    const app = createIssueApp()
    const res = await app.request('/api/issues/nonexistent-id', {
      headers: AUTH_HEADER,
    })
    expect(res.status).toBe(404)
  })

  // ─── PATCH /api/issues/:id ────────────────────────────────────────────────────

  it('updates an issue with partial data', async () => {
    const app = createIssueApp()
    const { body: created } = await createIssue(app)

    const res = await app.request(`/api/issues/${created.data.id}`, {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        title: 'Updated Title',
        status: 'in_progress',
        priority: 2,
      }),
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.title).toBe('Updated Title')
    expect(body.data.status).toBe('in_progress')
    expect(body.data.priority).toBe(2)
    // Original type should be unchanged
    expect(body.data.type).toBe('task')
  })

  it('returns 404 when updating a non-existent issue', async () => {
    const app = createIssueApp()
    const res = await app.request('/api/issues/nonexistent-id', {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify({ title: 'Nope' }),
    })
    expect(res.status).toBe(404)
  })

  // ─── DELETE /api/issues/:id ───────────────────────────────────────────────────

  it('soft-deletes an issue and returns 204', async () => {
    const app = createIssueApp()
    const { body: created } = await createIssue(app)

    const deleteRes = await app.request(`/api/issues/${created.data.id}`, {
      method: 'DELETE',
      headers: AUTH_HEADER,
    })
    expect(deleteRes.status).toBe(204)

    // Subsequent GET returns 404
    const getRes = await app.request(`/api/issues/${created.data.id}`, {
      headers: AUTH_HEADER,
    })
    expect(getRes.status).toBe(404)
  })

  it('returns 404 when deleting a non-existent issue', async () => {
    const app = createIssueApp()
    const res = await app.request('/api/issues/nonexistent-id', {
      method: 'DELETE',
      headers: AUTH_HEADER,
    })
    expect(res.status).toBe(404)
  })
})
