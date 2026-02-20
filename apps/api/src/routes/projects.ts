import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { eq, isNull, and, count } from 'drizzle-orm'
import { HTTPException } from 'hono/http-exception'
import {
  projects,
  projectStatusValues,
  projectHealthValues,
  goals,
  issues,
} from '../db/schema'
import type { AppEnv } from '../types'

// ─── Validation schemas ──────────────────────────────────────────────────────

const createProjectSchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().optional(),
  status: z.enum(projectStatusValues).default('backlog'),
  health: z.enum(projectHealthValues).default('on_track'),
  goalId: z.string().optional(),
})

const updateProjectSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  status: z.enum(projectStatusValues).optional(),
  health: z.enum(projectHealthValues).optional(),
  goalId: z.string().nullable().optional(),
})

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

// ─── Route handler ───────────────────────────────────────────────────────────

/** Projects CRUD routes — mounted at `/projects` under the authenticated API group. */
export const projectRoutes = new Hono<AppEnv>()

/** GET / — List projects with pagination, excluding soft-deleted. */
projectRoutes.get('/', zValidator('query', paginationSchema), async (c) => {
  const db = c.get('db')
  const { limit, offset } = c.req.valid('query')

  const whereClause = isNull(projects.deletedAt)

  const [data, totalResult] = await Promise.all([
    db
      .select()
      .from(projects)
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(projects.createdAt),
    db.select({ count: count() }).from(projects).where(whereClause),
  ])

  return c.json({ data, total: totalResult[0].count })
})

/** POST / — Create a new project. */
projectRoutes.post('/', zValidator('json', createProjectSchema), async (c) => {
  const db = c.get('db')
  const body = c.req.valid('json')

  // Validate goalId exists if provided
  if (body.goalId) {
    const goal = await db
      .select({ id: goals.id })
      .from(goals)
      .where(and(eq(goals.id, body.goalId), isNull(goals.deletedAt)))
    if (goal.length === 0) {
      throw new HTTPException(422, { message: 'Goal not found' })
    }
  }

  const [project] = await db.insert(projects).values(body).returning()

  return c.json({ data: project }, 201)
})

/** GET /:id — Get a project with linked goal and issue counts by status. */
projectRoutes.get('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)))

  if (!project) {
    throw new HTTPException(404, { message: 'Project not found' })
  }

  // Fetch linked goal if present
  let goal = null
  if (project.goalId) {
    const [g] = await db
      .select()
      .from(goals)
      .where(and(eq(goals.id, project.goalId), isNull(goals.deletedAt)))
    goal = g ?? null
  }

  // Fetch issue counts grouped by status
  const issueCounts = await db
    .select({
      status: issues.status,
      count: count(),
    })
    .from(issues)
    .where(and(eq(issues.projectId, id), isNull(issues.deletedAt)))
    .groupBy(issues.status)

  const issueCountsByStatus: Record<string, number> = {}
  for (const row of issueCounts) {
    issueCountsByStatus[row.status] = row.count
  }

  return c.json({
    data: {
      ...project,
      goal,
      issueCounts: issueCountsByStatus,
    },
  })
})

/** PATCH /:id — Update a project. */
projectRoutes.patch(
  '/:id',
  zValidator('json', updateProjectSchema),
  async (c) => {
    const db = c.get('db')
    const id = c.req.param('id')
    const body = c.req.valid('json')

    // Verify project exists and is not soft-deleted
    const [existing] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, id), isNull(projects.deletedAt)))

    if (!existing) {
      throw new HTTPException(404, { message: 'Project not found' })
    }

    // Validate goalId if provided
    if (body.goalId) {
      const goal = await db
        .select({ id: goals.id })
        .from(goals)
        .where(and(eq(goals.id, body.goalId), isNull(goals.deletedAt)))
      if (goal.length === 0) {
        throw new HTTPException(422, { message: 'Goal not found' })
      }
    }

    const [updated] = await db
      .update(projects)
      .set(body)
      .where(eq(projects.id, id))
      .returning()

    return c.json({ data: updated })
  },
)

/** DELETE /:id — Soft-delete a project. */
projectRoutes.delete('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')

  const [existing] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)))

  if (!existing) {
    throw new HTTPException(404, { message: 'Project not found' })
  }

  await db
    .update(projects)
    .set({ deletedAt: new Date() })
    .where(eq(projects.id, id))

  return c.body(null, 204)
})
