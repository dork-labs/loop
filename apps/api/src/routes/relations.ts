import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { issueRelations, relationTypeValues, issues } from '../db/schema';
import type { AppEnv } from '../types';

// ─── Validation schemas ──────────────────────────────────────────────────────

const createRelationSchema = z.object({
  type: z.enum(relationTypeValues),
  relatedIssueId: z.string().min(1),
});

// ─── Route handler ───────────────────────────────────────────────────────────

/** Issue relations routes — relation creation nested under `/issues/:id/relations`, deletion at `/relations/:id`. */
export const relationRoutes = new Hono<AppEnv>();

/**
 * Relation creation routes nested under issues.
 * Mounted at `/issues` so that POST `/issues/:id/relations` works.
 */
export const issueRelationRoutes = new Hono<AppEnv>();

/** POST /:id/relations — Create a relation between two issues. */
issueRelationRoutes.post('/:id/relations', zValidator('json', createRelationSchema), async (c) => {
  const db = c.get('db');
  const issueId = c.req.param('id');
  const body = c.req.valid('json');

  // Verify source issue exists
  const [sourceIssue] = await db
    .select({ id: issues.id })
    .from(issues)
    .where(eq(issues.id, issueId));

  if (!sourceIssue) {
    throw new HTTPException(404, { message: 'Issue not found' });
  }

  // Verify related issue exists
  const [relatedIssue] = await db
    .select({ id: issues.id })
    .from(issues)
    .where(eq(issues.id, body.relatedIssueId));

  if (!relatedIssue) {
    throw new HTTPException(422, { message: 'Related issue not found' });
  }

  // Prevent self-relation
  if (issueId === body.relatedIssueId) {
    throw new HTTPException(422, {
      message: 'Cannot create a relation to the same issue',
    });
  }

  const [relation] = await db
    .insert(issueRelations)
    .values({
      type: body.type,
      issueId,
      relatedIssueId: body.relatedIssueId,
    })
    .returning();

  return c.json({ data: relation }, 201);
});

/** DELETE /:id — Hard-delete a relation. */
relationRoutes.delete('/:id', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');

  const [existing] = await db
    .select({ id: issueRelations.id })
    .from(issueRelations)
    .where(eq(issueRelations.id, id));

  if (!existing) {
    throw new HTTPException(404, { message: 'Relation not found' });
  }

  await db.delete(issueRelations).where(eq(issueRelations.id, id));

  return c.body(null, 204);
});
