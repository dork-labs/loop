import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { eq, avg, sql } from 'drizzle-orm'
import { HTTPException } from 'hono/http-exception'
import { promptVersions, promptReviews, authorTypeValues } from '../db/schema'
import type { AppEnv } from '../types'

// ─── Validation schemas ──────────────────────────────────────────────────────

const createReviewSchema = z.object({
  versionId: z.string().min(1),
  issueId: z.string().min(1),
  clarity: z.number().int().min(1).max(5),
  completeness: z.number().int().min(1).max(5),
  relevance: z.number().int().min(1).max(5),
  feedback: z.string().optional(),
  authorType: z.enum(authorTypeValues),
})

// ─── Route handler ───────────────────────────────────────────────────────────

/** Prompt review routes — mounted at `/prompt-reviews` under the authenticated API group. */
export const promptReviewRoutes = new Hono<AppEnv>()

/** POST / — Submit a prompt review and update the version's review_score. */
promptReviewRoutes.post('/', zValidator('json', createReviewSchema), async (c) => {
  const db = c.get('db')
  const body = c.req.valid('json')

  // Verify the version exists
  const [version] = await db
    .select({ id: promptVersions.id })
    .from(promptVersions)
    .where(eq(promptVersions.id, body.versionId))

  if (!version) {
    throw new HTTPException(404, { message: 'Version not found' })
  }

  // Create the review
  const [review] = await db
    .insert(promptReviews)
    .values({
      versionId: body.versionId,
      issueId: body.issueId,
      clarity: body.clarity,
      completeness: body.completeness,
      relevance: body.relevance,
      feedback: body.feedback,
      authorType: body.authorType,
    })
    .returning()

  // Update the version's review_score: average of each review's average score
  // Each review's average = (clarity + completeness + relevance) / 3
  // The version score = average of all those per-review averages
  const [scoreResult] = await db
    .select({
      avgScore: avg(
        sql`(${promptReviews.clarity} + ${promptReviews.completeness} + ${promptReviews.relevance}) / 3.0`,
      ),
    })
    .from(promptReviews)
    .where(eq(promptReviews.versionId, body.versionId))

  const reviewScore = scoreResult?.avgScore ? parseFloat(scoreResult.avgScore) : null

  await db
    .update(promptVersions)
    .set({ reviewScore })
    .where(eq(promptVersions.id, body.versionId))

  return c.json({ data: review }, 201)
})
