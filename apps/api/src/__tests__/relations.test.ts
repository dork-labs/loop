import { describe, expect, it } from 'vitest'
import { HTTPException } from 'hono/http-exception'
import { ZodError } from 'zod'
import { createTestApp, withTestDb, getTestDb } from './setup'
import { issueRelationRoutes, relationRoutes } from '../routes/relations'
import { issues, issueRelations } from '../db/schema'
import { eq } from 'drizzle-orm'

/** Auth header used for all test requests. */
const AUTH = { Authorization: `Bearer ${process.env.LOOP_API_KEY ?? 'loop_test-api-key'}` }

/** Creates a test issue and returns its ID. */
async function createIssue(overrides: Partial<{ title: string; type: string }> = {}) {
  const db = getTestDb()
  const [issue] = await db
    .insert(issues)
    .values({
      title: overrides.title ?? 'Test Issue',
      type: (overrides.type as 'task') ?? 'task',
    })
    .returning()
  return issue
}

describe('relations API', () => {
  withTestDb()

  /** Build a test app with the global error handler and both relation route groups mounted. */
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
    app.route('/issues', issueRelationRoutes)
    app.route('/relations', relationRoutes)
    return app
  }

  describe('POST /issues/:id/relations', () => {
    it('creates a relation between two issues', async () => {
      const app = buildApp()
      const issueA = await createIssue({ title: 'Issue A' })
      const issueB = await createIssue({ title: 'Issue B' })

      const res = await app.request(`/issues/${issueA.id}/relations`, {
        method: 'POST',
        headers: { ...AUTH, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'blocks', relatedIssueId: issueB.id }),
      })

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.type).toBe('blocks')
      expect(body.data.issueId).toBe(issueA.id)
      expect(body.data.relatedIssueId).toBe(issueB.id)
      expect(body.data.id).toBeDefined()
    })

    it('returns 404 when source issue does not exist', async () => {
      const app = buildApp()
      const issueB = await createIssue({ title: 'Issue B' })

      const res = await app.request('/issues/nonexistent/relations', {
        method: 'POST',
        headers: { ...AUTH, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'related', relatedIssueId: issueB.id }),
      })

      expect(res.status).toBe(404)
    })

    it('returns 422 when related issue does not exist', async () => {
      const app = buildApp()
      const issueA = await createIssue({ title: 'Issue A' })

      const res = await app.request(`/issues/${issueA.id}/relations`, {
        method: 'POST',
        headers: { ...AUTH, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'related', relatedIssueId: 'nonexistent' }),
      })

      expect(res.status).toBe(422)
    })

    it('returns 422 when creating a self-relation', async () => {
      const app = buildApp()
      const issueA = await createIssue({ title: 'Issue A' })

      const res = await app.request(`/issues/${issueA.id}/relations`, {
        method: 'POST',
        headers: { ...AUTH, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'duplicate', relatedIssueId: issueA.id }),
      })

      expect(res.status).toBe(422)
      const body = await res.json()
      expect(body.error).toBe('Cannot create a relation to the same issue')
    })

    it('validates relation type', async () => {
      const app = buildApp()
      const issueA = await createIssue({ title: 'Issue A' })
      const issueB = await createIssue({ title: 'Issue B' })

      const res = await app.request(`/issues/${issueA.id}/relations`, {
        method: 'POST',
        headers: { ...AUTH, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'invalid_type', relatedIssueId: issueB.id }),
      })

      // zValidator returns 400 for schema validation failures
      expect(res.status).toBe(400)
    })

    it('supports all valid relation types', async () => {
      const app = buildApp()
      const types = ['blocks', 'blocked_by', 'related', 'duplicate'] as const

      for (const type of types) {
        const issueA = await createIssue({ title: `Source ${type}` })
        const issueB = await createIssue({ title: `Target ${type}` })

        const res = await app.request(`/issues/${issueA.id}/relations`, {
          method: 'POST',
          headers: { ...AUTH, 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, relatedIssueId: issueB.id }),
        })

        expect(res.status).toBe(201)
        const body = await res.json()
        expect(body.data.type).toBe(type)
      }
    })
  })

  describe('DELETE /relations/:id', () => {
    it('hard-deletes a relation', async () => {
      const app = buildApp()
      const issueA = await createIssue({ title: 'Issue A' })
      const issueB = await createIssue({ title: 'Issue B' })

      // Create relation directly in DB
      const db = getTestDb()
      const [relation] = await db
        .insert(issueRelations)
        .values({
          type: 'blocks',
          issueId: issueA.id,
          relatedIssueId: issueB.id,
        })
        .returning()

      const res = await app.request(`/relations/${relation.id}`, {
        method: 'DELETE',
        headers: AUTH,
      })

      expect(res.status).toBe(204)

      // Verify it is actually deleted from the DB
      const remaining = await db
        .select()
        .from(issueRelations)
        .where(eq(issueRelations.id, relation.id))
      expect(remaining).toHaveLength(0)
    })

    it('returns 404 when relation does not exist', async () => {
      const app = buildApp()

      const res = await app.request('/relations/nonexistent', {
        method: 'DELETE',
        headers: AUTH,
      })

      expect(res.status).toBe(404)
    })
  })
})
