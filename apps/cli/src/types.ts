// Core enums
export type IssueStatus = 'triage' | 'todo' | 'backlog' | 'in_progress' | 'done' | 'canceled'
export type IssueType = 'signal' | 'hypothesis' | 'plan' | 'task' | 'monitor'
export type SignalSeverity = 'critical' | 'high' | 'medium' | 'low'
export type ProjectStatus = 'backlog' | 'planned' | 'active' | 'on_hold' | 'completed'
export type ProjectHealth = 'on_track' | 'at_risk' | 'off_track'
export type GoalStatus = 'active' | 'achieved' | 'abandoned'
export type VersionStatus = 'active' | 'draft' | 'retired'

// Response wrappers
export interface PaginatedResponse<T> {
  data: T[]
  total: number
}

export interface SingleResponse<T> {
  data: T
}

// Entities
export interface Issue {
  id: string
  number: number
  title: string
  description?: string | null
  type: IssueType
  status: IssueStatus
  priority: number
  parentId?: string | null
  projectId?: string | null
  signalSource?: string | null
  signalPayload?: Record<string, unknown> | null
  hypothesis?: HypothesisData | null
  agentSessionId?: string | null
  agentSummary?: string | null
  commits?: unknown[] | null
  pullRequests?: unknown[] | null
  completedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface IssueDetail extends Issue {
  parent?: Issue | null
  children: Issue[]
  labels: Label[]
  relations: IssueRelation[]
}

export interface HypothesisData {
  statement: string
  confidence: number
  evidence: string[]
  validationCriteria: string
  prediction?: string
}

export interface Project {
  id: string
  name: string
  description?: string | null
  status: ProjectStatus
  health: ProjectHealth
  goalId?: string | null
  createdAt: string
  updatedAt: string
}

export interface Goal {
  id: string
  title: string
  description?: string | null
  metric?: string | null
  targetValue?: number | null
  currentValue?: number | null
  unit?: string | null
  status: GoalStatus
  projectId?: string | null
  createdAt: string
  updatedAt: string
}

export interface Label {
  id: string
  name: string
  color: string
}

export interface IssueRelation {
  id: string
  issueId: string
  relatedIssueId: string
  type: string
  createdAt: string
}

export interface Signal {
  id: string
  source: string
  sourceId?: string | null
  type: string
  severity: SignalSeverity
  payload: Record<string, unknown>
  issueId: string
  createdAt: string
}

export interface PromptTemplate {
  id: string
  slug: string
  name: string
  description?: string | null
  conditions: Record<string, unknown>
  specificity: number
  activeVersionId?: string | null
  projectId?: string | null
  createdAt: string
  updatedAt: string
}

export interface PromptVersion {
  id: string
  templateId: string
  version: number
  content: string
  changelog?: string | null
  authorType: string
  authorName: string
  status: VersionStatus
  reviewScore?: number | null
  usageCount: number
  completionRate?: number | null
  createdAt: string
}

export interface DashboardStats {
  issues: {
    total: number
    byStatus: Record<string, number>
    byType: Record<string, number>
  }
  goals: {
    total: number
    active: number
    achieved: number
  }
  dispatch: {
    queueDepth: number
    activeCount: number
    completedLast24h: number
  }
}

export interface DispatchQueueItem {
  issue: Issue
  score: number
  breakdown: {
    priorityWeight: number
    goalBonus: number
    ageBonus: number
    typeBonus: number
  }
}
