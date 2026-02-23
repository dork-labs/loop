import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { count, eq, and, isNull, sql } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import {
  promptVersions,
  promptReviews,
  promptTemplates,
  authorTypeValues,
  issues,
  labels,
  issueLabels,
} from '../db/schema';
import type { AppEnv } from '../types';

// ─── EWMA constants ─────────────────────────────────────────────────────────

/** Smoothing factor for exponentially weighted moving average of review scores. */
export const EWMA_ALPHA = 0.3;

/** Minimum review score threshold for a version to be considered well-reviewed. */
export const REVIEW_SCORE_THRESHOLD = 3.5;

/** Number of reviews after which the EWMA score is considered stable. */
export const REVIEW_COUNT_THRESHOLD = 15;

/** Minimum number of reviews required before score-based decisions are made. */
export const REVIEW_MIN_SAMPLES = 3;

// ─── Validation schemas ──────────────────────────────────────────────────────

const createReviewSchema = z.object({
  versionId: z.string().min(1),
  issueId: z.string().min(1),
  clarity: z.number().int().min(1).max(5),
  completeness: z.number().int().min(1).max(5),
  relevance: z.number().int().min(1).max(5),
  feedback: z.string().optional(),
  authorType: z.enum(authorTypeValues),
});

// ─── Route handler ───────────────────────────────────────────────────────────

/** Prompt review routes — mounted at `/prompt-reviews` under the authenticated API group. */
export const promptReviewRoutes = new Hono<AppEnv>();

/** POST / — Submit a prompt review and update the version's review_score. */
promptReviewRoutes.post('/', zValidator('json', createReviewSchema), async (c) => {
  const db = c.get('db');
  const body = c.req.valid('json');

  // Verify the version exists
  const [version] = await db
    .select({ id: promptVersions.id })
    .from(promptVersions)
    .where(eq(promptVersions.id, body.versionId));

  if (!version) {
    throw new HTTPException(404, { message: 'Version not found' });
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
    .returning();

  // Update the version's review_score using EWMA (exponentially weighted moving average).
  // Composite score for this review = average of its three dimensions.
  const composite = (body.clarity + body.completeness + body.relevance) / 3;

  // Fetch the current review score so we can apply the EWMA update rule.
  const [current] = await db
    .select({ reviewScore: promptVersions.reviewScore })
    .from(promptVersions)
    .where(eq(promptVersions.id, body.versionId));

  const newScore =
    current.reviewScore === null
      ? composite
      : EWMA_ALPHA * composite + (1 - EWMA_ALPHA) * current.reviewScore;

  await db
    .update(promptVersions)
    .set({ reviewScore: newScore })
    .where(eq(promptVersions.id, body.versionId));

  // --- Improvement loop trigger ---
  // Count reviews for this version
  const [{ count: reviewCount }] = await db
    .select({ count: count() })
    .from(promptReviews)
    .where(eq(promptReviews.versionId, body.versionId));

  // Only check thresholds if minimum samples met
  if (Number(reviewCount) >= REVIEW_MIN_SAMPLES) {
    const shouldCreateIssue =
      newScore < REVIEW_SCORE_THRESHOLD || Number(reviewCount) >= REVIEW_COUNT_THRESHOLD;

    if (shouldCreateIssue) {
      // Fetch the template for this version (need the version's templateId)
      const [fullVersion] = await db
        .select({ templateId: promptVersions.templateId, version: promptVersions.version })
        .from(promptVersions)
        .where(eq(promptVersions.id, body.versionId));

      const [template] = await db
        .select()
        .from(promptTemplates)
        .where(eq(promptTemplates.id, fullVersion.templateId));

      // Check if an improvement issue already exists (prevent duplicates)
      const existingImprovementTitle = `Improve prompt template: ${template.slug}`;
      const [existingIssue] = await db
        .select({ id: issues.id })
        .from(issues)
        .where(
          and(
            sql`${issues.title} LIKE ${existingImprovementTitle + '%'}`,
            sql`${issues.status} NOT IN ('done', 'canceled')`,
            isNull(issues.deletedAt)
          )
        );

      if (!existingIssue) {
        // Auto-create improvement issue
        const [improvementIssue] = await db
          .insert(issues)
          .values({
            title: `Improve prompt template: ${template.slug} (avg review ${newScore.toFixed(1)}/5, ${reviewCount} reviews since v${fullVersion.version})`,
            type: 'task',
            status: 'todo',
            priority: 3,
            description: [
              `## Prompt Improvement Required`,
              ``,
              `Template **${template.slug}** (${template.name}) has degraded quality.`,
              ``,
              `- EWMA Score: ${newScore.toFixed(2)}/5`,
              `- Review Count: ${reviewCount}`,
              `- Version: v${fullVersion.version}`,
              `- Version ID: ${body.versionId}`,
              ``,
              `## Action Required`,
              ``,
              `1. Review recent feedback on this template`,
              `2. Create a new version addressing the issues`,
              `3. Promote the new version to active`,
            ].join('\n'),
          })
          .returning();

        // Create/find "prompt-improvement" and "meta" labels, link to issue
        for (const labelName of ['prompt-improvement', 'meta']) {
          await db
            .insert(labels)
            .values({
              name: labelName,
              color: labelName === 'meta' ? '#6b7280' : '#f59e0b',
            })
            .onConflictDoNothing();
          const [label] = await db
            .select({ id: labels.id })
            .from(labels)
            .where(eq(labels.name, labelName));
          if (label) {
            await db
              .insert(issueLabels)
              .values({ issueId: improvementIssue.id, labelId: label.id })
              .onConflictDoNothing();
          }
        }
      }
    }
  }

  return c.json({ data: review }, 201);
});
