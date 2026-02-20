/** Discriminated union values matching the `project_status` postgres enum. */
export type ProjectStatus =
  | 'backlog'
  | 'planned'
  | 'active'
  | 'paused'
  | 'completed'
  | 'canceled'

/** Discriminated union values matching the `project_health` postgres enum. */
export type ProjectHealth = 'on_track' | 'at_risk' | 'off_track'

/** Discriminated union values matching the `goal_status` postgres enum. */
export type GoalStatus = 'active' | 'achieved' | 'abandoned'

/** A project — top-level container for issues and work. */
export interface Project {
  id: string
  name: string
  description: string | null
  status: ProjectStatus
  health: ProjectHealth
  goalId: string | null
  createdAt: string
  updatedAt: string
}

/**
 * A measurable goal linked to a project.
 * `targetValue` and `currentValue` are nullable doubles in the DB schema.
 */
export interface Goal {
  id: string
  projectId: string | null
  title: string
  description: string | null
  /** Human-readable metric label (e.g. "error rate"). */
  metric: string | null
  /** Unit of measure (e.g. "%" or "ms"). */
  unit: string | null
  targetValue: number | null
  currentValue: number | null
  status: GoalStatus
  createdAt: string
  updatedAt: string
  /** Populated on detail responses that join the parent project. */
  project?: Project
}
