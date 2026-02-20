import { Hono } from 'hono'
import { z } from 'zod'
import { eq, isNull, sql } from 'drizzle-orm'
import { labels } from '../db/schema'
import type { AppEnv } from '../types'

// ─── Validation schemas ──────────────────────────────────────────────────────

const createLabelSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().min(1).max(50),
})

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

// ─── Routes ──────────────────────────────────────────────────────────────────

export const labelRoutes = new Hono<AppEnv>()

/** GET / — List labels with pagination, excluding soft-deleted. */
labelRoutes.get('/', async (c) => {
  const db = c.get('db')
  const query = paginationSchema.parse({
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
  })

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(labels)
      .where(isNull(labels.deletedAt))
      .limit(query.limit)
      .offset(query.offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(labels)
      .where(isNull(labels.deletedAt)),
  ])

  return c.json({ data, total: countResult[0].count })
})

/** Checks whether an error is a Postgres unique constraint violation. */
function isUniqueViolation(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  // Drizzle wraps the Postgres error in a cause chain.
  // Check both the message and the cause for the constraint keyword.
  const msg = err.message
  const causeMsg = err.cause instanceof Error ? err.cause.message : ''
  return (
    msg.includes('unique constraint') ||
    causeMsg.includes('unique constraint') ||
    msg.includes('duplicate key') ||
    causeMsg.includes('duplicate key')
  )
}

/** POST / — Create a label with unique name enforcement. */
labelRoutes.post('/', async (c) => {
  const db = c.get('db')
  const body = createLabelSchema.parse(await c.req.json())

  try {
    const [created] = await db.insert(labels).values(body).returning()
    return c.json({ data: created }, 201)
  } catch (err) {
    if (isUniqueViolation(err)) {
      return c.json({ error: 'Label name already exists' }, 409)
    }
    throw err
  }
})

/** DELETE /:id — Soft-delete a label by setting deletedAt. */
labelRoutes.delete('/:id', async (c) => {
  const db = c.get('db')
  const { id } = c.req.param()

  const [updated] = await db
    .update(labels)
    .set({ deletedAt: new Date() })
    .where(eq(labels.id, id))
    .returning()

  if (!updated) {
    return c.json({ error: 'Label not found' }, 404)
  }

  return c.body(null, 204)
})
