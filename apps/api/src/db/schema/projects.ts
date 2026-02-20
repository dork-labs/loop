import { text, doublePrecision, pgEnum } from 'drizzle-orm/pg-core'
import { pgTable } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { cuid2Id, timestamps, softDelete } from './_helpers'

export const projectStatusValues = [
  'backlog',
  'planned',
  'active',
  'paused',
  'completed',
  'canceled',
] as const
export const projectStatusEnum = pgEnum('project_status', projectStatusValues)

export const projectHealthValues = ['on_track', 'at_risk', 'off_track'] as const
export const projectHealthEnum = pgEnum('project_health', projectHealthValues)

export const goalStatusValues = ['active', 'achieved', 'abandoned'] as const
export const goalStatusEnum = pgEnum('goal_status', goalStatusValues)

/** Goals table — tracks measurable outcomes linked to projects. */
export const goals = pgTable('goals', {
  ...cuid2Id,
  title: text('title').notNull(),
  description: text('description'),
  metric: text('metric'),
  targetValue: doublePrecision('target_value'),
  currentValue: doublePrecision('current_value'),
  unit: text('unit'),
  status: goalStatusEnum('status').notNull().default('active'),
  // project_id is defined here but circular: goals ↔ projects
  // We use text column and wire the FK in the projects table instead
  projectId: text('project_id'),
  ...timestamps,
  ...softDelete,
})

/** Projects table — top-level containers for issues and work. */
export const projects = pgTable('projects', {
  ...cuid2Id,
  name: text('name').notNull(),
  description: text('description'),
  status: projectStatusEnum('status').notNull().default('backlog'),
  health: projectHealthEnum('health').notNull().default('on_track'),
  goalId: text('goal_id').references(() => goals.id),
  ...timestamps,
  ...softDelete,
})

/** Relations for project ↔ goal (bidirectional). */
export const projectsRelations = relations(projects, ({ one }) => ({
  goal: one(goals, { fields: [projects.goalId], references: [goals.id] }),
}))

export const goalsRelations = relations(goals, ({ one }) => ({
  project: one(projects, { fields: [goals.projectId], references: [projects.id] }),
}))
