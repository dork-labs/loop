import { describe, expect, it } from 'vitest'
import { createTestApp, withTestDb, getTestDb } from './setup'
import { projectRoutes } from '../routes/projects'
import { goals, projects, issues } from '../db/schema'
import { apiKeyAuth } from '../middleware/auth'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { AppEnv } from '../types'

const AUTH_HEADER = { Authorization: `Bearer ${process.env.LOOP_API_KEY}` }

/** Mounts project routes on a test app with auth middleware. */
function buildApp() {
  const app = createTestApp()
  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return c.json({ error: err.message }, err.status)
    }
    return c.json({ error: 'Internal server error' }, 500)
  })
  app.use('/projects/*', apiKeyAuth)
  app.route('/projects', projectRoutes)
  return app
}

/** Helper to create a project via the API. */
async function createProject(
  app: Hono<AppEnv>,
  body: Record<string, unknown> = { name: 'Test Project' },
) {
  const res = await app.request('/projects', {
    method: 'POST',
    headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res
}

describe('projects CRUD', () => {
  withTestDb()

  // ─── POST /projects ──────────────────────────────────────────────────────

  it('creates a project with required fields', async () => {
    const app = buildApp()
    const res = await createProject(app, { name: 'My Project' })

    expect(res.status).toBe(201)
    const { data } = await res.json()
    expect(data.name).toBe('My Project')
    expect(data.status).toBe('backlog')
    expect(data.health).toBe('on_track')
    expect(data.id).toBeDefined()
  })

  it('creates a project with all fields', async () => {
    const app = buildApp()
    const res = await createProject(app, {
      name: 'Full Project',
      description: 'A detailed description',
      status: 'active',
      health: 'at_risk',
    })

    expect(res.status).toBe(201)
    const { data } = await res.json()
    expect(data.name).toBe('Full Project')
    expect(data.description).toBe('A detailed description')
    expect(data.status).toBe('active')
    expect(data.health).toBe('at_risk')
  })

  it('creates a project linked to a goal', async () => {
    const db = getTestDb()
    const [goal] = await db
      .insert(goals)
      .values({ title: 'Ship v1', status: 'active' })
      .returning()

    const app = buildApp()
    const res = await createProject(app, {
      name: 'Linked Project',
      goalId: goal.id,
    })

    expect(res.status).toBe(201)
    const { data } = await res.json()
    expect(data.goalId).toBe(goal.id)
  })

  it('rejects creating a project with a non-existent goalId', async () => {
    const app = buildApp()
    const res = await createProject(app, {
      name: 'Bad Goal',
      goalId: 'nonexistent-id',
    })

    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toBe('Goal not found')
  })

  // ─── GET /projects ───────────────────────────────────────────────────────

  it('lists projects excluding soft-deleted', async () => {
    const db = getTestDb()
    await db.insert(projects).values([
      { name: 'Project A' },
      { name: 'Project B' },
      { name: 'Deleted', deletedAt: new Date() },
    ])

    const app = buildApp()
    const res = await app.request('/projects', { headers: AUTH_HEADER })

    expect(res.status).toBe(200)
    const { data, total } = await res.json()
    expect(total).toBe(2)
    expect(data).toHaveLength(2)
    expect(data.map((p: { name: string }) => p.name).sort()).toEqual([
      'Project A',
      'Project B',
    ])
  })

  it('paginates results correctly', async () => {
    const db = getTestDb()
    await db.insert(projects).values([
      { name: 'P1' },
      { name: 'P2' },
      { name: 'P3' },
      { name: 'P4' },
    ])

    const app = buildApp()
    const res = await app.request('/projects?limit=2&offset=1', {
      headers: AUTH_HEADER,
    })

    expect(res.status).toBe(200)
    const { data, total } = await res.json()
    expect(total).toBe(4)
    expect(data).toHaveLength(2)
  })

  // ─── GET /projects/:id ──────────────────────────────────────────────────

  it('returns a project by ID with goal and issue counts', async () => {
    const db = getTestDb()
    const [goal] = await db
      .insert(goals)
      .values({ title: 'Goal 1', status: 'active' })
      .returning()
    const [project] = await db
      .insert(projects)
      .values({ name: 'Detail Project', goalId: goal.id })
      .returning()

    // Create issues with different statuses in the project
    await db.insert(issues).values([
      { title: 'Issue 1', type: 'task', status: 'todo', projectId: project.id },
      { title: 'Issue 2', type: 'task', status: 'todo', projectId: project.id },
      {
        title: 'Issue 3',
        type: 'task',
        status: 'done',
        projectId: project.id,
      },
    ])

    const app = buildApp()
    const res = await app.request(`/projects/${project.id}`, {
      headers: AUTH_HEADER,
    })

    expect(res.status).toBe(200)
    const { data } = await res.json()
    expect(data.id).toBe(project.id)
    expect(data.goal).toBeDefined()
    expect(data.goal.id).toBe(goal.id)
    expect(data.issueCounts).toEqual({ todo: 2, done: 1 })
  })

  it('returns 404 for a non-existent project', async () => {
    const app = buildApp()
    const res = await app.request('/projects/nonexistent', {
      headers: AUTH_HEADER,
    })

    expect(res.status).toBe(404)
  })

  it('returns 404 for a soft-deleted project', async () => {
    const db = getTestDb()
    const [project] = await db
      .insert(projects)
      .values({ name: 'Deleted', deletedAt: new Date() })
      .returning()

    const app = buildApp()
    const res = await app.request(`/projects/${project.id}`, {
      headers: AUTH_HEADER,
    })

    expect(res.status).toBe(404)
  })

  // ─── PATCH /projects/:id ─────────────────────────────────────────────────

  it('updates a project', async () => {
    const db = getTestDb()
    const [project] = await db
      .insert(projects)
      .values({ name: 'Original' })
      .returning()

    const app = buildApp()
    const res = await app.request(`/projects/${project.id}`, {
      method: 'PATCH',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated', status: 'active' }),
    })

    expect(res.status).toBe(200)
    const { data } = await res.json()
    expect(data.name).toBe('Updated')
    expect(data.status).toBe('active')
  })

  it('returns 404 when updating a non-existent project', async () => {
    const app = buildApp()
    const res = await app.request('/projects/nonexistent', {
      method: 'PATCH',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Nope' }),
    })

    expect(res.status).toBe(404)
  })

  // ─── DELETE /projects/:id ────────────────────────────────────────────────

  it('soft-deletes a project and excludes it from subsequent queries', async () => {
    const db = getTestDb()
    const [project] = await db
      .insert(projects)
      .values({ name: 'To Delete' })
      .returning()

    const app = buildApp()
    const delRes = await app.request(`/projects/${project.id}`, {
      method: 'DELETE',
      headers: AUTH_HEADER,
    })
    expect(delRes.status).toBe(204)

    // GET by ID should now return 404
    const getRes = await app.request(`/projects/${project.id}`, {
      headers: AUTH_HEADER,
    })
    expect(getRes.status).toBe(404)

    // List should not include the deleted project
    const listRes = await app.request('/projects', { headers: AUTH_HEADER })
    const { total } = await listRes.json()
    expect(total).toBe(0)
  })

  it('returns 404 when deleting a non-existent project', async () => {
    const app = buildApp()
    const res = await app.request('/projects/nonexistent', {
      method: 'DELETE',
      headers: AUTH_HEADER,
    })

    expect(res.status).toBe(404)
  })

  // ─── Auth ────────────────────────────────────────────────────────────────

  it('rejects unauthenticated requests with 401', async () => {
    const app = buildApp()
    const res = await app.request('/projects')

    expect(res.status).toBe(401)
  })
})
