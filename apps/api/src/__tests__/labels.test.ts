import { describe, expect, it } from 'vitest'
import { createTestApp, withTestDb, getTestDb } from './setup'
import { labelRoutes } from '../routes/labels'
import { labels } from '../db/schema'
import { apiKeyAuth } from '../middleware/auth'
import { HTTPException } from 'hono/http-exception'
import { ZodError } from 'zod'
import type { TestAppEnv } from './setup'
import type { Hono } from 'hono'

const AUTH_HEADER = { Authorization: `Bearer ${process.env.LOOP_API_KEY}` }

/** Mounts label routes on a test app with auth and error handling. */
function buildApp() {
  const app = createTestApp()
  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return c.json({ error: err.message }, err.status)
    }
    if (err instanceof ZodError) {
      return c.json({ error: 'Validation error', details: err.flatten() }, 422)
    }
    return c.json({ error: 'Internal server error' }, 500)
  })
  app.use('/labels/*', apiKeyAuth)
  app.route('/labels', labelRoutes)
  return app
}

/** Helper to create a label via the API. */
async function createLabel(
  app: Hono<TestAppEnv>,
  body: Record<string, unknown> = { name: 'Bug', color: '#ff0000' },
) {
  return app.request('/labels', {
    method: 'POST',
    headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('labels CRUD', () => {
  withTestDb()

  // ─── POST /labels ───────────────────────────────────────────────────────

  it('creates a label with valid data', async () => {
    const app = buildApp()
    const res = await createLabel(app, { name: 'Feature', color: '#00ff00' })

    expect(res.status).toBe(201)
    const { data } = await res.json()
    expect(data.name).toBe('Feature')
    expect(data.color).toBe('#00ff00')
    expect(data.id).toBeDefined()
    expect(data.deletedAt).toBeNull()
  })

  it('rejects creating a label with a duplicate name', async () => {
    const app = buildApp()
    await createLabel(app, { name: 'Duplicate', color: '#111111' })
    const res = await createLabel(app, { name: 'Duplicate', color: '#222222' })

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toBe('Label name already exists')
  })

  it('rejects creating a label without a name', async () => {
    const app = buildApp()
    const res = await createLabel(app, { color: '#ff0000' })

    expect(res.status).toBe(422)
  })

  it('rejects creating a label without a color', async () => {
    const app = buildApp()
    const res = await createLabel(app, { name: 'No Color' })

    expect(res.status).toBe(422)
  })

  // ─── GET /labels ────────────────────────────────────────────────────────

  it('lists labels excluding soft-deleted', async () => {
    const db = getTestDb()
    await db.insert(labels).values([
      { name: 'Active', color: '#aaa' },
      { name: 'Also Active', color: '#bbb' },
      { name: 'Deleted', color: '#ccc', deletedAt: new Date() },
    ])

    const app = buildApp()
    const res = await app.request('/labels', { headers: AUTH_HEADER })

    expect(res.status).toBe(200)
    const { data, total } = await res.json()
    expect(total).toBe(2)
    expect(data).toHaveLength(2)
    expect(data.map((l: { name: string }) => l.name).sort()).toEqual([
      'Active',
      'Also Active',
    ])
  })

  it('paginates results correctly', async () => {
    const db = getTestDb()
    await db.insert(labels).values([
      { name: 'L1', color: '#111' },
      { name: 'L2', color: '#222' },
      { name: 'L3', color: '#333' },
    ])

    const app = buildApp()
    const res = await app.request('/labels?limit=2&offset=1', {
      headers: AUTH_HEADER,
    })

    expect(res.status).toBe(200)
    const { data, total } = await res.json()
    expect(total).toBe(3)
    expect(data).toHaveLength(2)
  })

  // ─── DELETE /labels/:id ─────────────────────────────────────────────────

  it('soft-deletes a label and excludes it from subsequent queries', async () => {
    const db = getTestDb()
    const [label] = await db
      .insert(labels)
      .values({ name: 'To Delete', color: '#ddd' })
      .returning()

    const app = buildApp()
    const delRes = await app.request(`/labels/${label.id}`, {
      method: 'DELETE',
      headers: AUTH_HEADER,
    })
    expect(delRes.status).toBe(204)

    // List should not include the deleted label
    const listRes = await app.request('/labels', { headers: AUTH_HEADER })
    const { total } = await listRes.json()
    expect(total).toBe(0)
  })

  it('returns 404 when deleting a non-existent label', async () => {
    const app = buildApp()
    const res = await app.request('/labels/nonexistent', {
      method: 'DELETE',
      headers: AUTH_HEADER,
    })

    expect(res.status).toBe(404)
  })

  // ─── Auth ─────────────────────────────────────────────────────────────

  it('rejects unauthenticated requests with 401', async () => {
    const app = buildApp()
    const res = await app.request('/labels')

    expect(res.status).toBe(401)
  })
})
