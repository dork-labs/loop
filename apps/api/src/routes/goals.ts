import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, isNull, count } from 'drizzle-orm'
import { HTTPException } from 'hono/http-exception'
import { goals, goalStatusValues } from '../db/schema/projects'
import type { TestAppEnv } from '../__tests__/setup'

const createGoalSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  metric: z.string().optional(),
  targetValue: z.number().optional(),
  currentValue: z.number().optional(),
  unit: z.string().optional(),
  status: z.enum(goalStatusValues).default('active'),
  projectId: z.string().optional(),
})

const updateGoalSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().nullable().optional(),
  metric: z.string().nullable().optional(),
  targetValue: z.number().nullable().optional(),
  currentValue: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  status: z.enum(goalStatusValues).optional(),
  projectId: z.string().nullable().optional(),
})

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

/** Goals CRUD route handler. */
export const goalRoutes = new Hono<TestAppEnv>()

/** GET / — List goals with pagination, excluding soft-deleted. */
goalRoutes.get('/', zValidator('query', paginationSchema), async (c) => {
  const { limit, offset } = c.req.valid('query')
  const db = c.get('db')

  const [data, totalResult] = await Promise.all([
    db
      .select()
      .from(goals)
      .where(isNull(goals.deletedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(goals)
      .where(isNull(goals.deletedAt)),
  ])

  return c.json({ data, total: totalResult[0].count })
})

/** POST / — Create a new goal. */
goalRoutes.post('/', zValidator('json', createGoalSchema), async (c) => {
  const body = c.req.valid('json')
  const db = c.get('db')

  const [created] = await db.insert(goals).values(body).returning()

  return c.json({ data: created }, 201)
})

/** GET /:id — Get a single goal by ID. */
goalRoutes.get('/:id', async (c) => {
  const id = c.req.param('id')
  const db = c.get('db')

  const [goal] = await db
    .select()
    .from(goals)
    .where(eq(goals.id, id))

  if (!goal || goal.deletedAt) {
    throw new HTTPException(404, { message: 'Goal not found' })
  }

  return c.json({ data: goal })
})

/** PATCH /:id — Update a goal. */
goalRoutes.patch('/:id', zValidator('json', updateGoalSchema), async (c) => {
  const id = c.req.param('id')
  const body = c.req.valid('json')
  const db = c.get('db')

  // Verify the goal exists and is not soft-deleted.
  const [existing] = await db
    .select()
    .from(goals)
    .where(eq(goals.id, id))

  if (!existing || existing.deletedAt) {
    throw new HTTPException(404, { message: 'Goal not found' })
  }

  const [updated] = await db
    .update(goals)
    .set(body)
    .where(eq(goals.id, id))
    .returning()

  return c.json({ data: updated })
})

/** DELETE /:id — Soft-delete a goal. */
goalRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const db = c.get('db')

  const [existing] = await db
    .select()
    .from(goals)
    .where(eq(goals.id, id))

  if (!existing || existing.deletedAt) {
    throw new HTTPException(404, { message: 'Goal not found' })
  }

  await db
    .update(goals)
    .set({ deletedAt: new Date() })
    .where(eq(goals.id, id))

  return c.body(null, 204)
})
