import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { eq, isNull, and, count, inArray } from 'drizzle-orm'
import { HTTPException } from 'hono/http-exception'
import {
  issues,
  issueTypeValues,
  issueStatusValues,
  issueLabels,
  labels,
  issueRelations,
} from '../db/schema'
import type { AppEnv } from '../types'

// ─── Validation schemas ──────────────────────────────────────────────────────

const createIssueSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  type: z.enum(issueTypeValues),
  status: z.enum(issueStatusValues).default('triage'),
  priority: z.number().int().min(0).max(4).default(0),
  parentId: z.string().optional(),
  projectId: z.string().optional(),
  signalSource: z.string().optional(),
  signalPayload: z.record(z.string(), z.unknown()).optional(),
  hypothesis: z
    .object({
      statement: z.string(),
      confidence: z.number().min(0).max(1),
      evidence: z.array(z.string()),
      validationCriteria: z.string(),
      prediction: z.string().optional(),
    })
    .optional(),
  labelIds: z.array(z.string()).optional(),
})

const updateIssueSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  type: z.enum(issueTypeValues).optional(),
  status: z.enum(issueStatusValues).optional(),
  priority: z.number().int().min(0).max(4).optional(),
  parentId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  signalSource: z.string().optional(),
  signalPayload: z.record(z.string(), z.unknown()).optional(),
  hypothesis: z
    .object({
      statement: z.string(),
      confidence: z.number().min(0).max(1),
      evidence: z.array(z.string()),
      validationCriteria: z.string(),
      prediction: z.string().optional(),
    })
    .nullable()
    .optional(),
})

const listIssuesSchema = z.object({
  status: z.string().optional(),
  type: z.string().optional(),
  projectId: z.string().optional(),
  labelId: z.string().optional(),
  priority: z.coerce.number().int().min(0).max(4).optional(),
  parentId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

// ─── Route handler ───────────────────────────────────────────────────────────

/** Issues CRUD routes — mounted at `/issues` under the authenticated API group. */
export const issueRoutes = new Hono<AppEnv>()

/** GET / — List issues with filtering and pagination, excluding soft-deleted. */
issueRoutes.get('/', zValidator('query', listIssuesSchema), async (c) => {
  const db = c.get('db')
  const { status, type, projectId, labelId, priority, parentId, limit, offset } =
    c.req.valid('query')

  const conditions = [isNull(issues.deletedAt)]

  if (status) {
    const statuses = status.split(',') as (typeof issueStatusValues)[number][]
    conditions.push(inArray(issues.status, statuses))
  }
  if (type) {
    const types = type.split(',') as (typeof issueTypeValues)[number][]
    conditions.push(inArray(issues.type, types))
  }
  if (projectId) {
    conditions.push(eq(issues.projectId, projectId))
  }
  if (priority !== undefined) {
    conditions.push(eq(issues.priority, priority))
  }
  if (parentId) {
    conditions.push(eq(issues.parentId, parentId))
  }

  const whereClause = and(...conditions)

  // When filtering by label, join through the issue_labels table
  if (labelId) {
    const [data, totalResult] = await Promise.all([
      db
        .select({
          id: issues.id,
          number: issues.number,
          title: issues.title,
          description: issues.description,
          type: issues.type,
          status: issues.status,
          priority: issues.priority,
          parentId: issues.parentId,
          projectId: issues.projectId,
          signalSource: issues.signalSource,
          signalPayload: issues.signalPayload,
          hypothesis: issues.hypothesis,
          agentSessionId: issues.agentSessionId,
          agentSummary: issues.agentSummary,
          commits: issues.commits,
          pullRequests: issues.pullRequests,
          completedAt: issues.completedAt,
          createdAt: issues.createdAt,
          updatedAt: issues.updatedAt,
          deletedAt: issues.deletedAt,
        })
        .from(issues)
        .innerJoin(issueLabels, eq(issues.id, issueLabels.issueId))
        .where(and(whereClause, eq(issueLabels.labelId, labelId)))
        .limit(limit)
        .offset(offset)
        .orderBy(issues.createdAt),
      db
        .select({ count: count() })
        .from(issues)
        .innerJoin(issueLabels, eq(issues.id, issueLabels.issueId))
        .where(and(whereClause, eq(issueLabels.labelId, labelId))),
    ])

    return c.json({ data, total: totalResult[0].count })
  }

  const [data, totalResult] = await Promise.all([
    db
      .select()
      .from(issues)
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(issues.createdAt),
    db.select({ count: count() }).from(issues).where(whereClause),
  ])

  return c.json({ data, total: totalResult[0].count })
})

/** POST / — Create a new issue with optional label associations. */
issueRoutes.post('/', zValidator('json', createIssueSchema), async (c) => {
  const db = c.get('db')
  const { labelIds, ...body } = c.req.valid('json')

  // Enforce 1-level hierarchy: reject if parent already has a parent
  if (body.parentId) {
    const [parent] = await db
      .select({ id: issues.id, parentId: issues.parentId })
      .from(issues)
      .where(and(eq(issues.id, body.parentId), isNull(issues.deletedAt)))

    if (!parent) {
      throw new HTTPException(422, { message: 'Parent issue not found' })
    }

    if (parent.parentId) {
      throw new HTTPException(422, {
        message:
          'Cannot create a child of an issue that already has a parent (1-level hierarchy limit)',
      })
    }
  }

  const [issue] = await db.insert(issues).values(body).returning()

  // Associate labels if provided
  if (labelIds && labelIds.length > 0) {
    await db
      .insert(issueLabels)
      .values(labelIds.map((labelId) => ({ issueId: issue.id, labelId })))
  }

  return c.json({ data: issue }, 201)
})

/** GET /:id — Get a single issue with parent, children, labels, and relations. */
issueRoutes.get('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')

  const [issue] = await db
    .select()
    .from(issues)
    .where(and(eq(issues.id, id), isNull(issues.deletedAt)))

  if (!issue) {
    throw new HTTPException(404, { message: 'Issue not found' })
  }

  // Fetch related data in parallel
  const [parent, children, labelRows, relationRows] = await Promise.all([
    issue.parentId
      ? db
          .select()
          .from(issues)
          .where(and(eq(issues.id, issue.parentId), isNull(issues.deletedAt)))
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
    db
      .select()
      .from(issues)
      .where(and(eq(issues.parentId, id), isNull(issues.deletedAt))),
    db
      .select({ id: labels.id, name: labels.name, color: labels.color })
      .from(labels)
      .innerJoin(issueLabels, eq(labels.id, issueLabels.labelId))
      .where(and(eq(issueLabels.issueId, id), isNull(labels.deletedAt))),
    db.select().from(issueRelations).where(eq(issueRelations.issueId, id)),
  ])

  return c.json({
    data: {
      ...issue,
      parent,
      children,
      labels: labelRows,
      relations: relationRows,
    },
  })
})

/** PATCH /:id — Partially update an issue. */
issueRoutes.patch('/:id', zValidator('json', updateIssueSchema), async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  const body = c.req.valid('json')

  const [existing] = await db
    .select({ id: issues.id })
    .from(issues)
    .where(and(eq(issues.id, id), isNull(issues.deletedAt)))

  if (!existing) {
    throw new HTTPException(404, { message: 'Issue not found' })
  }

  const [updated] = await db
    .update(issues)
    .set(body)
    .where(eq(issues.id, id))
    .returning()

  return c.json({ data: updated })
})

/** DELETE /:id — Soft-delete an issue. */
issueRoutes.delete('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')

  const [existing] = await db
    .select({ id: issues.id })
    .from(issues)
    .where(and(eq(issues.id, id), isNull(issues.deletedAt)))

  if (!existing) {
    throw new HTTPException(404, { message: 'Issue not found' })
  }

  await db
    .update(issues)
    .set({ deletedAt: new Date() })
    .where(eq(issues.id, id))

  return c.body(null, 204)
})
