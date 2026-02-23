import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { eq, isNull, and, count, desc, max, sql } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import {
  promptTemplates,
  promptVersions,
  promptReviews,
  authorTypeValues,
  issues,
  labels,
  issueLabels,
} from '../db/schema';
import {
  TemplateConditionsSchema,
  selectTemplate,
  buildHydrationContext,
  hydrateTemplate,
  type IssueContext,
  type TemplateCandidate,
  type TemplateConditions,
} from '../lib/prompt-engine';
import type { AppEnv } from '../types';

// ─── Validation schemas ──────────────────────────────────────────────────────

const createTemplateSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens'),
  name: z.string().min(1).max(500),
  description: z.string().optional(),
  conditions: TemplateConditionsSchema.default({}),
  specificity: z.number().int().min(0).max(100).default(10),
  projectId: z.string().optional(),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  conditions: TemplateConditionsSchema.optional(),
  specificity: z.number().int().min(0).max(100).optional(),
  projectId: z.string().nullable().optional(),
});

const createVersionSchema = z.object({
  content: z.string().min(1),
  changelog: z.string().optional(),
  authorType: z.enum(authorTypeValues),
  authorName: z.string().min(1),
});

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// ─── Route handler ───────────────────────────────────────────────────────────

/** Template and version CRUD routes — mounted at `/templates` under the authenticated API group. */
export const templateRoutes = new Hono<AppEnv>();

/** GET / — List templates with pagination, excluding soft-deleted. */
templateRoutes.get('/', zValidator('query', paginationSchema), async (c) => {
  const db = c.get('db');
  const { limit, offset } = c.req.valid('query');

  const whereClause = isNull(promptTemplates.deletedAt);

  const [data, totalResult] = await Promise.all([
    db
      .select()
      .from(promptTemplates)
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(promptTemplates.createdAt),
    db.select({ count: count() }).from(promptTemplates).where(whereClause),
  ]);

  return c.json({ data, total: totalResult[0].count });
});

/** POST / — Create a new template with an initial version. */
templateRoutes.post('/', zValidator('json', createTemplateSchema), async (c) => {
  const db = c.get('db');
  const body = c.req.valid('json');

  // Check slug uniqueness
  const [existing] = await db
    .select({ id: promptTemplates.id })
    .from(promptTemplates)
    .where(eq(promptTemplates.slug, body.slug));

  if (existing) {
    throw new HTTPException(409, { message: 'Template slug already exists' });
  }

  const [template] = await db.insert(promptTemplates).values(body).returning();

  return c.json({ data: template }, 201);
});

// ─── Preview route (must be before /:id to avoid route conflict) ─────────────

/** GET /preview/:issueId — Preview template selection + hydration for an issue. */
templateRoutes.get('/preview/:issueId', async (c) => {
  const db = c.get('db');
  const issueId = c.req.param('issueId');

  // 1. Fetch issue
  const [issue] = await db
    .select()
    .from(issues)
    .where(and(eq(issues.id, issueId), isNull(issues.deletedAt)));

  if (!issue) {
    throw new HTTPException(404, { message: 'Issue not found' });
  }

  // 2. Build IssueContext (same logic as dispatch buildIssueContext)
  const [labelRows, failedSessionRows] = await Promise.all([
    db
      .select({ name: labels.name })
      .from(issueLabels)
      .innerJoin(labels, eq(issueLabels.labelId, labels.id))
      .where(eq(issueLabels.issueId, issue.id)),
    issue.parentId
      ? db
          .select({ id: issues.id })
          .from(issues)
          .where(
            and(
              eq(issues.parentId, issue.parentId),
              eq(issues.status, 'canceled'),
              isNull(issues.deletedAt),
              sql`${issues.agentSummary} IS NOT NULL`
            )
          )
      : Promise.resolve([]),
  ]);

  const issueContext: IssueContext = {
    type: issue.type,
    signalSource: issue.signalSource ?? null,
    labels: labelRows.map((l) => l.name),
    projectId: issue.projectId ?? null,
    hasFailedSessions: failedSessionRows.length > 0,
    hypothesisConfidence: issue.hypothesis?.confidence ?? null,
  };

  // 3. Fetch all non-deleted templates
  const allTemplates = await db
    .select()
    .from(promptTemplates)
    .where(isNull(promptTemplates.deletedAt));

  const candidates: TemplateCandidate[] = allTemplates.map((t) => ({
    id: t.id,
    slug: t.slug,
    conditions: t.conditions as TemplateConditions,
    specificity: t.specificity,
    projectId: t.projectId ?? null,
    activeVersionId: t.activeVersionId ?? null,
  }));

  // 4. Select template with fallback
  let selected = selectTemplate(candidates, issueContext);
  if (!selected) {
    selected =
      candidates.find(
        (t) => (t.conditions as TemplateConditions).type === issue.type && t.activeVersionId
      ) ?? null;
  }

  // 5. No template found
  if (!selected || !selected.activeVersionId) {
    return c.json({
      issue: { id: issue.id, number: issue.number, title: issue.title, type: issue.type },
      template: null,
      version: null,
      prompt: null,
      message: 'No matching template found',
    });
  }

  // 6. Fetch version, build context, hydrate
  const [version] = await db
    .select()
    .from(promptVersions)
    .where(eq(promptVersions.id, selected.activeVersionId));

  if (!version) {
    return c.json({
      issue: { id: issue.id, number: issue.number, title: issue.title, type: issue.type },
      template: null,
      version: null,
      prompt: null,
      message: 'Active version not found',
    });
  }

  const hydrationContext = await buildHydrationContext(
    db,
    issue,
    { id: selected.id, slug: selected.slug },
    { id: version.id, version: version.version }
  );
  const prompt = hydrateTemplate(version.id, version.content, hydrationContext);

  return c.json({
    issue: { id: issue.id, number: issue.number, title: issue.title, type: issue.type },
    template: {
      id: selected.id,
      slug: selected.slug,
      name: allTemplates.find((t) => t.id === selected!.id)?.name,
      conditions: selected.conditions,
      specificity: selected.specificity,
    },
    version: { id: version.id, version: version.version },
    prompt,
  });
});

/** GET /:id — Get a template with its active version. */
templateRoutes.get('/:id', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');

  const [template] = await db
    .select()
    .from(promptTemplates)
    .where(and(eq(promptTemplates.id, id), isNull(promptTemplates.deletedAt)));

  if (!template) {
    throw new HTTPException(404, { message: 'Template not found' });
  }

  // Fetch active version if set
  let activeVersion = null;
  if (template.activeVersionId) {
    const [v] = await db
      .select()
      .from(promptVersions)
      .where(eq(promptVersions.id, template.activeVersionId));
    activeVersion = v ?? null;
  }

  return c.json({ data: { ...template, activeVersion } });
});

/** PATCH /:id — Update a template. */
templateRoutes.patch('/:id', zValidator('json', updateTemplateSchema), async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  const body = c.req.valid('json');

  const [existing] = await db
    .select({ id: promptTemplates.id })
    .from(promptTemplates)
    .where(and(eq(promptTemplates.id, id), isNull(promptTemplates.deletedAt)));

  if (!existing) {
    throw new HTTPException(404, { message: 'Template not found' });
  }

  const [updated] = await db
    .update(promptTemplates)
    .set(body)
    .where(eq(promptTemplates.id, id))
    .returning();

  return c.json({ data: updated });
});

/** DELETE /:id — Soft-delete a template. */
templateRoutes.delete('/:id', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');

  const [existing] = await db
    .select({ id: promptTemplates.id })
    .from(promptTemplates)
    .where(and(eq(promptTemplates.id, id), isNull(promptTemplates.deletedAt)));

  if (!existing) {
    throw new HTTPException(404, { message: 'Template not found' });
  }

  await db.update(promptTemplates).set({ deletedAt: new Date() }).where(eq(promptTemplates.id, id));

  return c.body(null, 204);
});

// ─── Version routes ──────────────────────────────────────────────────────────

/** GET /:id/versions — List all versions for a template. */
templateRoutes.get('/:id/versions', zValidator('query', paginationSchema), async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  const { limit, offset } = c.req.valid('query');

  // Verify template exists
  const [template] = await db
    .select({ id: promptTemplates.id })
    .from(promptTemplates)
    .where(and(eq(promptTemplates.id, id), isNull(promptTemplates.deletedAt)));

  if (!template) {
    throw new HTTPException(404, { message: 'Template not found' });
  }

  const [data, totalResult] = await Promise.all([
    db
      .select()
      .from(promptVersions)
      .where(eq(promptVersions.templateId, id))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(promptVersions.version)),
    db.select({ count: count() }).from(promptVersions).where(eq(promptVersions.templateId, id)),
  ]);

  return c.json({ data, total: totalResult[0].count });
});

/** POST /:id/versions — Create a new version for a template. Auto-increments version number. */
templateRoutes.post('/:id/versions', zValidator('json', createVersionSchema), async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  const body = c.req.valid('json');

  // Verify template exists
  const [template] = await db
    .select()
    .from(promptTemplates)
    .where(and(eq(promptTemplates.id, id), isNull(promptTemplates.deletedAt)));

  if (!template) {
    throw new HTTPException(404, { message: 'Template not found' });
  }

  // Reject raw triple-brace syntax — use Handlebars double-brace with helpers instead
  if (body.content.includes('{{{')) {
    throw new HTTPException(422, {
      message:
        'Triple-brace syntax ({{{) is not allowed. Use double-brace Handlebars expressions instead.',
    });
  }

  // Determine next version number
  const [maxResult] = await db
    .select({ maxVersion: max(promptVersions.version) })
    .from(promptVersions)
    .where(eq(promptVersions.templateId, id));

  const nextVersion = (maxResult?.maxVersion ?? 0) + 1;
  const isFirstVersion = template.activeVersionId === null;

  const [version] = await db
    .insert(promptVersions)
    .values({
      templateId: id,
      version: nextVersion,
      content: body.content,
      changelog: body.changelog,
      authorType: body.authorType,
      authorName: body.authorName,
      status: isFirstVersion ? 'active' : 'draft',
    })
    .returning();

  // If this is the first version, set it as active on the template
  if (isFirstVersion) {
    await db
      .update(promptTemplates)
      .set({ activeVersionId: version.id })
      .where(eq(promptTemplates.id, id));
  }

  return c.json({ data: version }, 201);
});

/** POST /:id/versions/:versionId/promote — Promote a version to active, retiring the current active. */
templateRoutes.post('/:id/versions/:versionId/promote', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  const versionId = c.req.param('versionId');

  // Verify template exists
  const [template] = await db
    .select()
    .from(promptTemplates)
    .where(and(eq(promptTemplates.id, id), isNull(promptTemplates.deletedAt)));

  if (!template) {
    throw new HTTPException(404, { message: 'Template not found' });
  }

  // Verify version exists and belongs to template
  const [version] = await db
    .select()
    .from(promptVersions)
    .where(and(eq(promptVersions.id, versionId), eq(promptVersions.templateId, id)));

  if (!version) {
    throw new HTTPException(404, { message: 'Version not found' });
  }

  if (version.status === 'active') {
    throw new HTTPException(422, { message: 'Version is already active' });
  }

  // Retire the currently active version if one exists
  if (template.activeVersionId) {
    await db
      .update(promptVersions)
      .set({ status: 'retired' })
      .where(eq(promptVersions.id, template.activeVersionId));
  }

  // Set the new version as active
  const [promoted] = await db
    .update(promptVersions)
    .set({ status: 'active' })
    .where(eq(promptVersions.id, versionId))
    .returning();

  // Update template's active version pointer
  await db
    .update(promptTemplates)
    .set({ activeVersionId: versionId })
    .where(eq(promptTemplates.id, id));

  return c.json({ data: promoted });
});

// ─── Review routes ───────────────────────────────────────────────────────────

/** GET /:id/reviews — List all reviews across all versions of a template. */
templateRoutes.get('/:id/reviews', zValidator('query', paginationSchema), async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  const { limit, offset } = c.req.valid('query');

  // Verify template exists
  const [template] = await db
    .select({ id: promptTemplates.id })
    .from(promptTemplates)
    .where(and(eq(promptTemplates.id, id), isNull(promptTemplates.deletedAt)));

  if (!template) {
    throw new HTTPException(404, { message: 'Template not found' });
  }

  // Get version IDs for this template
  const versionIds = await db
    .select({ id: promptVersions.id })
    .from(promptVersions)
    .where(eq(promptVersions.templateId, id));

  if (versionIds.length === 0) {
    return c.json({ data: [], total: 0 });
  }

  const ids = versionIds.map((v) => v.id);

  const [data, totalResult] = await Promise.all([
    db
      .select()
      .from(promptReviews)
      .where(sql`${promptReviews.versionId} IN ${ids}`)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(promptReviews.createdAt)),
    db
      .select({ count: count() })
      .from(promptReviews)
      .where(sql`${promptReviews.versionId} IN ${ids}`),
  ]);

  return c.json({ data, total: totalResult[0].count });
});
