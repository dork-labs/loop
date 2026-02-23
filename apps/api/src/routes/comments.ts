import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { comments, authorTypeValues, issues } from '../db/schema';
import type { AppEnv } from '../types';

// ─── Validation schemas ──────────────────────────────────────────────────────

const createCommentSchema = z.object({
  body: z.string().min(1),
  authorName: z.string().min(1),
  authorType: z.enum(authorTypeValues),
  parentId: z.string().optional(),
});

// ─── Route handler ───────────────────────────────────────────────────────────

/**
 * Issue comments routes — mounted at `/issues` so that
 * GET/POST `/issues/:id/comments` works.
 */
export const commentRoutes = new Hono<AppEnv>();

/** GET /:id/comments — List comments for an issue, ordered by creation time. */
commentRoutes.get('/:id/comments', async (c) => {
  const db = c.get('db');
  const issueId = c.req.param('id');

  // Verify issue exists
  const [issue] = await db.select({ id: issues.id }).from(issues).where(eq(issues.id, issueId));

  if (!issue) {
    throw new HTTPException(404, { message: 'Issue not found' });
  }

  const allComments = await db
    .select()
    .from(comments)
    .where(eq(comments.issueId, issueId))
    .orderBy(comments.createdAt);

  // Build threaded structure: top-level comments with nested replies
  const topLevel = allComments.filter((c) => !c.parentId);
  const replies = allComments.filter((c) => c.parentId);

  const threaded = topLevel.map((comment) => ({
    ...comment,
    replies: replies.filter((r) => r.parentId === comment.id),
  }));

  return c.json({ data: threaded });
});

/** POST /:id/comments — Add a comment to an issue. */
commentRoutes.post('/:id/comments', zValidator('json', createCommentSchema), async (c) => {
  const db = c.get('db');
  const issueId = c.req.param('id');
  const body = c.req.valid('json');

  // Verify issue exists
  const [issue] = await db.select({ id: issues.id }).from(issues).where(eq(issues.id, issueId));

  if (!issue) {
    throw new HTTPException(404, { message: 'Issue not found' });
  }

  // Verify parent comment exists if parentId is provided
  if (body.parentId) {
    const [parent] = await db
      .select({ id: comments.id })
      .from(comments)
      .where(eq(comments.id, body.parentId));

    if (!parent) {
      throw new HTTPException(422, { message: 'Parent comment not found' });
    }
  }

  const [comment] = await db
    .insert(comments)
    .values({
      body: body.body,
      issueId,
      authorName: body.authorName,
      authorType: body.authorType,
      parentId: body.parentId,
    })
    .returning();

  return c.json({ data: comment }, 201);
});
