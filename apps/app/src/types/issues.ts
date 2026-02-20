/** Discriminated union values matching the `issue_type` postgres enum. */
export type IssueType = 'signal' | 'hypothesis' | 'plan' | 'task' | 'monitor'

/** Discriminated union values matching the `issue_status` postgres enum. */
export type IssueStatus = 'triage' | 'backlog' | 'todo' | 'in_progress' | 'done' | 'canceled'

/** Discriminated union values matching the `relation_type` postgres enum. */
export type RelationType = 'blocks' | 'blocked_by' | 'related' | 'duplicate'

/** Discriminated union values matching the `author_type` postgres enum. */
export type AuthorType = 'human' | 'agent'

/** Structured hypothesis data stored in the `hypothesis` JSONB column. */
export interface HypothesisData {
  statement: string
  confidence: number
  evidence: string[]
  validationCriteria: string
  prediction?: string
}

/** A reference to a git commit stored in the `commits` JSONB column. */
export interface CommitRef {
  sha: string
  message: string
  url?: string
  author?: string
  timestamp?: string
}

/** A reference to a pull request stored in the `pull_requests` JSONB column. */
export interface PullRequestRef {
  number: number
  title: string
  url?: string
  state?: string
  mergedAt?: string | null
}

/** A label that can be attached to one or more issues. */
export interface Label {
  id: string
  name: string
  color: string
}

/** A directional relation between two issues. */
export interface IssueRelation {
  id: string
  type: RelationType
  issueId: string
  relatedIssueId: string
  relatedIssue?: Issue
}

/** A comment on an issue, optionally nested under a parent comment. */
export interface Comment {
  id: string
  body: string
  issueId: string
  authorName: string
  authorType: AuthorType
  parentId: string | null
  createdAt: string
  children?: Comment[]
}

/**
 * A single Loop issue — the core work item in the system.
 * Nested relations (labels, relations, comments, children) are only present
 * on detail responses from `GET /api/issues/:id`.
 */
export interface Issue {
  id: string
  number: number
  title: string
  description: string | null
  type: IssueType
  status: IssueStatus
  priority: number
  parentId: string | null
  projectId: string | null
  signalSource: string | null
  signalPayload: Record<string, unknown> | null
  hypothesis: HypothesisData | null
  agentSessionId: string | null
  agentSummary: string | null
  commits: CommitRef[] | null
  pullRequests: PullRequestRef[] | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
  labels?: Label[]
  relations?: IssueRelation[]
  comments?: Comment[]
  children?: Issue[]
  parent?: Issue | null
}

/** Query params accepted by `GET /api/issues`. */
export interface IssueListParams {
  status?: IssueStatus
  type?: IssueType
  projectId?: string
  labelId?: string
  priority?: number
  page?: number
  limit?: number
}

/** Generic paginated list envelope returned by all list endpoints. */
export interface PaginatedResponse<T> {
  data: T[]
  total: number
}
