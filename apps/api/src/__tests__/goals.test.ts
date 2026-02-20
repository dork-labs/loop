import { describe, expect, it } from 'vitest'
import { createTestApp, withTestDb, getTestDb } from './setup'
import { goalRoutes } from '../routes/goals'
import { goals } from '../db/schema/projects'
import { eq } from 'drizzle-orm'

const AUTH_HEADER = { Authorization: 'Bearer test-api-key' }

/** Mount goal routes on a fresh test app and return it. */
function buildApp() {
  const app = createTestApp()
  app.route('/goals', goalRoutes)
  return app
}

describe('Goals CRUD', () => {
  withTestDb()

  // ─── POST /goals ──────────────────────────────────────────────────────────

  it('creates a goal with minimal fields', async () => {
    const app = buildApp()
    const res = await app.request('/goals', {
      method: 'POST',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Reduce error rate' }),
    })

    expect(res.status).toBe(201)
    const { data } = await res.json()
    expect(data.title).toBe('Reduce error rate')
    expect(data.status).toBe('active')
    expect(data.id).toBeDefined()
  })

  it('creates a goal with all fields', async () => {
    const app = buildApp()
    const res = await app.request('/goals', {
      method: 'POST',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Improve response time',
        description: 'Reduce p99 latency below 200ms',
        metric: 'p99_latency_ms',
        targetValue: 200,
        currentValue: 450,
        unit: 'ms',
        status: 'active',
        projectId: 'proj_123',
      }),
    })

    expect(res.status).toBe(201)
    const { data } = await res.json()
    expect(data.title).toBe('Improve response time')
    expect(data.metric).toBe('p99_latency_ms')
    expect(data.targetValue).toBe(200)
    expect(data.currentValue).toBe(450)
    expect(data.unit).toBe('ms')
    expect(data.projectId).toBe('proj_123')
  })

  it('rejects a goal with missing title', async () => {
    const app = buildApp()
    const res = await app.request('/goals', {
      method: 'POST',
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'No title provided' }),
    })

    expect(res.status).toBe(400)
  })

  // ─── GET /goals ───────────────────────────────────────────────────────────

  it('lists goals excluding soft-deleted', async () => {
    const db = getTestDb()
    await db.insert(goals).values([
      { title: 'Goal A' },
      { title: 'Goal B' },
      { title: 'Deleted Goal', deletedAt: new Date() },
    ])

    const app = buildApp()
    const res = await app.request('/goals')

    expect(res.status).toBe(200)
    const { data, total } = await res.json()
    expect(total).toBe(2)
    expect(data).toHaveLength(2)
    expect(data.map((g: { title: string }) => g.title).sort()).toEqual([
      'Goal A',
      'Goal B',
    ])
  })

  it('paginates goals with limit and offset', async () => {
    const db = getTestDb()
    await db.insert(goals).values([
      { title: 'Goal 1' },
      { title: 'Goal 2' },
      { title: 'Goal 3' },
    ])

    const app = buildApp()
    const res = await app.request('/goals?limit=2&offset=1')

    expect(res.status).toBe(200)
    const { data, total } = await res.json()
    expect(total).toBe(3)
    expect(data).toHaveLength(2)
  })

  // ─── GET /goals/:id ──────────────────────────────────────────────────────

  it('gets a goal by ID', async () => {
    const db = getTestDb()
    const [created] = await db
      .insert(goals)
      .values({ title: 'Find me' })
      .returning()

    const app = buildApp()
    const res = await app.request(`/goals/${created.id}`)

    expect(res.status).toBe(200)
    const { data } = await res.json()
    expect(data.title).toBe('Find me')
  })

  it('returns 404 for non-existent goal', async () => {
    const app = buildApp()
    const res = await app.request('/goals/does-not-exist')

    expect(res.status).toBe(404)
  })

  it('returns 404 for soft-deleted goal', async () => {
    const db = getTestDb()
    const [created] = await db
      .insert(goals)
      .values({ title: 'Deleted', deletedAt: new Date() })
      .returning()

    const app = buildApp()
    const res = await app.request(`/goals/${created.id}`)

    expect(res.status).toBe(404)
  })

  // ─── PATCH /goals/:id ────────────────────────────────────────────────────

  it('updates a goal', async () => {
    const db = getTestDb()
    const [created] = await db
      .insert(goals)
      .values({ title: 'Original', currentValue: 10, targetValue: 100 })
      .returning()

    const app = buildApp()
    const res = await app.request(`/goals/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentValue: 50 }),
    })

    expect(res.status).toBe(200)
    const { data } = await res.json()
    expect(data.currentValue).toBe(50)
    expect(data.title).toBe('Original')
  })

  it('updates goal status to achieved', async () => {
    const db = getTestDb()
    const [created] = await db
      .insert(goals)
      .values({ title: 'Almost done' })
      .returning()

    const app = buildApp()
    const res = await app.request(`/goals/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'achieved' }),
    })

    expect(res.status).toBe(200)
    const { data } = await res.json()
    expect(data.status).toBe('achieved')
  })

  it('returns 404 when updating a non-existent goal', async () => {
    const app = buildApp()
    const res = await app.request('/goals/nope', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated' }),
    })

    expect(res.status).toBe(404)
  })

  // ─── DELETE /goals/:id ────────────────────────────────────────────────────

  it('soft-deletes a goal and excludes it from subsequent GET', async () => {
    const db = getTestDb()
    const [created] = await db
      .insert(goals)
      .values({ title: 'To be deleted' })
      .returning()

    const app = buildApp()

    const delRes = await app.request(`/goals/${created.id}`, {
      method: 'DELETE',
    })
    expect(delRes.status).toBe(204)

    // Verify the goal is soft-deleted in the database
    const [row] = await db
      .select()
      .from(goals)
      .where(eq(goals.id, created.id))
    expect(row.deletedAt).not.toBeNull()

    // GET should return 404
    const getRes = await app.request(`/goals/${created.id}`)
    expect(getRes.status).toBe(404)
  })

  it('returns 404 when deleting a non-existent goal', async () => {
    const app = buildApp()
    const res = await app.request('/goals/nope', { method: 'DELETE' })

    expect(res.status).toBe(404)
  })
})
