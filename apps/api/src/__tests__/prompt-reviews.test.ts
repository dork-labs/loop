import { describe, expect, it } from 'vitest'
import { createTestApp, withTestDb, getTestDb } from './setup'
import { promptReviewRoutes } from '../routes/prompt-reviews'
import { promptTemplates, promptVersions } from '../db/schema'
import { apiKeyAuth } from '../middleware/auth'
import { HTTPException } from 'hono/http-exception'
import { ZodError } from 'zod'
import { eq } from 'drizzle-orm'

const AUTH_HEADER = { Authorization: `Bearer ${process.env.LOOP_API_KEY}` }
const JSON_HEADERS = { ...AUTH_HEADER, 'Content-Type': 'application/json' }

/** Mounts prompt review routes on a test app with auth and error handling. */
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
  app.use('/prompt-reviews/*', apiKeyAuth)
  app.route('/prompt-reviews', promptReviewRoutes)
  return app
}

/** Helper to create a template and version directly in the DB for test setup. */
async function seedTemplateAndVersion() {
  const db = getTestDb()

  const [template] = await db
    .insert(promptTemplates)
    .values({ slug: 'review-test', name: 'Review Test' })
    .returning()

  const [version] = await db
    .insert(promptVersions)
    .values({
      templateId: template.id,
      version: 1,
      content: 'You are a helpful assistant.',
      authorType: 'human',
      authorName: 'Tester',
      status: 'active',
    })
    .returning()

  return { template, version }
}

describe('prompt reviews', () => {
  withTestDb()

  // ─── POST /prompt-reviews ──────────────────────────────────────────────

  it('creates a review and returns 201', async () => {
    const { version } = await seedTemplateAndVersion()
    const app = buildApp()

    const res = await app.request('/prompt-reviews', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        versionId: version.id,
        issueId: 'issue-123',
        clarity: 4,
        completeness: 5,
        relevance: 3,
        feedback: 'Good prompt overall',
        authorType: 'human',
      }),
    })

    expect(res.status).toBe(201)
    const { data } = await res.json()
    expect(data.versionId).toBe(version.id)
    expect(data.issueId).toBe('issue-123')
    expect(data.clarity).toBe(4)
    expect(data.completeness).toBe(5)
    expect(data.relevance).toBe(3)
    expect(data.feedback).toBe('Good prompt overall')
    expect(data.authorType).toBe('human')
    expect(data.id).toBeDefined()
  })

  it('updates the version review_score after creating a review', async () => {
    const db = getTestDb()
    const { version } = await seedTemplateAndVersion()
    const app = buildApp()

    // Submit first review: clarity=3, completeness=3, relevance=3 → avg = 3.0
    await app.request('/prompt-reviews', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        versionId: version.id,
        issueId: 'issue-1',
        clarity: 3,
        completeness: 3,
        relevance: 3,
        authorType: 'human',
      }),
    })

    const [v1] = await db
      .select()
      .from(promptVersions)
      .where(eq(promptVersions.id, version.id))
    expect(v1.reviewScore).toBeCloseTo(3.0, 1)

    // Submit second review: clarity=5, completeness=5, relevance=5 → avg = 5.0
    // Overall average: (3.0 + 5.0) / 2 = 4.0
    await app.request('/prompt-reviews', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        versionId: version.id,
        issueId: 'issue-2',
        clarity: 5,
        completeness: 5,
        relevance: 5,
        authorType: 'agent',
      }),
    })

    const [v2] = await db
      .select()
      .from(promptVersions)
      .where(eq(promptVersions.id, version.id))
    expect(v2.reviewScore).toBeCloseTo(4.0, 1)
  })

  it('returns 404 when version does not exist', async () => {
    const app = buildApp()

    const res = await app.request('/prompt-reviews', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        versionId: 'nonexistent',
        issueId: 'issue-1',
        clarity: 3,
        completeness: 3,
        relevance: 3,
        authorType: 'human',
      }),
    })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Version not found')
  })

  it('rejects scores outside 1-5 range', async () => {
    const { version } = await seedTemplateAndVersion()
    const app = buildApp()

    // clarity = 0 (below minimum)
    const res1 = await app.request('/prompt-reviews', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        versionId: version.id,
        issueId: 'issue-1',
        clarity: 0,
        completeness: 3,
        relevance: 3,
        authorType: 'human',
      }),
    })
    expect([400, 422]).toContain(res1.status)

    // completeness = 6 (above maximum)
    const res2 = await app.request('/prompt-reviews', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        versionId: version.id,
        issueId: 'issue-1',
        clarity: 3,
        completeness: 6,
        relevance: 3,
        authorType: 'human',
      }),
    })
    expect([400, 422]).toContain(res2.status)

    // relevance = -1 (negative)
    const res3 = await app.request('/prompt-reviews', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        versionId: version.id,
        issueId: 'issue-1',
        clarity: 3,
        completeness: 3,
        relevance: -1,
        authorType: 'human',
      }),
    })
    expect([400, 422]).toContain(res3.status)
  })

  it('rejects missing required fields', async () => {
    const app = buildApp()

    // Missing versionId
    const res1 = await app.request('/prompt-reviews', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        issueId: 'issue-1',
        clarity: 3,
        completeness: 3,
        relevance: 3,
        authorType: 'human',
      }),
    })
    expect([400, 422]).toContain(res1.status)

    // Missing clarity
    const res2 = await app.request('/prompt-reviews', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        versionId: 'some-id',
        issueId: 'issue-1',
        completeness: 3,
        relevance: 3,
        authorType: 'human',
      }),
    })
    expect([400, 422]).toContain(res2.status)

    // Missing authorType
    const res3 = await app.request('/prompt-reviews', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        versionId: 'some-id',
        issueId: 'issue-1',
        clarity: 3,
        completeness: 3,
        relevance: 3,
      }),
    })
    expect([400, 422]).toContain(res3.status)
  })

  it('rejects unauthenticated requests with 401', async () => {
    const app = buildApp()

    const res = await app.request('/prompt-reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        versionId: 'some-id',
        issueId: 'issue-1',
        clarity: 3,
        completeness: 3,
        relevance: 3,
        authorType: 'human',
      }),
    })

    expect(res.status).toBe(401)
  })

  it('creates a review with agent authorType', async () => {
    const { version } = await seedTemplateAndVersion()
    const app = buildApp()

    const res = await app.request('/prompt-reviews', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        versionId: version.id,
        issueId: 'issue-agent',
        clarity: 5,
        completeness: 4,
        relevance: 5,
        authorType: 'agent',
      }),
    })

    expect(res.status).toBe(201)
    const { data } = await res.json()
    expect(data.authorType).toBe('agent')
  })
})
