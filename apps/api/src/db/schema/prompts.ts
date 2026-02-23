import {
  text,
  integer,
  doublePrecision,
  jsonb,
  index,
  unique,
  check,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { pgTable } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { timestamp } from 'drizzle-orm/pg-core';
import { cuid2Id, timestamps, softDelete } from './_helpers';
import { authorTypeEnum } from './issues';

export const promptVersionStatusValues = ['active', 'draft', 'retired'] as const;
export const promptVersionStatusEnum = pgEnum('prompt_version_status', promptVersionStatusValues);

/** PromptTemplates table — named, versioned prompt templates scoped to projects. */
export const promptTemplates = pgTable('prompt_templates', {
  ...cuid2Id,
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  conditions: jsonb('conditions').notNull().default({}),
  specificity: integer('specificity').notNull().default(10),
  projectId: text('project_id'),
  activeVersionId: text('active_version_id'),
  ...timestamps,
  ...softDelete,
});

/** PromptVersions table — immutable content snapshots of a prompt template. */
export const promptVersions = pgTable(
  'prompt_versions',
  {
    ...cuid2Id,
    templateId: text('template_id')
      .notNull()
      .references(() => promptTemplates.id),
    version: integer('version').notNull(),
    content: text('content').notNull(),
    changelog: text('changelog'),
    authorType: authorTypeEnum('author_type').notNull(),
    authorName: text('author_name').notNull(),
    status: promptVersionStatusEnum('status').notNull().default('draft'),
    usageCount: integer('usage_count').notNull().default(0),
    completionRate: doublePrecision('completion_rate'),
    avgDurationMs: doublePrecision('avg_duration_ms'),
    reviewScore: doublePrecision('review_score'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    unique('uq_prompt_versions_template_version').on(table.templateId, table.version),
    index('idx_prompt_versions_template_id').on(table.templateId),
  ]
);

/** PromptReviews table — agent or human quality reviews for a specific prompt version. */
export const promptReviews = pgTable(
  'prompt_reviews',
  {
    ...cuid2Id,
    versionId: text('version_id')
      .notNull()
      .references(() => promptVersions.id),
    issueId: text('issue_id').notNull(),
    clarity: integer('clarity').notNull(),
    completeness: integer('completeness').notNull(),
    relevance: integer('relevance').notNull(),
    feedback: text('feedback'),
    authorType: authorTypeEnum('author_type').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_prompt_reviews_version_id').on(table.versionId),
    check('chk_clarity_range', sql`${table.clarity} BETWEEN 1 AND 5`),
    check('chk_completeness_range', sql`${table.completeness} BETWEEN 1 AND 5`),
    check('chk_relevance_range', sql`${table.relevance} BETWEEN 1 AND 5`),
  ]
);

/** Relations for promptTemplates ↔ promptVersions ↔ promptReviews. */
export const promptTemplatesRelations = relations(promptTemplates, ({ many, one }) => ({
  versions: many(promptVersions),
  activeVersion: one(promptVersions, {
    fields: [promptTemplates.activeVersionId],
    references: [promptVersions.id],
    relationName: 'activeVersion',
  }),
}));

export const promptVersionsRelations = relations(promptVersions, ({ one, many }) => ({
  template: one(promptTemplates, {
    fields: [promptVersions.templateId],
    references: [promptTemplates.id],
  }),
  reviews: many(promptReviews),
}));

export const promptReviewsRelations = relations(promptReviews, ({ one }) => ({
  version: one(promptVersions, {
    fields: [promptReviews.versionId],
    references: [promptVersions.id],
  }),
}));
