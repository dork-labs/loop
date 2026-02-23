import {
  pgTable,
  pgEnum,
  text,
  integer,
  serial,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { timestamps, softDelete, cuid2Id } from './_helpers';

// ─── Enum value arrays (for Zod reuse) ───────────────────────────────────────

export const issueTypeValues = ['signal', 'hypothesis', 'plan', 'task', 'monitor'] as const;
export const issueStatusValues = [
  'triage',
  'backlog',
  'todo',
  'in_progress',
  'done',
  'canceled',
] as const;
export const relationTypeValues = ['blocks', 'blocked_by', 'related', 'duplicate'] as const;
export const authorTypeValues = ['human', 'agent'] as const;

// ─── Postgres enums ───────────────────────────────────────────────────────────

export const issueTypeEnum = pgEnum('issue_type', issueTypeValues);
export const issueStatusEnum = pgEnum('issue_status', issueStatusValues);
export const relationTypeEnum = pgEnum('relation_type', relationTypeValues);
export const authorTypeEnum = pgEnum('author_type', authorTypeValues);

// ─── JSONB types ──────────────────────────────────────────────────────────────

export type SignalPayload = Record<string, unknown>;

export type HypothesisData = {
  statement: string;
  confidence: number;
  evidence: string[];
  validationCriteria: string;
  prediction?: string;
};

export type CommitRef = {
  sha: string;
  message: string;
  url?: string;
  author?: string;
  timestamp?: string;
};

export type PullRequestRef = {
  number: number;
  title: string;
  url?: string;
  state?: string;
  mergedAt?: string;
};

// ─── Issues table ─────────────────────────────────────────────────────────────

export const issues = pgTable(
  'issues',
  {
    ...cuid2Id,
    number: serial('number').notNull().unique(),
    title: text('title').notNull(),
    description: text('description'),
    type: issueTypeEnum('type').notNull(),
    status: issueStatusEnum('status').notNull().default('triage'),
    priority: integer('priority').notNull().default(0),
    parentId: text('parent_id'),
    projectId: text('project_id'),
    signalSource: text('signal_source'),
    signalPayload: jsonb('signal_payload').$type<SignalPayload>(),
    hypothesis: jsonb('hypothesis').$type<HypothesisData>(),
    agentSessionId: text('agent_session_id'),
    agentSummary: text('agent_summary'),
    commits: jsonb('commits').$type<CommitRef[]>(),
    pullRequests: jsonb('pull_requests').$type<PullRequestRef[]>(),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
    ...timestamps,
    ...softDelete,
  },
  (table) => [
    index('idx_issues_project_status').on(table.projectId, table.status),
    index('idx_issues_parent_id').on(table.parentId),
    index('idx_issues_type').on(table.type),
    index('idx_issues_status').on(table.status),
    uniqueIndex('idx_issues_number').on(table.number),
  ]
);

// ─── Labels table ─────────────────────────────────────────────────────────────

export const labels = pgTable('labels', {
  ...cuid2Id,
  name: text('name').notNull().unique(),
  color: text('color').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
});

// ─── IssueLabels join table ───────────────────────────────────────────────────

export const issueLabels = pgTable(
  'issue_labels',
  {
    issueId: text('issue_id').notNull(),
    labelId: text('label_id').notNull(),
  },
  (table) => [primaryKey({ columns: [table.issueId, table.labelId] })]
);

// ─── IssueRelations table ─────────────────────────────────────────────────────

export const issueRelations = pgTable(
  'issue_relations',
  {
    ...cuid2Id,
    type: relationTypeEnum('type').notNull(),
    issueId: text('issue_id').notNull(),
    relatedIssueId: text('related_issue_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_issue_relations_issue_id').on(table.issueId),
    index('idx_issue_relations_related_issue_id').on(table.relatedIssueId),
  ]
);

// ─── Comments table ───────────────────────────────────────────────────────────

export const comments = pgTable(
  'comments',
  {
    ...cuid2Id,
    body: text('body').notNull(),
    issueId: text('issue_id').notNull(),
    authorName: text('author_name').notNull(),
    authorType: authorTypeEnum('author_type').notNull(),
    parentId: text('parent_id'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [index('idx_comments_issue_id').on(table.issueId)]
);

// ─── Relations definitions ────────────────────────────────────────────────────

export const issuesRelations = relations(issues, ({ one, many }) => ({
  parent: one(issues, {
    fields: [issues.parentId],
    references: [issues.id],
    relationName: 'parent_children',
  }),
  children: many(issues, { relationName: 'parent_children' }),
  issueLabels: many(issueLabels),
  issueRelations: many(issueRelations, { relationName: 'issue_relations' }),
  relatedIssueRelations: many(issueRelations, { relationName: 'related_issue_relations' }),
  comments: many(comments),
}));

export const labelsRelations = relations(labels, ({ many }) => ({
  issueLabels: many(issueLabels),
}));

export const issueLabelsRelations = relations(issueLabels, ({ one }) => ({
  issue: one(issues, {
    fields: [issueLabels.issueId],
    references: [issues.id],
  }),
  label: one(labels, {
    fields: [issueLabels.labelId],
    references: [labels.id],
  }),
}));

export const issueRelationsRelations = relations(issueRelations, ({ one }) => ({
  issue: one(issues, {
    fields: [issueRelations.issueId],
    references: [issues.id],
    relationName: 'issue_relations',
  }),
  relatedIssue: one(issues, {
    fields: [issueRelations.relatedIssueId],
    references: [issues.id],
    relationName: 'related_issue_relations',
  }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  issue: one(issues, {
    fields: [comments.issueId],
    references: [issues.id],
  }),
  parent: one(comments, {
    fields: [comments.parentId],
    references: [comments.id],
    relationName: 'comment_thread',
  }),
}));
