import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { ZodError } from 'zod'
import { describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { signals } from '../db/schema/signals'
import { issues } from '../db/schema/issues'
import { apiKeyAuth } from '../middleware/auth'
import { signalRoutes } from '../routes/signals'
import { withTestDb, getTestDb, type TestAppEnv } from './setup'

const AUTH_HEADER = { Authorization: 'Bearer test-api-key' }
const JSON_HEADERS = { ...AUTH_HEADER, 'Content-Type': 'application/json' }

/** Creates a Hono app with auth + signal routes mounted at /api/signals. */
function createSignalApp() {
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

  app.use('*', async (c, next) => {
    c.set('db', getTestDb())
    await next()
  })

  const api = new Hono<TestAppEnv>()
  api.use('*', apiKeyAuth)
  api.route('/signals', signalRoutes)
  app.route('/api', api)

  return app
}

/** Helper to post a signal and return the response. */
async function postSignal(
  app: Hono<TestAppEnv>,
  data: Record<string, unknown> = {},
) {
  const body = {
    source: 'test-source',
    type: 'error',
    severity: 'medium',
    payload: { message: 'Something broke' },
    ...data,
  }
  const res = await app.request('/api/signals', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  })
  return { res, body: await res.json() }
}

describe('Signal Ingestion', () => {
  withTestDb()

  // ─── Auth ──────────────────────────────────────────────────────────────────

  it('rejects requests without auth token with 401', async () => {
    const app = createSignalApp()
    const res = await app.request('/api/signals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'test',
        type: 'error',
        severity: 'low',
        payload: {},
      }),
    })
    expect(res.status).toBe(401)
  })

  // ─── POST /api/signals ─────────────────────────────────────────────────────

  it('creates a signal and linked issue atomically', async () => {
    const app = createSignalApp()
    const { res, body } = await postSignal(app)

    expect(res.status).toBe(201)
    expect(body.data.signal).toBeDefined()
    expect(body.data.issue).toBeDefined()
    expect(body.data.signal.source).toBe('test-source')
    expect(body.data.signal.type).toBe('error')
    expect(body.data.signal.severity).toBe('medium')
    expect(body.data.signal.issueId).toBe(body.data.issue.id)
    expect(body.data.issue.type).toBe('signal')
    expect(body.data.issue.status).toBe('triage')
    expect(body.data.issue.title).toContain('[test-source]')
  })

  it('derives issue title from payload message', async () => {
    const app = createSignalApp()
    const { body } = await postSignal(app, {
      source: 'sentry',
      type: 'exception',
      payload: { message: 'NullPointerException in UserService' },
    })

    expect(body.data.issue.title).toBe(
      '[sentry] exception: NullPointerException in UserService',
    )
  })

  it('derives issue title from payload title when message is absent', async () => {
    const app = createSignalApp()
    const { body } = await postSignal(app, {
      source: 'github',
      type: 'alert',
      payload: { title: 'Dependabot security alert' },
    })

    expect(body.data.issue.title).toBe('[github] alert: Dependabot security alert')
  })

  it('falls back to type for issue title when payload has no message or title', async () => {
    const app = createSignalApp()
    const { body } = await postSignal(app, {
      source: 'posthog',
      type: 'metric_spike',
      payload: { value: 42 },
    })

    expect(body.data.issue.title).toBe('[posthog] metric_spike: metric_spike')
  })

  // ─── Severity → priority mapping ──────────────────────────────────────────

  it('maps critical severity to priority 1', async () => {
    const app = createSignalApp()
    const { body } = await postSignal(app, { severity: 'critical' })
    expect(body.data.issue.priority).toBe(1)
  })

  it('maps high severity to priority 2', async () => {
    const app = createSignalApp()
    const { body } = await postSignal(app, { severity: 'high' })
    expect(body.data.issue.priority).toBe(2)
  })

  it('maps medium severity to priority 3', async () => {
    const app = createSignalApp()
    const { body } = await postSignal(app, { severity: 'medium' })
    expect(body.data.issue.priority).toBe(3)
  })

  it('maps low severity to priority 4', async () => {
    const app = createSignalApp()
    const { body } = await postSignal(app, { severity: 'low' })
    expect(body.data.issue.priority).toBe(4)
  })

  // ─── Project inheritance ───────────────────────────────────────────────────

  it('passes projectId through to the created issue', async () => {
    const app = createSignalApp()
    const { body } = await postSignal(app, { projectId: 'proj_123' })

    expect(body.data.issue.projectId).toBe('proj_123')
  })

  // ─── Optional sourceId ────────────────────────────────────────────────────

  it('stores sourceId on the signal when provided', async () => {
    const app = createSignalApp()
    const { body } = await postSignal(app, { sourceId: 'ext-id-456' })

    expect(body.data.signal.sourceId).toBe('ext-id-456')
  })

  // ─── Transaction atomicity ────────────────────────────────────────────────

  it('persists both signal and issue to the database', async () => {
    const app = createSignalApp()
    const { body } = await postSignal(app)
    const db = getTestDb()

    const dbSignals = await db
      .select()
      .from(signals)
      .where(eq(signals.id, body.data.signal.id))
    expect(dbSignals).toHaveLength(1)

    const dbIssues = await db
      .select()
      .from(issues)
      .where(eq(issues.id, body.data.issue.id))
    expect(dbIssues).toHaveLength(1)
  })

  // ─── Validation ────────────────────────────────────────────────────────────

  it('rejects signal with missing source', async () => {
    const app = createSignalApp()
    const res = await app.request('/api/signals', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        type: 'error',
        severity: 'low',
        payload: {},
      }),
    })
    expect(res.status).toBe(400)
  })

  it('rejects signal with missing type', async () => {
    const app = createSignalApp()
    const res = await app.request('/api/signals', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        source: 'test',
        severity: 'low',
        payload: {},
      }),
    })
    expect(res.status).toBe(400)
  })

  it('rejects signal with invalid severity', async () => {
    const app = createSignalApp()
    const res = await app.request('/api/signals', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        source: 'test',
        type: 'error',
        severity: 'ultra',
        payload: {},
      }),
    })
    expect(res.status).toBe(400)
  })

  it('rejects signal with missing payload', async () => {
    const app = createSignalApp()
    const res = await app.request('/api/signals', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        source: 'test',
        type: 'error',
        severity: 'low',
      }),
    })
    expect(res.status).toBe(400)
  })
})
