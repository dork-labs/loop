import { describe, expect, it } from 'vitest'
import { createTestApp, withTestDb, getTestDb } from './setup'
import { promptReviewRoutes } from '../routes/prompt-reviews'
import { promptTemplates, promptVersions, issues } from '../db/schema'
import { apiKeyAuth } from '../middleware/auth'
import { HTTPException } from 'hono/http-exception'
import { ZodError } from 'zod'
import { count, eq, isNull, sql } from 'drizzle-orm'

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

  it('updates the version review_score using EWMA after creating a review', async () => {
    const db = getTestDb()
    const { version } = await seedTemplateAndVersion()
    const app = buildApp()

    // Submit first review: clarity=3, completeness=3, relevance=3 → composite = 3.0
    // First review with no prior score → reviewScore = composite = 3.0
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

    // Submit second review: clarity=5, completeness=5, relevance=5 → composite = 5.0
    // EWMA: 0.3 * 5.0 + 0.7 * 3.0 = 1.5 + 2.1 = 3.6
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
    expect(v2.reviewScore).toBeCloseTo(3.6, 1)
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

  // ─── EWMA scoring ─────────────────────────────────────────────────────────

  it('updates EWMA score correctly with different composite values', async () => {
    const db = getTestDb()
    const { version } = await seedTemplateAndVersion()
    const app = buildApp()

    // First review: clarity=4, completeness=5, relevance=3 → composite = 4.0
    // No prior score → reviewScore set directly to 4.0
    await app.request('/prompt-reviews', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        versionId: version.id,
        issueId: 'issue-ewma-1',
        clarity: 4,
        completeness: 5,
        relevance: 3,
        authorType: 'human',
      }),
    })

    const [v1] = await db
      .select()
      .from(promptVersions)
      .where(eq(promptVersions.id, version.id))
    expect(v1.reviewScore).toBeCloseTo(4.0, 1)

    // Second review: clarity=2, completeness=2, relevance=2 → composite = 2.0
    // EWMA: 0.3 * 2.0 + 0.7 * 4.0 = 0.6 + 2.8 = 3.4
    await app.request('/prompt-reviews', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        versionId: version.id,
        issueId: 'issue-ewma-2',
        clarity: 2,
        completeness: 2,
        relevance: 2,
        authorType: 'human',
      }),
    })

    const [v2] = await db
      .select()
      .from(promptVersions)
      .where(eq(promptVersions.id, version.id))
    expect(v2.reviewScore).toBeCloseTo(3.4, 1)
  })

  // ─── Improvement loop ─────────────────────────────────────────────────────

  it('auto-creates an improvement issue after 3 low-score reviews', async () => {
    const db = getTestDb()
    const { template, version } = await seedTemplateAndVersion()
    const app = buildApp()

    // Submit 3 low-score reviews (all 2/5) so EWMA stays well below 3.5
    for (let i = 1; i <= 3; i++) {
      await app.request('/prompt-reviews', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({
          versionId: version.id,
          issueId: `issue-low-${i}`,
          clarity: 2,
          completeness: 2,
          relevance: 2,
          authorType: 'human',
        }),
      })
    }

    // An improvement issue should have been created for this template
    const improvementIssues = await db
      .select()
      .from(issues)
      .where(
        sql`${issues.title} LIKE ${'Improve prompt template: ' + template.slug + '%'}`,
      )

    expect(improvementIssues).toHaveLength(1)
    expect(improvementIssues[0].type).toBe('task')
    expect(improvementIssues[0].status).toBe('todo')
    expect(improvementIssues[0].title).toContain('Improve prompt template')
  })

  it('does not create a duplicate improvement issue on subsequent low-score reviews', async () => {
    const db = getTestDb()
    const { template, version } = await seedTemplateAndVersion()
    const app = buildApp()

    // Submit 4 low-score reviews; the 3rd triggers the issue, the 4th should not duplicate it
    for (let i = 1; i <= 4; i++) {
      await app.request('/prompt-reviews', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({
          versionId: version.id,
          issueId: `issue-dup-${i}`,
          clarity: 2,
          completeness: 2,
          relevance: 2,
          authorType: 'human',
        }),
      })
    }

    const improvementIssues = await db
      .select()
      .from(issues)
      .where(
        sql`${issues.title} LIKE ${'Improve prompt template: ' + template.slug + '%'}`,
      )

    // Exactly 1 improvement issue, not 2
    expect(improvementIssues).toHaveLength(1)
  })

  it('does not create an improvement issue before REVIEW_MIN_SAMPLES is reached', async () => {
    const db = getTestDb()
    const { template, version } = await seedTemplateAndVersion()
    const app = buildApp()

    // Submit 1 review with the worst possible score
    await app.request('/prompt-reviews', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        versionId: version.id,
        issueId: 'issue-min-1',
        clarity: 1,
        completeness: 1,
        relevance: 1,
        authorType: 'human',
      }),
    })

    const afterOne = await db
      .select()
      .from(issues)
      .where(
        sql`${issues.title} LIKE ${'Improve prompt template: ' + template.slug + '%'}`,
      )
    expect(afterOne).toHaveLength(0)

    // Submit a second low-score review (still below REVIEW_MIN_SAMPLES=3)
    await app.request('/prompt-reviews', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        versionId: version.id,
        issueId: 'issue-min-2',
        clarity: 1,
        completeness: 1,
        relevance: 1,
        authorType: 'human',
      }),
    })

    const afterTwo = await db
      .select()
      .from(issues)
      .where(
        sql`${issues.title} LIKE ${'Improve prompt template: ' + template.slug + '%'}`,
      )
    expect(afterTwo).toHaveLength(0)
  })
})
